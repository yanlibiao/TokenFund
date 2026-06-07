/**
 * AI Agent — calls real LLM, creates real deliverable files
 *
 * Flow: User sends message → Agent calls LLM → LLM returns content + tool calls
 * → Agent executes tools (create_file) → stores in DB → returns to user
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

// ── LLM Call ──────────────────────────────────────────
async function callDeepSeek(
  apiKey: string,
  messages: { role: string; content: string }[],
) {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const text = msg?.content || "";
  const usage = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

  return { text, usage };
}

// ── POST /api/agent/run ──────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { projectId, message } = await request.json();
    if (!projectId || !message) {
      return NextResponse.json({ error: "Missing projectId or message" }, { status: 400 });
    }

    // 1. Get project (no status restriction — any project with tokens works)
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // 2. Find any active API key (from any user on the platform)
    const activeKey = await prisma.apiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeKey) {
      return NextResponse.json({
        text: `## ⚠️ 缺少 API Key\n\n平台上还没有任何 API Key。请去 [Dashboard](/zh/dashboard) → API Keys 添加一个。`,
        tokensUsed: 0, totalUsed: 0, remaining: project.tokenRaised,
        mode: "no-key", filesCreated: 0,
      });
    }

    // 3. Call LLM
    const apiKey = decrypt(activeKey.encryptedKey);
    const provider = activeKey.provider;

    const systemPrompt =
      "你是一个 AI Agent，负责为用户生成文档和代码。\n\n" +
      "用户的项目详情如下：\n" +
      `- 项目名称: ${project.title}\n` +
      `- 项目目标: ${project.summary}\n` +
      `- LLM 提供商: ${project.llmProvider} / ${project.llmModel}\n\n` +
      "请用 Markdown 格式回复。在回复末尾，用三个反引号括起来的 JSON 块来声明你要创建的文件：\n\n" +
      "```files\n" +
      '[\n  {"title":"文件名","format":"md|html|txt","content":"文件内容"},\n  {"title":"另一个文件","format":"md|html|txt","content":"文件内容"}\n]\n' +
      "```\n\n" +
      "用户说「生成Word文档」时，生成 .html 格式的文件（Word 可以打开 HTML）。\n" +
      "用户说「生成计划书」时，创建一个包含完整内容的 .md 文件。\n" +
      "用户说「生成代码」时，创建对应语言的 .txt 或 .md 文件。\n" +
      "每次对话必须至少创建一个文件。用中文回复。";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const result = await callDeepSeek(apiKey, messages);
    const { text, usage } = result;

    // 4. Parse files from response
    const filesCreated: string[] = [];
    const filesMatch = text.match(/```files\s*\n([\s\S]*?)\n```/);
    if (filesMatch) {
      try {
        const files = JSON.parse(filesMatch[1]);
        for (const file of files) {
          const deliverable = await prisma.deliverable.create({
            data: {
              projectId,
              title: file.title,
              description: file.format.toUpperCase() + " file",
              fileUrl: "data:text/" +
                (file.format === "html" ? "html" : "markdown") +
                ";charset=utf-8," +
                encodeURIComponent(file.content),
              version: "1.0",
            },
          });
          filesCreated.push(`${file.title}.${file.format} (已保存)`);
        }
      } catch (e) {
        // JSON parse failed — still return the text without files
        console.error("Failed to parse files JSON:", e);
      }
    }

    // 5. If no files parsed, create one from the full response
    if (filesCreated.length === 0 && text.trim()) {
      const isCode = message.includes("代码") || message.includes("code") || message.includes("脚本");
      const ext = isCode ? "txt" : "md";
      const title = isCode
        ? (message.replace(/[帮我给请生成写]/g, "").slice(0, 30).trim() || "code") + "." + ext
        : (message.replace(/[帮我给请生成写一份一个]/g, "").slice(0, 40).trim() || "document") + "." + ext;

      await prisma.deliverable.create({
        data: {
          projectId,
          title,
          description: "AI generated",
          fileUrl: "data:text/" +
            (ext === "txt" ? "plain" : "markdown") +
            ";charset=utf-8," +
            encodeURIComponent(text),
          version: "1.0",
        },
      });
      filesCreated.push(title + " (已保存)");
    }

    // 6. Log usage
    await prisma.tokenUsage.create({
      data: {
        projectId,
        amount: usage,
        provider: activeKey.provider,
        model: project.llmModel || "deepseek-chat",
        purpose: message.slice(0, 200),
      },
    });

    // 7. Clean up the ```files``` block from display text
    const cleanText = text.replace(/```files\s*\n[\s\S]*?\n```/g, "")
      + (filesCreated.length > 0
        ? `\n\n---\n### 📦 产出物\n\n${filesCreated.map(f => `- ✅ ${f}`).join("\n")}\n\n> 刷新页面后在「产出物」区域下载。`
        : "");

    return NextResponse.json({
      text: cleanText,
      tokensUsed: usage,
      totalUsed: usage,
      remaining: Math.max(0, project.tokenRaised - usage),
      provider: activeKey.provider,
      model: project.llmModel,
      mode: "real",
      filesCreated: filesCreated.length,
    });
  } catch (error: any) {
    console.error("Agent error:", error);
    const msg = error.message?.includes("402") || error.message?.includes("401")
      ? "API Key 无效或余额不足，请检查"
      : error.message?.includes("429")
        ? "API 请求太频繁，请稍后重试"
        : "Agent 运行错误: " + (error.message || "Unknown");

    return NextResponse.json({
      text: `## ❌ ${msg}`,
      tokensUsed: 0, mode: "error", filesCreated: 0,
    });
  }
}
