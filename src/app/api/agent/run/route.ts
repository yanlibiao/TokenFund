/**
 * TokenFund Agent — Simple & Reliable
 *
 * Strategy: Ask DeepSeek to write ONE complete Python script.
 * Upload → Run → If fails, show error → Retry once.
 * No function calling loops. No open-interpreter. Just code generation.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { createSandbox, type Sandbox } from "@/lib/e2b";

const SYSTEM = `You are a Python programmer. Write ONE complete, self-contained Python script that accomplishes ALL steps of the user's task.

CRITICAL RULES:
- Output ONLY valid Python code, nothing else
- NO markdown code blocks (\`\`\`), NO explanations — just raw Python
- Use os.chdir("/home/user") at the top
- Print progress with print("=== STEP N ===", flush=True)
- Install packages with subprocess.run([sys.executable,"-m","pip","install","-q",pkg])
- matplotlib: use matplotlib.use("Agg") before import
- Word docs: from docx import Document
- Chrome: use subprocess to install chromium if needed
- All output files go to /home/user/
- Verify each file exists with os.path.getsize() and print the size
- End with print("OK ALL DONE", flush=True)
- Handle ALL errors with try/except, print traceback on failure

START YOUR RESPONSE WITH: import subprocess, sys, os`;

export async function POST(request: NextRequest) {
  let sandbox: Sandbox | null = null;
  const stream = new ReadableStream({
    async start(ctrl) {
      const S = (d: any) => { try { ctrl.enqueue(new TextEncoder().encode(JSON.stringify(d)+"\n")); } catch {} };
      try {
        const { projectId, message } = await request.json();
        if (!projectId || !message) { S({error:"Bad request"}); ctrl.close(); return; }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { S({error:"Project not found"}); ctrl.close(); return; }

        const activeKey = await prisma.apiKey.findFirst({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
        if (!activeKey) { S({error:"No API key"}); ctrl.close(); return; }
        const apiKey = decrypt(activeKey.encryptedKey);

        // ── Sandbox ──
        S({log:"🚀 启动..."});
        sandbox = await createSandbox();
        S({log:"✅ " + sandbox.sandboxId});

        // ── Generate script ──
        S({log:"🧠 生成执行脚本..."});

        const genRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method:"POST",
          headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
          body:JSON.stringify({
            model:"deepseek-chat",
            messages:[
              {role:"system",content:SYSTEM},
              {role:"user",content:message}
            ],
            max_tokens:16384,
            temperature:0,
          }),
          signal:AbortSignal.timeout(180000),
        });

        if (!genRes.ok) { S({log:`❌ API ${genRes.status}`}); ctrl.close(); return; }
        const genData = await genRes.json();
        let script = genData.choices?.[0]?.message?.content||"";
        // Clean markdown if present
        if (script.startsWith("```")) {
          script = script.replace(/```python\n?/g,"").replace(/```\n?/g,"").trim();
        }
        S({log:`📝 脚本 ${script.length} 字符`});

        // ── Execute ──
        S({log:"▶️ 执行..."});
        await sandbox.files.write("/home/user/main.py", script);

        let output = "";
        const handle = await sandbox.commands.run(
          "cd /home/user && python3 -u main.py",
          { background: true, timeoutMs: 300000 }
        );

        let buf = "";
        const conn = await sandbox.commands.connect(handle.pid, {
          onStdout: (d:string) => {
            buf += d;
            const lines = buf.split("\n"); buf = lines.pop()||"";
            for (const l of lines) { const t = l.trim(); if (t) { S({log:t.slice(0,400)}); output += t+"\n"; } }
          },
          onStderr: (d:string) => {
            const t = d.trim();
            if (t && !t.includes("[IPKernel")) { S({log:"⚠️ "+t.slice(0,300)}); output += "ERR: "+t+"\n"; }
          },
        });
        const runResult = await conn.wait();
        if (buf.trim()) { S({log:buf.trim().slice(0,400)}); output += buf; }

        let totalTokens = (genData.usage?.prompt_tokens||0)+(genData.usage?.completion_tokens||0);

        // ── Retry on failure ──
        if (runResult.exitCode !== 0) {
          S({log:`⚠️ 脚本失败 (exit ${runResult.exitCode})，让 AI 修复...`});

          const fixRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method:"POST",
            headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
            body:JSON.stringify({
              model:"deepseek-chat",
              messages:[
                {role:"system",content:SYSTEM},
                {role:"user",content:message},
                {role:"assistant",content:script.slice(0,6000)},
                {role:"user",content:`This script failed with exit code ${runResult.exitCode}.\n\nOutput:\n${output.slice(-4000)}\n\nPlease fix the script. Output ONLY the corrected Python code.`}
              ],
              max_tokens:16384,
              temperature:0.1,
            }),
            signal:AbortSignal.timeout(120000),
          });

          if (fixRes.ok) {
            const fixData = await fixRes.json();
            let fixScript = fixData.choices?.[0]?.message?.content||"";
            if (fixScript.startsWith("```")) fixScript = fixScript.replace(/```python\n?/g,"").replace(/```\n?/g,"").trim();
            totalTokens += (fixData.usage?.prompt_tokens||0)+(fixData.usage?.completion_tokens||0);

            S({log:"🔄 运行修复版..."});
            await sandbox.files.write("/home/user/main.py", fixScript);
            const h2 = await sandbox.commands.run("cd /home/user && python3 -u main.py", { background: true, timeoutMs: 300000 });
            let b2 = "";
            const c2 = await sandbox.commands.connect(h2.pid, {
              onStdout: (d:string) => { b2+=d; const ls=b2.split("\n");b2=ls.pop()||""; for(const l of ls){const t=l.trim();if(t)S({log:t.slice(0,400)});} },
              onStderr: (d:string) => { const t=d.trim();if(t&&!t.includes("[IPKernel"))S({log:"⚠️ "+t.slice(0,300)}); },
            });
            const r2 = await c2.wait();
            if (b2.trim()) S({log:b2.trim().slice(0,400)});
            if (r2.exitCode !== 0) S({log:`⚠️ 修复后仍失败`});
          }
        }

        // ── Export ──
        S({log:"\n📦 导出..."});
        const files = await sandbox.files.list("/home/user");
        const skip = new Set([".bashrc",".bash_logout",".profile",".cache",".config",".bash_history",".python_history","main.py"]);
        const exported: string[] = [];

        for (const f of files) {
          if (skip.has(f.name)||f.type!=="file") continue;
          try {
            const fp="/home/user/"+f.name;
            // Always read as bytes to avoid encoding corruption
            const bytes = await sandbox.files.read(fp, { format: "bytes" });
            const b64 = Buffer.from(bytes).toString("base64");

            // Determine correct MIME type
            const ext = (f.name.split(".").pop() || "").toLowerCase();
            const mimeMap: Record<string, string> = {
              png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
              gif: "image/gif", svg: "image/svg+xml",
              pdf: "application/pdf",
              docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              zip: "application/zip", gz: "application/gzip",
            };
            const mime = mimeMap[ext] || "application/octet-stream";
            const url = `data:${mime};base64,${b64}`;

            await prisma.deliverable.create({data:{projectId,title:f.name,description:"AI Agent",fileUrl:url,version:"1.0"}});
            exported.push(f.name);S({log:`📦 ${f.name}`});
          }catch{}
        }
        await prisma.tokenUsage.create({data:{projectId,amount:totalTokens||1,provider:activeKey.provider,model:"deepseek-chat",purpose:message.slice(0,200)}});
        await sandbox.kill(); sandbox=null;
        S({done:true,filesCreated:exported.length,files:exported,tokensUsed:totalTokens});
        ctrl.close();
      } catch(e:any){S({log:`❌ ${e.message}`,done:true});ctrl.close();}
      finally{if(sandbox)try{await sandbox.kill();}catch{}}
    }
  });
  return new Response(stream,{headers:{"Content-Type":"text/plain; charset=utf-8"}});
}
