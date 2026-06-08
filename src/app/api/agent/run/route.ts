/**
 * TokenFund AI Agent v2 — E2B Cloud Sandbox
 *
 * Architecture:
 *   User Task → Create E2B Sandbox → Agent Loop (LLM plans + calls tools)
 *   → Execute tools in sandbox (write file, run cmd, install pkg)
 *   → Feed results back to LLM → Iterate until done
 *   → Export deliverables → Kill sandbox → Return to user
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { createSandbox, type Sandbox } from "@/lib/e2b";

// ── Tool definitions (OpenAI/DeepSeek function calling format) ──

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description:
        "Write content to a file in the sandbox. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path, e.g. /home/user/main.py" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description: "Execute a shell command in the sandbox. Returns stdout, stderr, and exit code.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout_ms: { type: "number", description: "Optional timeout in ms (default 60000)" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the contents of a file in the sandbox.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_dir",
      description: "List files and directories at a given path.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path, e.g. /home/user/" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "task_done",
      description:
        "Call this when the task is complete. Provide a summary and list of output files.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Summary of what was accomplished" },
          output_files: {
            type: "array",
            items: { type: "string" },
            description: "List of file paths that represent the final deliverables",
          },
        },
        required: ["summary", "output_files"],
      },
    },
  },
];

// ── System prompt ──

const SYSTEM_PROMPT = `
You are an AI Agent running in a Linux sandbox. You have real tools to write files, run commands, and install packages.

YOUR CAPABILITIES:
- Write any file (code, config, documentation, data)
- Run shell commands (compile, execute, test, build)
- Install packages (pip, npm, apt-get)
- Read files to check output
- List directories to see your workspace

RULES:
1. Break tasks into steps: write code → run it → check output → fix errors → retry
2. Install dependencies before running code (pip install, npm install, etc.)
3. When code fails, read the error, fix the file, and re-run
4. Create COMPLETE working projects, not templates
5. If a command hangs or takes too long, try a different approach
6. When the task is complete, call task_done with a summary and list of output files
7. Work in /home/user/ directory

Answer in the user's language. Be concise — focus on DOING, not describing.
`;

// ── Tool executors ──

async function executeWriteFile(sandbox: Sandbox, args: { path: string; content: string }) {
  await sandbox.files.write(args.path, args.content);
  return `File written: ${args.path} (${args.content.length} chars)`;
}

async function executeRunCommand(sandbox: Sandbox, args: { command: string; timeout_ms?: number }) {
  const timeout = args.timeout_ms || 60000;
  const startTime = Date.now();

  try {
    const result = await sandbox.commands.run(args.command, {
      timeoutMs: timeout,
    });

    const elapsed = Date.now() - startTime;
    const stdout = (result.stdout || "").slice(0, 4000);
    const stderr = (result.stderr || "").slice(0, 2000);
    const exitCode = result.exitCode;

    let output = `Exit code: ${exitCode} (${elapsed}ms)\n`;
    if (stdout) output += `STDOUT:\n${stdout}\n`;
    if (stderr) output += `STDERR:\n${stderr}\n`;
    if (!stdout && !stderr) output += "(no output)\n";

    return output;
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    return `Command failed after ${elapsed}ms: ${err.message}`;
  }
}

async function executeReadFile(sandbox: Sandbox, args: { path: string }) {
  try {
    const content = await sandbox.files.read(args.path, { format: "text" });
    return content.slice(0, 5000) || "(empty file)";
  } catch (err: any) {
    return `Error reading ${args.path}: ${err.message}`;
  }
}

async function executeListDir(sandbox: Sandbox, args: { path: string }) {
  try {
    const entries = await sandbox.files.list(args.path);
    return entries.map((e: any) => `${e.isDir ? "📁" : "📄"} ${e.name}`).join("\n") || "(empty)";
  } catch (err: any) {
    return `Error listing ${args.path}: ${err.message}`;
  }
}

// ── Main POST handler ──

export async function POST(request: NextRequest) {
  let sandbox: Sandbox | null = null;

  try {
    const { projectId, message } = await request.json();
    if (!projectId || !message) {
      return NextResponse.json({ error: "Missing projectId or message" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Find API key
    const activeKey = await prisma.apiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeKey) {
      return NextResponse.json({
        text: "No API key configured. Add one in Dashboard.",
        mode: "no-key", logs: [],
      });
    }

    const apiKey = decrypt(activeKey.encryptedKey);

    // ── Create sandbox ──
    sandbox = await createSandbox();
    const createdLogs: string[] = [
      `🚀 Sandbox created: ${sandbox.sandboxId}`,
      `📋 Task: ${message}`,
      "",
    ];

    // ── Agent loop ──
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ];

    let totalTokens = 0;
    let taskDone = false;
    let finalSummary = "";
    let outputFiles: string[] = [];
    const MAX_TURNS = 15;

    for (let turn = 0; turn < MAX_TURNS && !taskDone; turn++) {
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
          tool_choice: "auto",
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

      // If LLM just talks without tool calls, push message and continue
      if (!llmMsg?.tool_calls || llmMsg.tool_calls.length === 0) {
        if (llmMsg?.content) {
          createdLogs.push(`💬 [Turn ${turn + 1}] ${llmMsg.content.slice(0, 200)}`);
          messages.push({ role: "assistant", content: llmMsg.content });
        }
        continue;
      }

      // Process each tool call
      messages.push(llmMsg); // Push assistant message with tool_calls

      for (const tc of llmMsg.tool_calls) {
        const fnName = tc.function.name;
        const fnArgs = JSON.parse(tc.function.arguments);
        const callId = tc.id;

        createdLogs.push(
          `🔧 [Turn ${turn + 1}] ${fnName}(${JSON.stringify(fnArgs).slice(0, 100)}${JSON.stringify(fnArgs).length > 100 ? "..." : ""})`
        );

        let result: string;
        try {
          switch (fnName) {
            case "write_file":
              result = await executeWriteFile(sandbox, fnArgs);
              break;
            case "run_command":
              result = await executeRunCommand(sandbox, fnArgs);
              break;
            case "read_file":
              result = await executeReadFile(sandbox, fnArgs);
              break;
            case "list_dir":
              result = await executeListDir(sandbox, fnArgs);
              break;
            case "task_done":
              finalSummary = fnArgs.summary;
              outputFiles = fnArgs.output_files || [];
              taskDone = true;
              result = "Task marked as done.";
              break;
            default:
              result = `Unknown tool: ${fnName}`;
          }
        } catch (execErr: any) {
          result = `Tool execution error: ${execErr.message}`;
        }

        createdLogs.push(result.slice(0, 300));

        // Add tool result message
        messages.push({
          role: "tool",
          tool_call_id: callId,
          content: result,
        });
      }

      if (taskDone) break;
    }

    if (!taskDone) {
      createdLogs.push(`⚠️ Reached max turns (${MAX_TURNS}).`);
    }

    // ── Export deliverables to project ──
    const createdFiles: string[] = [];
    for (const filePath of outputFiles) {
      try {
        const content = await sandbox.files.read(filePath, { format: "text" });
        const name = filePath.split("/").pop() || "output";

        await prisma.deliverable.create({
          data: {
            projectId,
            title: name,
            description: "Generated by AI Agent in E2B sandbox",
            fileUrl: "data:text/plain;charset=utf-8," + encodeURIComponent(content),
            version: "1.0",
          },
        });
        createdFiles.push(name);
        createdLogs.push(`📦 Saved deliverable: ${name}`);
      } catch (e) {
        createdLogs.push(`⚠️ Could not export ${filePath}`);
      }
    }

    // ── Log usage ──
    await prisma.tokenUsage.create({
      data: {
        projectId,
        amount: totalTokens || 1,
        provider: activeKey.provider,
        model: "deepseek-chat",
        purpose: message.slice(0, 200),
      },
    });

    // ── Kill sandbox ──
    await sandbox.kill();
    sandbox = null;

    return NextResponse.json({
      text: finalSummary || (createdFiles.length > 0
        ? `Task completed. ${createdFiles.length} file(s) created.`
        : "Agent finished. Check logs for details."),
      logs: createdLogs,
      tokensUsed: totalTokens,
      mode: "e2b-sandbox",
      filesCreated: createdFiles.length,
      files: createdFiles,
    });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({
      text: `Agent error: ${error.message}`,
      logs: [`❌ ${error.message}`],
      tokensUsed: 0,
      mode: "error",
      filesCreated: 0,
    });
  } finally {
    // Safety: always kill sandbox
    if (sandbox) {
      try { await sandbox.kill(); } catch {}
    }
  }
}
