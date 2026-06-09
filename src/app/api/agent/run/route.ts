export const dynamic = "force-dynamic";
export const maxDuration = 180;

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { createSandbox, type Sandbox } from "@/lib/e2b";
import { auth } from "@/lib/auth";

const MODEL = process.env.AGENT_MODEL || "gpt-5.5";
const API_URL = process.env.AGENT_API_URL || "https://kuaipao.ai/v1/chat/completions";
const DEFAULT_GENERATE_TIMEOUT_MS = 55_000;
const LONG_GENERATE_TIMEOUT_MS = 90_000;
const DEFAULT_EXECUTION_BUDGET_MS = 45_000;
const LONG_EXECUTION_BUDGET_MS = 75_000;
const POLL_MS = 1_500;

const SYSTEM_PROMPT = `You are TokenFund Agent, a careful automation engineer.
Write ONE complete Python script that completes the user's task inside an E2B Linux sandbox.

Rules:
- Output only Python code. No markdown fences, no explanation.
- Start with: import subprocess, sys, os
- Add: os.chdir("/home/user")
- Print visible progress often, at least once every major step.
- Prefix major steps exactly like: TF_STEP 1/4: short description
- Install only missing packages and keep installs minimal.
- Write all final files to /home/user.
- Verify every final file with size and print: TF_FILE filename size_bytes
- End with: TF_DONE ok
- On error, catch exceptions, print traceback, then print TF_DONE failed.
- Prefer robust, deterministic code over clever code.
- If the task is ambiguous, make a sensible MVP deliverable instead of asking questions.`;

type StreamEvent = Record<string, unknown>;

function cleanScript(content: string) {
  return content.replace(/^```(?:python)?\n?/i, "").replace(/\n?```$/i, "").trim();
}

function scriptPreview(script: string) {
  const lines = script.split(/\r?\n/);
  return lines.slice(0, 80).join("\n");
}

function isExportableFile(file: { name: string; type?: string }) {
  if (file.type !== "file") return false;
  if (file.name.startsWith(".")) return false;
  return !new Set([
    ".bashrc",
    ".bash_logout",
    ".profile",
    ".cache",
    ".config",
    ".bash_history",
    ".python_history",
    "main.py",
  ]).has(file.name);
}

function mimeFor(filename: string) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    html: "text/html",
  };
  return mimeMap[ext] || "application/octet-stream";
}

function runProfile(message: string) {
  const lower = message.toLowerCase();
  const fileMentions = (message.match(/\.(csv|xlsx|docx|pptx|pdf|png|jpg|md|html|json|py)\b/gi) || []).length;
  const stepWords = (message.match(/step|first|second|third|第四|第五|第六|步骤|然后|最后/gi) || []).length;
  const reportWords = ["report", "analysis", "chart", "docx", "excel", "word", "matplotlib", "数据", "报告", "图表"]
    .filter((word) => lower.includes(word.toLowerCase())).length;
  const score = message.length + fileMentions * 300 + stepWords * 120 + reportWords * 180;
  const isLong = score > 1200;
  return {
    isLong,
    generateTimeoutMs: isLong ? LONG_GENERATE_TIMEOUT_MS : DEFAULT_GENERATE_TIMEOUT_MS,
    executionBudgetMs: isLong ? LONG_EXECUTION_BUDGET_MS : DEFAULT_EXECUTION_BUDGET_MS,
    maxTokens: isLong ? 16000 : 10000,
  };
}

function agentErrorMessage(error: unknown, profile: ReturnType<typeof runProfile>) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return profile.isLong
      ? "Script generation timed out in long-run mode. The task is likely too broad for one request; split it into data generation, charts, then report."
      : "Script generation timed out. Try a more concrete task or fewer deliverables.";
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "The model request was aborted before a script was generated. Try again, or split the task into smaller steps.";
  }
  return error instanceof Error ? error.message : "Agent run failed.";
}

