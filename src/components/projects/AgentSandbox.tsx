"use client";

import { useState, useRef, useEffect } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type TodoItem = { id: string; title: string; description?: string; status: "pending" | "doing" | "done" | "failed" };
type TaskResult = { text?: string; tokensUsed?: number; mode?: string; filesCreated?: number; files?: string[]; results?: Array<{ id: string; status: string }> };

export default function AgentSandbox({
  projectId, provider, model, tokenRaised, tokenGoal, tokenUsed, locale, onFilesCreated,
}: {
  projectId: string; provider: string; model: string; tokenRaised: number; tokenGoal: number;
  tokenUsed: number; projectStatus: string; locale: string; onFilesCreated?: (f: string[]) => void;
}) {
  const sessionKey = `agent-session-${projectId}`;

  const initData = () => {
    if (typeof window === "undefined") return { logs: [] as string[], todos: [] as TodoItem[] };
    try {
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        const p = JSON.parse(saved);
        return { logs: (p.logs || []) as string[], todos: (p.todos || []) as TodoItem[] };
      }
    } catch {}
    return {
      logs: [
        `🤖 TokenFund Multi-Agent · E2B Sandbox`,
        `📊 Pool: ${formatTokenCount(tokenRaised)} | Used: ${formatTokenCount(tokenUsed)} | Left: ${formatTokenCount(tokenRaised - tokenUsed)}`,
        `🔌 ${provider}/${model}`,
        "",
        locale === "zh" ? "输入任务。Agent 会先规划再逐项执行。" : "Enter task. Agent plans then executes step by step.",
        "",
      ] as string[],
      todos: [] as TodoItem[],
    };
  };

  const [{ logs: initLogs, todos: initTodos }] = useState(initData);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [totalUsed, setTotalUsed] = useState(tokenUsed);
  const [remaining, setRemaining] = useState(tokenRaised - tokenUsed);
  const [logs, setLogs] = useState<string[]>(initLogs);
  const [todos, setTodos] = useState<TodoItem[]>(initTodos);
  const [currentPhase, setCurrentPhase] = useState<string>("");
  const [result, setResult] = useState<TaskResult | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Save state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(sessionKey, JSON.stringify({ logs, todos })); } catch {}
  }, [logs, todos, sessionKey]);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [logs]);

  const clearSession = () => {
    localStorage.removeItem(sessionKey);
    setLogs([`🔄 Cleared.`, `📊 Pool: ${formatTokenCount(tokenRaised)}`, ""]);
    setTodos([]);
    setTotalUsed(tokenUsed);
    setRemaining(tokenRaised - tokenUsed);
    setResult(null);
    setCurrentPhase("");
  };

  const addLog = (line: string) => setLogs((prev) => [...prev, line]);

  const runTask = async () => {
    if (!input.trim() || loading) return;
    const task = input.trim();
    setInput("");
    setResult(null);
    setTodos([]);
    setCurrentPhase("");
    addLog(`\n> ${task}`);
    addLog("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: task }),
      });
      if (!res.ok) { addLog(`❌ HTTP ${res.status}`); setLoading(false); return; }

      const reader = res.body?.getReader();
      if (!reader) { addLog("❌ No response stream"); setLoading(false); return; }

      const decoder = new TextDecoder();
      let buf = "";
      let finalData: TaskResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);

            // ── Phase change ──
            if (evt.type === "phase") {
              setCurrentPhase(evt.phase);
              addLog(evt.message);
            }
            // ── Plan received ──
            else if (evt.type === "plan" && evt.tasks) {
              const items: TodoItem[] = evt.tasks.map((t: any) => ({ id: t.id, title: t.title, description: t.description, status: "pending" as const }));
              setTodos(items);
              for (const t of items) addLog(`  [${t.id}] ⏳ ${t.title}`);
            }
            // ── Task starts ──
            else if (evt.type === "task_start") {
              setTodos((prev) => prev.map((t) => (t.id === evt.id ? { ...t, status: "doing" } : t)));
              // Don't add duplicate log — Coder already logs the task title
            }
            // ── Task done ──
            else if (evt.type === "task_done") {
              setTodos((prev) => prev.map((t) => (t.id === evt.id ? { ...t, status: "done" } : t)));
            }
            // ── Task fail ──
            else if (evt.type === "task_fail") {
              setTodos((prev) => prev.map((t) => (t.id === evt.id ? { ...t, status: "failed" } : t)));
            }
            // ── Debugger ──
            else if (evt.type === "debug") {
              // Already logged in text form
            }
            // ── Raw log ──
            else if (evt.log) {
              addLog(evt.log);
            }
            // ── Final ──
            else if (evt.done) {
              finalData = evt;
              if (evt.results) {
                setTodos((prev) =>
                  prev.map((t) => {
                    const r = evt.results.find((x: any) => x.id === t.id);
                    return r ? { ...t, status: r.status === "done" ? "done" as const : "failed" as const } : t;
                  })
                );
              }
            }
            // ── Error ──
            else if (evt.error) {
              addLog(`❌ ${evt.error}`);
            }
          } catch {
            if (line.trim()) addLog(line);
          }
        }
      }

      if (buf.trim()) {
        try { const evt = JSON.parse(buf); if (evt.done) finalData = evt; } catch { if (buf.trim()) addLog(buf); }
      }

      setLoading(false);
      if (finalData?.tokensUsed) {
        setTotalUsed((prev) => prev + finalData.tokensUsed!);
        setRemaining((prev) => Math.max(0, prev - finalData.tokensUsed!));
      }
      if (finalData) {
        addLog("");
        addLog(`✅ 完成 | ${finalData.filesCreated || 0} 个文件`);
        setResult(finalData);
        if (finalData.filesCreated && finalData.files?.length && onFilesCreated) {
          onFilesCreated(finalData.files);
        }
      }
    } catch {
      addLog("❌ 连接超时");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──
  const statusIcon = (s: string) =>
    s === "done" ? "✅" : s === "failed" ? "❌" : s === "doing" ? "🔨" : "⏳";

  return (
    <div className="terminal-card flex flex-col h-[650px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color flex flex-wrap items-center justify-between gap-2 text-xs bg-bg-secondary/50">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${loading ? "bg-text-warning animate-pulse" : "bg-accent"}`} />
          <span className="text-text-primary font-semibold">
            {currentPhase === "plan" ? "📋 Planner" : currentPhase === "code" ? "🔨 Coder" : currentPhase === "debug" ? "🐛 Debugger" : loading ? "执行中..." : "Multi-Agent"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-text-dim">
          <span>消耗: <span className="text-text-warning">{formatTokenCount(totalUsed)}</span></span>
          <span>剩余: <span className="text-accent font-semibold">{formatTokenCount(remaining)}</span></span>
          <button onClick={clearSession} className="text-text-dim hover:text-text-error transition-colors">🗑</button>
        </div>
      </div>

      {/* Todo Panel (shown when there are tasks) */}
      {todos.length > 0 && (
        <div className="px-4 py-2 border-b border-border-color bg-bg-tertiary/50 flex flex-wrap gap-3 text-xs">
          {todos.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border ${
                t.status === "done" ? "border-accent/50 text-accent" :
                t.status === "failed" ? "border-text-error/50 text-text-error" :
                t.status === "doing" ? "border-text-warning/50 text-text-warning animate-pulse" :
                "border-border-color text-text-dim"
              }`}
              title={t.description || ""}
            >
              {statusIcon(t.status)} {t.title}
            </div>
          ))}
          {todos.filter((t) => t.status === "done").length}/{todos.length} 完成
        </div>
      )}

      {/* Terminal */}
      <div ref={logRef} className="flex-1 overflow-y-auto p-4 text-sm font-mono leading-relaxed" style={{ background: "var(--bg-primary, #0a0a0a)" }}>
        {logs.map((line, i) => {
          const cls =
            line.startsWith("✅") ? "text-accent" :
            line.startsWith("❌") ? "text-text-warning" :
            line.startsWith("⚠️") ? "text-text-dim" :
            line.startsWith("🔨") ? "text-text-primary font-semibold" :
            line.startsWith("📋") || line.startsWith("📦") ? "text-accent font-semibold" :
            line.startsWith("🐛") ? "text-text-warning font-semibold" :
            line.startsWith("💡") ? "text-accent italic" :
            line.startsWith("📊") ? "text-text-primary" :
            line.startsWith(">") ? "text-text-primary font-semibold" :
            line.startsWith("🚀") || line.startsWith("🔌") ? "text-text-dim" :
            line.startsWith("🤖") ? "text-text-dim" :
            line.startsWith("▶️") ? "text-text-dim italic" :
            "text-text-secondary";
          return <div key={i} className={`${cls} whitespace-pre-wrap break-all`}>{line || " "}</div>;
        })}
        {loading && <div className="text-accent mt-2"><span className="animate-blink">▊</span></div>}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border-color flex gap-3">
        <input ref={inputRef} type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runTask(); } }}
          placeholder={locale === "zh" ? "输入任务..." : "Enter task..."}
          disabled={loading} className="flex-1" />
        <button onClick={runTask} disabled={loading || !input.trim()} className="btn btn-primary text-xs whitespace-nowrap">
          {loading ? "执行中..." : "▶ 运行"}
        </button>
      </div>
    </div>
  );
}
