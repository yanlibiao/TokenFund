// LLM Agent Proxy — routes calls to real LLM APIs using pooled project tokens
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

// Approximate token counts for different providers
function estimateInputTokens(text: string): number {
  // Rough: ~4 chars per token for English, ~2 for Chinese
  let total = 0;
  for (const ch of text) {
    total += /[\x00-\x7F]/.test(ch) ? 0.25 : 0.5;
  }
  return Math.ceil(total);
}

const PROVIDER_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
};

async function callLLM(
  provider: string,
  model: string,
  message: string,
  apiKey: string
): Promise<{ text: string; tokensUsed: number }> {
  const url = PROVIDER_URLS[provider];
  if (!url) throw new Error(`Unknown provider: ${provider}`);

  const inputTokens = estimateInputTokens(message);

  let body: any;
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: message }],
    };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    const outputText = data.content?.[0]?.text || "";
    const outputTokens = data.usage?.output_tokens || estimateInputTokens(outputText);
    return { text: outputText, tokensUsed: inputTokens + outputTokens };
  }

  if (provider === "qwen") {
    // Qwen uses compatible mode with OpenAI format
    body = {
      model,
      messages: [{ role: "user", content: message }],
      max_tokens: 4096,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Qwen API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    const outputText = data.choices?.[0]?.message?.content || "";
    const outputTokens = data.usage?.completion_tokens || estimateInputTokens(outputText);
    const realInputTokens = data.usage?.prompt_tokens || inputTokens;
    return { text: outputText, tokensUsed: realInputTokens + outputTokens };
  }

  // OpenAI & DeepSeek (both use OpenAI-compatible format)
  body = {
    model,
    messages: [{ role: "user", content: message }],
    max_tokens: 4096,
  };
  headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${provider} API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const outputText = data.choices?.[0]?.message?.content || "";
  const outputTokens = data.usage?.completion_tokens || estimateInputTokens(outputText);
  const realInputTokens = data.usage?.prompt_tokens || inputTokens;
  return { text: outputText, tokensUsed: realInputTokens + outputTokens };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, message, provider, model } = body;

    if (!projectId || !message) {
      return NextResponse.json(
        { error: "Missing projectId or message" },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "IN_PROGRESS" && project.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Project has not reached funding goal yet" },
        { status: 400 }
      );
    }

    const useProvider = provider || project.llmProvider;
    const useModel = model || project.llmModel;

    // Check remaining tokens
    const usedTokens = await prisma.tokenUsage.aggregate({
      _sum: { amount: true },
      where: { projectId },
    });
    const totalUsed = usedTokens._sum.amount || 0;
    const remaining = project.tokenRaised - totalUsed;

    if (remaining <= 0) {
      return NextResponse.json(
        { error: "Project has no tokens remaining" },
        { status: 400 }
      );
    }

    // Call the LLM
    let result: { text: string; tokensUsed: number };
    try {
      // For demo/sandbox: try to use any available API key for this provider
      // In production, use the project's allocated keys
      const apiKeyRecord = await prisma.apiKey.findFirst({
        where: { provider: useProvider, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      if (!apiKeyRecord) {
        // No API key available — return a simulated response for demo
        const simTokens = estimateInputTokens(message) * 2;
        result = {
          text: `[Sandbox Mode] No API key configured for ${useProvider}.\n\nYour message: "${message.slice(0, 200)}"\n\nThis is a simulated response. To enable real AI, add a ${useProvider} API key in your dashboard.\n\nEstimated tokens that would be used: ~${simTokens}`,
          tokensUsed: simTokens,
        };
      } else {
        const decryptedKey = decrypt(apiKeyRecord.encryptedKey);
        result = await callLLM(useProvider, useModel, message, decryptedKey);
      }
    } catch (err: any) {
      console.error("LLM call failed:", err.message);
      return NextResponse.json(
        { error: `LLM call failed: ${err.message}` },
        { status: 500 }
      );
    }

    // Log token usage
    await prisma.tokenUsage.create({
      data: {
        projectId,
        amount: result.tokensUsed,
        provider: useProvider,
        model: useModel,
        purpose: message.slice(0, 200),
      },
    });

    // Get updated stats
    const updatedUsage = await prisma.tokenUsage.aggregate({
      _sum: { amount: true },
      where: { projectId },
    });
    const updatedTotalUsed = updatedUsage._sum.amount || 0;
    const updatedRemaining = project.tokenRaised - updatedTotalUsed;

    return NextResponse.json({
      text: result.text,
      tokensUsed: result.tokensUsed,
      totalUsed: updatedTotalUsed,
      remaining: updatedRemaining,
      provider: useProvider,
      model: useModel,
    });
  } catch (error) {
    console.error("Agent proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
