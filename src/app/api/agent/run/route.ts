/**
 * Real AI Agent with Function Calling
 *
 * DeepSeek supports OpenAI-compatible tool/function calling.
 * When the LLM decides to create a file, the server actually executes
 * the tool — no fragile text parsing.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import * as Docx from "docx";

// ── Tool definitions (OpenAI/DeepSeek compatible) ──

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_document",
      description:
        "Generate a Word document (.docx) or other rich text document. " +
        "Use this when the user asks for a Word document, report, proposal, plan, contract, or any formatted document. " +
        "Each section can have a heading and body text. Supports headings, paragraphs, and bullet lists.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Document title / file name (without extension)",
          },
          sections: {
            type: "array",
            description: "Document sections",
            items: {
              type: "object",
              properties: {
                heading: {
                  type: "string",
                  description: "Section heading (heading level is auto-detected)",
                },
                body: {
                  type: "string",
                  description: "Full body text for this section. Supports newlines.",
                },
                list: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional bullet list items for this section",
                },
              },
              required: ["heading", "body"],
            },
          },
        },
        required: ["title", "sections"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_code_file",
      description:
        "Create a source code file. Use this for scripts, components, or any programming code.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "File name with extension (e.g. 'main.py', 'App.tsx')",
          },
          content: {
            type: "string",
            description: "The complete source code",
          },
          description: {
            type: "string",
            description: "Brief description of what the code does",
          },
        },
        required: ["filename", "content", "description"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_text_file",
      description:
        "Create a markdown, HTML, or plain text file. Use this for documentation, READMEs, articles, or formatted text output.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "File name with extension (.md, .html, .txt, .json, .csv)",
          },
          content: {
            type: "string",
            description: "Full file content",
          },
          description: {
            type: "string",
            description: "Brief description",
          },
        },
        required: ["filename", "content", "description"],
      },
    },
  },
];

// ── Tool executors (run on server, produce real files) ──

async function executeCreateDocument(
  args: { title: string; sections: Array<{ heading: string; body: string; list?: string[] }> },
  projectId: string
) {
  const children: Docx.Paragraph[] = [];

  // Title page heading
  children.push(
    new Docx.Paragraph({
      text: args.title,
      heading: Docx.HeadingLevel.TITLE,
      spacing: { after: 400 },
    })
  );

  for (const sec of args.sections) {
    // Section heading
    children.push(
      new Docx.Paragraph({
        text: sec.heading,
        heading: Docx.HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 150 },
      })
    );

    // Section body
    const paragraphs = sec.body.split("\n").filter((p) => p.trim());
    for (const p of paragraphs) {
      children.push(
        new Docx.Paragraph({
          text: p.trim(),
          spacing: { after: 120 },
        })
      );
    }

    // Bullet list
    if (sec.list && sec.list.length > 0) {
      for (const item of sec.list) {
        children.push(
          new Docx.Paragraph({
            text: item,
            bullet: { level: 0 },
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  const doc = new Docx.Document({
    sections: [{ properties: {}, children }],
  });

  const buffer = await Docx.Packer.toBuffer(doc);
  const base64 = buffer.toString("base64");

  const deliverable = await prisma.deliverable.create({
    data: {
      projectId,
      title: args.title + ".docx",
      description: "Word document generated by AI Agent",
      fileUrl: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," + base64,
      fileSize: buffer.length,
      version: "1.0",
    },
  });

  return {
    id: deliverable.id,
    title: deliverable.title,
    size: buffer.length,
  };
}

async function executeCreateCodeFile(
  args: { filename: string; content: string; description: string },
  projectId: string
) {
  const deliverable = await prisma.deliverable.create({
    data: {
      projectId,
      title: args.filename,
      description: args.description,
      fileUrl: "data:text/plain;charset=utf-8," + encodeURIComponent(args.content),
      version: "1.0",
    },
  });
  return { id: deliverable.id, title: deliverable.title, size: Buffer.byteLength(args.content) };
}

async function executeCreateTextFile(
  args: { filename: string; content: string; description: string },
  projectId: string
) {
  const ext = (args.filename.split(".").pop() || "md").toLowerCase();
  const mimeMap: Record<string, string> = {
    md: "text/markdown", html: "text/html", txt: "text/plain",
    json: "application/json", csv: "text/csv",
  };
  const mime = mimeMap[ext] || "text/plain";

  const deliverable = await prisma.deliverable.create({
    data: {
      projectId,
      title: args.filename,
      description: args.description,
      fileUrl: `data:${mime};charset=utf-8,${encodeURIComponent(args.content)}`,
      version: "1.0",
    },
  });
  return { id: deliverable.id, title: deliverable.title, size: Buffer.byteLength(args.content) };
}

// ── POST handler ──

export async function POST(request: NextRequest) {
  try {
    const { projectId, message } = await request.json();
    if (!projectId || !message) {
      return NextResponse.json({ error: "Missing projectId or message" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Find active API key
    const activeKey = await prisma.apiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeKey) {
      return NextResponse.json({
        text: "No API key. Add one in Dashboard → API Keys.",
        tokensUsed: 0, mode: "no-key", filesCreated: 0,
      });
    }

    const apiKey = decrypt(activeKey.encryptedKey);

    const systemPrompt =
      "你是 TokenFund AI Agent。用户的项目：\n" +
      `- 项目名: ${project.title}\n` +
      `- 简介: ${project.summary}\n\n` +
      "你有以下工具可用：\n" +
      "1. create_document — 生成 Word (.docx) 文档，用于报告、计划书、合同、方案等\n" +
      "2. create_code_file — 创建代码文件\n" +
      "3. create_text_file — 创建 Markdown/HTML/文本文件\n\n" +
      "规则：\n" +
      "- 用户要Word文档时必须调用 create_document\n" +
      "- 文档内容要完整、详细、专业。每个 section 的 body 要充实，不少于 100 字\n" +
      "- 先创建文件，再简短回复用户\n" +
      "- 用中文回复";

    // Agent loop — allow up to 3 turns
    const messages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    let totalTokens = 0;
    const createdFiles: string[] = [];
    let finalText = "";

    for (let turn = 0; turn < 3; turn++) {
      const llmRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          tools: TOOLS,
          tool_choice: turn === 0 ? "auto" : "none",
          max_tokens: 4096,
        }),
      });

      if (!llmRes.ok) {
        const err = await llmRes.text();
        throw new Error(`DeepSeek ${llmRes.status}: ${err.slice(0, 300)}`);
      }

      const llmData = await llmRes.json();
      const choice = llmData.choices?.[0];
      const llmMsg = choice?.message;

      totalTokens += (llmData.usage?.prompt_tokens || 0) + (llmData.usage?.completion_tokens || 0);

      // If LLM wants to call tools, execute them
      if (llmMsg?.tool_calls && llmMsg.tool_calls.length > 0) {
        // Record LLM's tool_call message
        messages.push(llmMsg);

        for (const tc of llmMsg.tool_calls) {
          const fnName = tc.function.name;
          const fnArgs = JSON.parse(tc.function.arguments);

          let toolResult: string;
          try {
            if (fnName === "create_document") {
              const r = await executeCreateDocument(fnArgs, projectId);
              toolResult = `✅ Word文档已生成: ${r.title} (${(r.size / 1024).toFixed(1)}KB)`;
              createdFiles.push(r.title);
            } else if (fnName === "create_code_file") {
              const r = await executeCreateCodeFile(fnArgs, projectId);
              toolResult = `✅ 代码文件已创建: ${r.title}`;
              createdFiles.push(r.title);
            } else if (fnName === "create_text_file") {
              const r = await executeCreateTextFile(fnArgs, projectId);
              toolResult = `✅ 文本文件已创建: ${r.title}`;
              createdFiles.push(r.title);
            } else {
              toolResult = `Unknown tool: ${fnName}`;
            }
          } catch (execErr: any) {
            toolResult = `工具执行失败: ${execErr.message}`;
          }

          // Add tool result
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
        // Continue loop to let LLM respond to tool output
        continue;
      }

      // No tool calls — this is the final response
      finalText = llmMsg?.content || "";
      break;
    }

    // Fallback: if no files created despite LLM being asked
    if (createdFiles.length === 0 && finalText) {
      const d = await prisma.deliverable.create({
        data: {
          projectId,
          title: "Agent-Response.md",
          description: "AI Agent response",
          fileUrl: "data:text/markdown;charset=utf-8," + encodeURIComponent(finalText),
          version: "1.0",
        },
      });
      createdFiles.push(d.title);
    }

    // Log usage
    await prisma.tokenUsage.create({
      data: {
        projectId,
        amount: totalTokens || 1,
        provider: activeKey.provider,
        model: "deepseek-chat",
        purpose: message.slice(0, 200),
      },
    });

    return NextResponse.json({
      text: finalText || "文件已生成，刷新页面查看。",
      tokensUsed: totalTokens,
      mode: "real",
      filesCreated: createdFiles.length,
      files: createdFiles,
    });
  } catch (e: any) {
    return NextResponse.json({
      text: `Agent 错误: ${e.message}`,
      tokensUsed: 0, mode: "error", filesCreated: 0,
    });
  }
}
