// Real AI Agent with tool calling — produces actual deliverable files
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

// ============================================================
// LLM Provider URLs
// ============================================================
const API_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
};

// ============================================================
// Agent Tools — the Agent can call these to produce real files
// ============================================================
const TOOLS = [
  {
    name: "create_file",
    description: "Create a file and save it as a project deliverable. Use this to produce the final output the user asked for.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "File title/name (e.g. 'Project Plan', 'Login Component')" },
        content: { type: "string", description: "The full file content" },
        format: { type: "string", enum: ["md", "html", "txt", "json", "csv"], description: "File format" },
        description: { type: "string", description: "Short description of what this file contains" },
      },
      required: ["title", "content", "format", "description"],
    },
  },
  {
    name: "create_code",
    description: "Create a code file as a project deliverable. Use for scripts, components, or any programming code.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "File name with extension (e.g. 'login.tsx', 'main.py')" },
        content: { type: "string", description: "The complete source code" },
        language: { type: "string", enum: ["typescript", "python", "javascript", "html", "css", "json", "rust", "go", "other"], description: "Programming language" },
        description: { type: "string", description: "What this code does" },
      },
      required: ["title", "content", "language", "description"],
    },
  },
];

// ============================================================
// Real API caller
// ============================================================
async function callLLM(
  provider: string,
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  tools?: any[]
) {
  const url = API_URLS[provider];
  if (!url) throw new Error(`Unknown provider: ${provider}`);

  if (provider === "anthropic") {
    const body: any = {
      model,
      max_tokens: 4096,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
    if (tools) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: {
          type: "object",
          properties: t.parameters.properties,
          required: t.parameters.required,
        },
      }));
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();

    // Check for tool use
    const toolBlocks = data.content?.filter((c: any) => c.type === "tool_use");
    const textBlocks = data.content?.filter((c: any) => c.type === "text");
    const text = textBlocks?.map((t: any) => t.text).join("\n") || "";
    const usage = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    return {
      text,
      toolCalls: toolBlocks?.map((t: any) => ({
        name: t.name,
        arguments: t.input,
      })) || [],
      usage,
    };
  }

  // OpenAI / DeepSeek / Qwen
  const body: any = {
    model,
    messages,
    max_tokens: 4096,
  };
  if (tools) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = "auto";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();

  const choice = data.choices?.[0];
  const message = choice?.message;
  const text = message?.content || "";
  const toolCalls = message?.tool_calls?.map((tc: any) => ({
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  })) || [];
  const usage = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

  return { text, toolCalls, usage };
}

// ============================================================
// Tool executor — actually creates files as deliverables
// ============================================================
async function executeTool(toolCall: { name: string; arguments: any }, projectId: string) {
  const args = toolCall.arguments;

  if (toolCall.name === "create_file") {
    const { title, content, format, description } = args;

    const deliverable = await prisma.deliverable.create({
      data: {
        projectId,
        title,
        description: description || "",
        fileUrl: `data:text/${format === "html" ? "html" : format === "json" ? "json" : format === "csv" ? "csv" : "markdown"};base64,${Buffer.from(content).toString("base64")}`,
        fileSize: Buffer.byteLength(content, "utf-8"),
        version: "1.0",
      },
    });

    return {
      success: true,
      message: `✅ Created file: "${title}.${format}" (${Buffer.byteLength(content, "utf-8")} bytes)`,
      deliverableId: deliverable.id,
      fileUrl: `/api/deliverables/${deliverable.id}/download`,
    };
  }

  if (toolCall.name === "create_code") {
    const { title, content, language, description } = args;

    const deliverable = await prisma.deliverable.create({
      data: {
        projectId,
        title,
        description: description || "",
        fileUrl: `data:text/plain;base64,${Buffer.from(content).toString("base64")}`,
        fileSize: Buffer.byteLength(content, "utf-8"),
        version: "1.0",
      },
    });

    return {
      success: true,
      message: `✅ Created ${language} file: "${title}" (${Buffer.byteLength(content, "utf-8")} bytes)`,
      deliverableId: deliverable.id,
      fileUrl: `/api/deliverables/${deliverable.id}/download`,
    };
  }

  return { success: false, message: `Unknown tool: ${toolCall.name}` };
}

