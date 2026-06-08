/**
 * Anthropic → DeepSeek API Translation Proxy
 *
 * Claude Code sends Anthropic-format requests to this proxy.
 * The proxy translates them to DeepSeek Chat Completions format,
 * calls DeepSeek, and returns Anthropic-format responses.
 */

// Read API key from file (written by the agent orchestrator)
const fs = require("fs");
const path = require("path");
const http = require("http");

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const PORT = parseInt(process.env.PROXY_PORT || "9999");
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

if (!DEEPSEEK_KEY) {
  console.error("DEEPSEEK_API_KEY not set");
  process.exit(1);
}

// ── Message format converters ──

function anthropicToOpenAI(messages) {
  const result = [];
  for (const msg of messages) {
    const role = msg.role;
    let content = "";

    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      // Handle tool_use blocks → convert to function call format
      const toolBlocks = msg.content.filter((b) => b.type === "tool_use");
      if (toolBlocks.length > 0) {
        // We'll handle tool messages separately
      }
    }

    if (content) {
      result.push({ role, content });
    }
  }
  return result;
}

function openAIToAnthropic(openAIResp, model) {
  const choice = openAIResp.choices?.[0];
  const msg = choice?.message;
  const content = [];

  // Text response
  if (msg?.content) {
    content.push({ type: "text", text: msg.content });
  }

  // Tool calls → Anthropic tool_use blocks
  if (msg?.tool_calls) {
    for (const tc of msg.tool_calls) {
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || "{}"),
      });
    }
  }

  return {
    id: `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: model || "deepseek-chat",
    content,
    stop_reason: choice?.finish_reason === "tool_calls" ? "tool_use" : choice?.finish_reason === "stop" ? "end_turn" : "max_tokens",
    stop_sequence: null,
    usage: {
      input_tokens: openAIResp.usage?.prompt_tokens || 0,
      output_tokens: openAIResp.usage?.completion_tokens || 0,
    },
  };
}

// ── Tool definition converters ──

function anthropicToolsToOpenAI(tools) {
  if (!tools || !Array.isArray(tools)) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema || t.parameters || { type: "object", properties: {} },
    },
  }));
}

// ── HTTP Server ──

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Only handle POST /v1/messages
  if (req.method !== "POST" || !req.url?.includes("/v1/messages")) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const anthropicReq = JSON.parse(body);
      const model = anthropicReq.model || "deepseek-chat";

      // Build OpenAI-format request
      const openaiBody = {
        model: model,
        messages: anthropicToOpenAI(anthropicReq.messages || []),
        max_tokens: anthropicReq.max_tokens || 4096,
        temperature: anthropicReq.temperature,
        stream: false, // Claude Code uses non-streaming in current versions
      };

      // Convert tools
      const tools = anthropicToolsToOpenAI(anthropicReq.tools);
      if (tools) {
        openaiBody.tools = tools;
        openaiBody.tool_choice = "auto";
      }

      // Call DeepSeek
      const deepseekResp = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_KEY}`,
        },
        body: JSON.stringify(openaiBody),
        signal: AbortSignal.timeout(120000),
      });

      if (!deepseekResp.ok) {
        const errText = await deepseekResp.text();
        console.error(`DeepSeek error ${deepseekResp.status}: ${errText.slice(0, 500)}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { type: "api_error", message: `DeepSeek API error: ${deepseekResp.status}` } }));
        return;
      }

      const openaiData = await deepseekResp.json();
      const anthropicResp = openAIToAnthropic(openaiData, model);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(anthropicResp));
    } catch (e) {
      console.error("Proxy error:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { type: "api_error", message: e.message } }));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Proxy listening on http://127.0.0.1:${PORT}`);
});
