"use client";

import { useState, useRef, useEffect } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type TaskResult = {
  text: string;
  logs: string[];
  tokensUsed: number;
  mode: string;
  filesCreated: number;
  files: string[];
};

export default function AgentSandbox({
  projectId, provider, model, tokenRaised, tokenGoal, locale,
}: {
  projectId: string;
  provider: string;
  model: string;
  tokenRaised: number;
  tokenGoal: number;
  projectStatus: string;
  locale: string;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "🤖 TokenFund AI Agent v2",
    `📊 Pool: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)} tokens`,
    `🔌 Provider: ${provider}/${model}`,
    "",
    locale === "zh"
      ? "输入任务指令，Agent 在云端沙盒中执行..."
      : "Enter task. Agent executes in cloud sandbox...",
    "",
  ]);
  const [result, setResult] = useState<TaskResult | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [logs]);

  const runTask = async () => {
    if (!input.trim() || loading) return;
    const task = input.trim();
    setInput("");
    setResult(null);
    setLogs((prev) => [...prev, `\n> ${task}`, ""]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: task }),
      });

      const data: TaskResult = await res.json();

      if (data.logs) {
        setLogs((prev) => [...prev, ...data.logs, ""]);
      }

      if (data.mode === "e2b-sandbox") {
        setLogs((prev) => [
          ...prev,
          data.filesCreated > 0
            ? `✅ 任务完成 | ${data.filesCreated} 个文件 | ${data.tokensUsed} tokens`
            : "✅ 任务完成",
          "",
        ]);
      } else if (data.mode === "no-key") {
        setLogs((prev) => [...prev, "⚠️ " + data.text, ""]);
      } else if (data.mode === "error") {
        setLogs((prev) => [...prev, "❌ " + data.text, ""]);
      }

      setResult(data);

      if (data.filesCreated > 0) {
        setTimeout(() => location.reload(), 2500);
      }
    } catch {
      setLogs((prev) => [...prev, "❌ 网络错误", ""]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="terminal-card flex flex-col h-[650px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color flex flex-wrap items-center justify-between gap-2 text-xs bg-bg-secondary/50">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${loading ? "bg-text-warning animate-pulse" : "bg-accent"}`} />
          <span className="text-text-primary font-semibold">
            {loading ? "Agent 执行中..." : "AI Agent · E2B Sandbox"}
          </span>
          {result?.tokensUsed ? <span className="text-text-dim">{result.tokensUsed} tokens</span> : null}
        </div>
        <div className="flex items-center gap-4 text-text-dim text-xs">
          <span>
            {result?.mode === "e2b-sandbox" ? "🟢" : result?.mode === "error" ? "🔴" : "⚪"}
          </span>
        </div>
      </div>

      {/* Terminal log */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto p-4 text-sm font-mono leading-relaxed"
        style={{ background: "var(--bg-primary, #0a0a0a)" }}
      >
        {logs.map((line, i) => {
          const cls =
            line.startsWith("✅") ? "text-accent" :
            line.startsWith("❌") || line.startsWith("⚠️") ? "text-text-warning" :
            line.startsWith("🔧") ? "text-text-dim" :
            line.startsWith("📦") ? "text-accent font-semibold" :
            line.startsWith("STDOUT:") || line.startsWith("STDERR:") ? "text-text-secondary" :
            line.startsWith("Exit code:") ? "text-text-dim text-xs" :
            line.startsWith(">") ? "text-text-primary font-semibold" :
            line.startsWith("🚀") || line.startsWith("📋") ? "text-accent" :
            line.startsWith("💬") ? "text-text-secondary italic" :
            line.startsWith("🤖") || line.startsWith("📊") || line.startsWith("🔌") ? "text-text-dim" :
            "text-text-secondary";

          return (
            <div key={i} className={`${cls} whitespace-pre-wrap break-all`}>
              {line || " "}
            </div>
          );
        })}

        {loading && (
          <div className="text-accent mt-2">
            <span className="animate-blink">▊</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border-color flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runTask(); } }}
          placeholder={
            locale === "zh"
              ? "告诉 Agent 你要什么...（如：写一个 Python 爬虫抓取新闻标题并导出 CSV）"
              : "Tell Agent what to build... (e.g. Create a React todo app with TypeScript)"
          }
          disabled={loading}
          className="flex-1"
        />
        <button onClick={runTask} disabled={loading || !input.trim()} className="btn btn-primary text-xs whitespace-nowrap">
          {loading ? "执行中..." : "▶ 运行"}
        </button>
      </div>
    </div>
  );
}