// ============================================================
// Main POST handler
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, message } = body;

    if (!projectId || !message) {
      return NextResponse.json({ error: "Missing projectId or message" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Find any active API key
    const activeKey = await prisma.apiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeKey) {
      return NextResponse.json({
        text: `## ⚠️ 无法使用 AI Agent

当前平台上没有任何 API Key。AI Agent 需要至少一个 LLM API Key 才能运行。

**如何启用**：
1. 去 [DeepSeek 平台](https://platform.deepseek.com) 或 [OpenAI](https://platform.openai.com) 注册
2. 生成一个 API Key
3. 在你的 [仪表盘](/zh/dashboard) → API Keys → 添加 Key
4. 回到沙盒，Agent 即可使用

> 💰 DeepSeek 非常便宜，几块钱就能买上千万 token，足够完成大量任务。`,
        tokensUsed: 0,
        totalUsed: 0,
        remaining: project.tokenRaised,
        provider: project.llmProvider,
        model: project.llmModel,
        mode: "no-key",
      }, { status: 200 });
    }

    // === Run the Agent Loop ===
    const apiKey = decrypt(activeKey.encryptedKey);
    const provider = activeKey.provider;
    const model = project.llmModel;

    // System prompt
    const systemPrompt = `You are an AI Agent on TokenFund. Your job is to produce real files as deliverables.

When a user asks you to create something (a document, plan, code, report, etc.), you MUST use the "create_file" or "create_code" tool to actually generate a downloadable file. Do NOT just describe what you would do — actually create the file.

Rules:
- Use "create_file" for documents, reports, plans, articles (formats: md, html, txt, json, csv)
- Use "create_code" for code/scripts/components
- Create COMPLETE, useful content — not templates or placeholders
- After creating files, summarize what you made and how to use it
- Write in the same language the user used`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    let totalTokens = 0;
    const createdFiles: string[] = [];
    const MAX_LOOPS = 5;

    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const result = await callLLM(provider, model, apiKey, messages, TOOLS);
      totalTokens += result.usage;

      // If LLM returned tool calls, execute them
      if (result.toolCalls.length > 0) {
        for (const tc of result.toolCalls) {
          const execResult = await executeTool(tc, projectId);
          createdFiles.push(execResult.message);

          // Add tool result to conversation
          messages.push({
            role: "assistant",
            content: `[Used tool: ${tc.name} with args: ${JSON.stringify(tc.arguments)}]`,
          });
          messages.push({
            role: "user",
            content: `Tool result: ${execResult.message}`,
          });
        }
        continue; // Loop again so LLM can respond to tool results
      }

      // No more tool calls — return final response
      const usageTotal = await prisma.tokenUsage.aggregate({
        _sum: { amount: true },
        where: { projectId },
      });

      // Log token usage
      await prisma.tokenUsage.create({
        data: {
          projectId,
          amount: totalTokens,
          provider,
          model,
          purpose: message.slice(0, 200),
        },
      });

      const finalText = result.text +
        (createdFiles.length > 0
          ? `\n\n---\n### 📦 已创建的文件\n\n${createdFiles.map((f) => `- ${f}`).join("\n")}\n\n刷新页面后在「产出物」区域下载。`
          : "");

      return NextResponse.json({
        text: finalText,
        tokensUsed: totalTokens,
        totalUsed: (usageTotal._sum.amount || 0) + totalTokens,
        remaining: Math.max(0, project.tokenRaised - (usageTotal._sum.amount || 0) - totalTokens),
        provider,
        model,
        mode: "real",
        filesCreated: createdFiles.length,
      });
    }

    // Max loops reached
    return NextResponse.json({
      text: `⚠️ Agent 执行步骤过多（${MAX_LOOPS}步），已中断。已创建 ${createdFiles.length} 个文件。`,
      tokensUsed: totalTokens,
      mode: "real",
      filesCreated: createdFiles.length,
    });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({
      text: `## ❌ Agent 运行错误\n\n${error.message}\n\n请检查 API Key 是否有效，或稍后重试。`,
      tokensUsed: 0,
      mode: "error",
    }, { status: 200 });
  }
}
