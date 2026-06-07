import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const { projectId, message } = await request.json();
    if (!projectId || !message) {
      return NextResponse.json({ error: "Missing projectId or message" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const activeKey = await prisma.apiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeKey) {
      return NextResponse.json({
        text: "No API key configured. Add one in Dashboard.",
        tokensUsed: 0, mode: "no-key", filesCreated: 0,
      });
    }

    const apiKey = decrypt(activeKey.encryptedKey);

    const systemPrompt =
      `你是 AI Agent。用户说"${message}"。\n\n` +
      "规则：\n" +
      "1. 先简短回复用户（1-2句话）\n" +
      "2. 然后用 ```files 代码块输出你创建的文件：\n" +
      "```files\n[{\"title\":\"文件名\",\"format\":\"md|html|txt\",\"content\":\"完整文件内容\"}]\n```\n" +
      "3. 用户要Word文档时，生成 .html 格式（Word可直接打开HTML）\n" +
      "4. 必须至少创建1个文件。文件内容要完整，不要用省略号。用中文回复。";

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({
        text: `API 错误: ${res.status}`,
        tokensUsed: 0, mode: "error", filesCreated: 0,
      });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const usage = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

    // Parse files from ```files block
    const filesCreated: string[] = [];
    const filesMatch = text.match(/```files\s*\n([\s\S]*?)\n```/);
    if (filesMatch) {
      try {
        const files = JSON.parse(filesMatch[1]);
        for (const file of files) {
          await prisma.deliverable.create({
            data: {
              projectId,
              title: file.title,
              description: file.format?.toUpperCase() || "File",
              fileUrl: "data:text/" +
                (file.format === "html" ? "html" : "markdown") +
                ";charset=utf-8," +
                encodeURIComponent(file.content),
              version: "1.0",
            },
          });
          filesCreated.push(file.title);
        }
      } catch (e) {
        console.error("Parse files error:", e);
      }
    }

    // Fallback: if no files parsed, create one from full response
    if (filesCreated.length === 0 && text.trim()) {
      const title = "AI-Generated-Document.md";
      await prisma.deliverable.create({
        data: {
          projectId,
          title,
          description: "AI generated document",
          fileUrl: "data:text/markdown;charset=utf-8," + encodeURIComponent(text),
          version: "1.0",
        },
      });
      filesCreated.push(title);
    }

    await prisma.tokenUsage.create({
      data: {
        projectId,
        amount: usage,
        provider: activeKey.provider,
        model: "deepseek-chat",
        purpose: message.slice(0, 200),
      },
    });

    const cleanText = text.replace(/```files\s*\n[\s\S]*?\n```/g, "");

    return NextResponse.json({
      text: cleanText + (filesCreated.length > 0
        ? `\n\n---\n### 📦 已创建 ${filesCreated.length} 个文件：\n${filesCreated.map(f => `- ✅ ${f}`).join("\n")}\n刷新页面后在产出物区下载。`
        : ""),
      tokensUsed: usage,
      mode: "real",
      filesCreated: filesCreated.length,
    });
  } catch (e: any) {
    return NextResponse.json({
      text: `错误: ${e.message}`,
      tokensUsed: 0, mode: "error", filesCreated: 0,
    });
  }
}