export async function POST(request: NextRequest) {
  let sandbox: Sandbox | null = null;

  const stream = new ReadableStream({
    async start(ctrl) {
      const encoder = new TextEncoder();
      const send = (event: StreamEvent) => {
        try {
          ctrl.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {}
      };
      const fail = (message: string) => {
        send({ type: "error", message, done: true });
        ctrl.close();
      };

      try {
        const startedAt = Date.now();
        const session = await auth();
        const { projectId, message } = await request.json();

        if (!session?.user?.id) return fail("Please sign in before running the agent.");
        if (!projectId || !message || typeof message !== "string") return fail("Bad request.");
        const profile = runProfile(message);

        send({ type: "phase", phase: "prepare", message: "Preparing agent run" });
        send({
          type: "plan",
          tasks: [
            { id: "1", title: "Validate project and credentials" },
            { id: "2", title: "Generate a single executable script" },
            { id: "3", title: "Run inside E2B sandbox with live logs" },
            { id: "4", title: "Export deliverables" },
          ],
        });

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return fail("Project not found.");

        let apiKey = process.env.KUAIPAO_API_KEY || "";
        let keySource = "server";
        if (!apiKey) {
          const activeKey = await prisma.apiKey.findFirst({
            where: { userId: session.user.id, isActive: true },
            orderBy: { createdAt: "desc" },
          });
          if (activeKey) {
            apiKey = decrypt(activeKey.encryptedKey);
            keySource = activeKey.provider;
          }
        }
        if (!apiKey) return fail("Missing API key. Add one in Dashboard or set KUAIPAO_API_KEY.");
        if (!process.env.E2B_API_KEY) return fail("Missing E2B_API_KEY. Configure E2B before running the agent.");

        send({ type: "task_done", id: "1" });
        send({ type: "metric", label: "keySource", value: keySource });
        send({ type: "metric", label: "runMode", value: profile.isLong ? "long" : "standard" });
        send({ type: "metric", label: "genTimeout", value: `${Math.round(profile.generateTimeoutMs / 1000)}s` });

        send({ type: "phase", phase: "generate", message: `Generating script with ${MODEL}` });
        send({ type: "task_start", id: "2" });

        let generationHeartbeat: ReturnType<typeof setInterval> | undefined;
        let genRes: Response;
        try {
          let tick = 0;
          generationHeartbeat = setInterval(() => {
            tick += 1;
            send({ type: "heartbeat", message: `Generating script for ${tick * 8}s` });
          }, 8000);

          genRes = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: message.slice(0, 6000) },
              ],
              max_tokens: profile.maxTokens,
              temperature: 0,
            }),
            signal: AbortSignal.timeout(profile.generateTimeoutMs),
          });
        } catch (e) {
          send({ type: "task_fail", id: "2" });
          return fail(agentErrorMessage(e, profile));
        } finally {
          if (generationHeartbeat) clearInterval(generationHeartbeat);
        }

        if (!genRes.ok) {
          const err = await genRes.text();
          send({ type: "task_fail", id: "2" });
          return fail(`Model API ${genRes.status}: ${err.slice(0, 240)}`);
        }

        const genData = await genRes.json();
        const script = cleanScript(genData.choices?.[0]?.message?.content || "");
        const genTokens = (genData.usage?.prompt_tokens || 0) + (genData.usage?.completion_tokens || 0);

        if (!script.includes("os.chdir") || script.length < 80) {
          send({ type: "task_fail", id: "2" });
          return fail("Model returned an invalid script. Try a more concrete task.");
        }

        send({ type: "script", chars: script.length, preview: scriptPreview(script) });
        send({ type: "metric", label: "tokens", value: genTokens });
        send({ type: "task_done", id: "2" });

        send({ type: "phase", phase: "execute", message: "Starting E2B sandbox" });
        send({ type: "task_start", id: "3" });
        send({ type: "metric", label: "execBudget", value: `${Math.round(profile.executionBudgetMs / 1000)}s` });
        sandbox = await createSandbox();
        send({ type: "metric", label: "sandbox", value: sandbox.sandboxId });

        await sandbox.files.write("/home/user/main.py", script);
        await sandbox.commands.run("cd /home/user && python3 -u main.py > /tmp/out.log 2>&1", {
          background: true,
          timeoutMs: 300_000,
        });

        let lastSize = 0;
        let idleTicks = 0;
        const executeStartedAt = Date.now();
        while (Date.now() - executeStartedAt < profile.executionBudgetMs) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          let out = "";
          try {
            out = await sandbox.files.read("/tmp/out.log", { format: "text" });
          } catch {
            idleTicks++;
          }

          if (out.length > lastSize) {
            idleTicks = 0;
            const newContent = out.slice(lastSize);
            for (const line of newContent.split(/\r?\n/)) {
              const text = line.trim();
              if (!text) continue;
              if (text.startsWith("TF_STEP")) send({ type: "step", message: text.replace(/^TF_STEP\s*/, "") });
              else if (text.startsWith("TF_FILE")) send({ type: "file_log", message: text.replace(/^TF_FILE\s*/, "") });
              else if (text.startsWith("TF_DONE")) send({ type: "runtime_status", message: text.replace(/^TF_DONE\s*/, "") });
              else send({ type: "log", log: text.slice(0, 500) });
            }
            lastSize = out.length;
          } else {
            idleTicks++;
            if (idleTicks === 4 || idleTicks === 10 || idleTicks === 18) {
              send({ type: "heartbeat", message: `Still running, no new output for ${idleTicks * (POLL_MS / 1000)}s` });
            }
          }

          if (out.includes("TF_DONE ok") || out.includes("OK ALL DONE")) break;
          if (out.includes("TF_DONE failed") || out.includes("Traceback (most recent call last)")) break;
        }

        if (Date.now() - executeStartedAt >= profile.executionBudgetMs) {
          send({ type: "warning", message: "Execution time budget reached. Exporting files produced so far." });
        }
        send({ type: "task_done", id: "3" });

        send({ type: "phase", phase: "export", message: "Exporting deliverables" });
        send({ type: "task_start", id: "4" });
        const files = await sandbox.files.list("/home/user");
        const exported: string[] = [];

        for (const file of files) {
          if (!isExportableFile(file)) continue;
          try {
            const bytes = await sandbox.files.read(`/home/user/${file.name}`, { format: "bytes" });
            const b64 = Buffer.from(bytes).toString("base64");
            const mime = mimeFor(file.name);
            const url = `data:${mime};base64,${b64}`;
            await prisma.deliverable.create({
              data: {
                projectId,
                title: file.name,
                description: "TokenFund Agent",
                fileUrl: url,
                fileSize: bytes.length,
                version: "1.0",
              },
            });
            exported.push(file.name);
            send({ type: "file", name: file.name, size: bytes.length });
          } catch (e) {
            const detail = e instanceof Error ? e.message : "export failed";
            send({ type: "warning", message: `${file.name}: ${detail.slice(0, 120)}` });
          }
        }

        await prisma.tokenUsage.create({
          data: {
            projectId,
            amount: genTokens || 1,
            provider: keySource,
            model: MODEL,
            purpose: message.slice(0, 200),
          },
        });

        send({ type: "task_done", id: "4" });
        await sandbox.kill();
        sandbox = null;

        send({
          done: true,
          filesCreated: exported.length,
          files: exported,
          tokensUsed: genTokens,
          elapsedMs: Date.now() - startedAt,
          text: exported.length > 0 ? "Task finished with deliverables." : "Run finished, but no deliverable files were produced.",
        });
        ctrl.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Agent run failed.";
        send({ type: "error", message, done: true });
        ctrl.close();
      } finally {
        if (sandbox) {
          try {
            await sandbox.kill();
          } catch {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
