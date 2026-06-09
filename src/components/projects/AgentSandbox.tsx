"use client";

import { useEffect, useRef, useState } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type TodoStatus = "pending" | "doing" | "done" | "failed";
type TodoItem = { id: string; title: string; description?: string; status: TodoStatus };
type TaskResult = { text?: string; tokensUsed?: number; filesCreated?: number; files?: string[]; elapsedMs?: number };

type AgentEvent = {
  type?: string;
  phase?: string;
  message?: string;
  log?: string;
  id?: string;
  tasks?: Array<{ id: string; title: string; description?: string }>;
  preview?: string;
  chars?: number;
  label?: string;
  value?: string | number;
  name?: string;
  size?: number;
  done?: boolean;
  error?: string;
  filesCreated?: number;
  files?: string[];
  tokensUsed?: number;
  elapsedMs?: number;
  text?: string;
};

const PHASE_LABELS: Record<string, string> = {
  prepare: "Preparing",
  generate: "Generating script",
  execute: "Running sandbox",
  export: "Exporting files",
};

export default function AgentSandbox({
  projectId,
  provider,
  model,
  tokenRaised,
  tokenUsed,
  locale,
  onFilesCreated,
}: {
  projectId: string;
  provider: string;
  model: string;
  tokenRaised: number;
  tokenGoal: number;
  tokenUsed: number;
  projectStatus: string;
  locale: string;
  onFilesCreated?: (files: string[]) => void;
}) {
  const sessionKey = `agent-session-v2-${projectId}`;
  const logRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number | null>(null);

  const loadInitialLogs = () => {
    if (typeof window === "undefined") return [] as string[];
    try {
      const saved = localStorage.getItem(sessionKey);
      if (saved) return (JSON.parse(saved).logs || []) as string[];
    } catch {}
    return [
      "TokenFund Agent ready.",
      `Pool: ${formatTokenCount(tokenRaised)} | Used: ${formatTokenCount(tokenUsed)} | Left: ${formatTokenCount(tokenRaised - tokenUsed)}`,
      `Target model: ${provider}/${model}`,
      "Run a concrete task. The agent will show each phase, generated script preview, live logs, files, and failure reasons.",
      "",
    ];
  };

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [totalUsed, setTotalUsed] = useState(tokenUsed);
  const [remaining, setRemaining] = useState(tokenRaised - tokenUsed);
  const [logs, setLogs] = useState<string[]>(loadInitialLogs);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [scriptPreview, setScriptPreview] = useState("");
  const [files, setFiles] = useState<Array<{ name: string; size?: number }>>([]);
  const [metrics, setMetrics] = useState<Array<{ label: string; value: string | number }>>([]);
  const [result, setResult] = useState<TaskResult | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(sessionKey, JSON.stringify({ logs }));
    } catch {}
  }, [logs, sessionKey]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current) setElapsed(Date.now() - startedAtRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const addLog = (line: string) => setLogs((prev) => [...prev, line]);
  const updateTodo = (id: string, status: TodoStatus) => {
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, status } : todo)));
  };

  const resetRunState = () => {
    setTodos([]);
    setScriptPreview("");
    setFiles([]);
    setMetrics([]);
    setResult(null);
    setElapsed(0);
  };

  const clearSession = () => {
    localStorage.removeItem(sessionKey);
    resetRunState();
    setPhase("idle");
    setLogs(["Session cleared.", `Pool: ${formatTokenCount(tokenRaised)}`, ""]);
    setTotalUsed(tokenUsed);
    setRemaining(tokenRaised - tokenUsed);
  };

  const applyEvent = (evt: AgentEvent) => {
    if (evt.type === "phase") {
      setPhase(evt.phase || "running");
      addLog(`== ${evt.message || PHASE_LABELS[evt.phase || ""] || evt.phase} ==`);
      return;
    }

    if (evt.type === "plan" && evt.tasks) {
      setTodos(evt.tasks.map((task) => ({ ...task, status: "pending" })));
      addLog("Plan:");
      for (const task of evt.tasks) addLog(`  ${task.id}. ${task.title}`);
      return;
    }

    if (evt.type === "task_start" && evt.id) return updateTodo(evt.id, "doing");
    if (evt.type === "task_done" && evt.id) return updateTodo(evt.id, "done");
    if (evt.type === "task_fail" && evt.id) return updateTodo(evt.id, "failed");

    if (evt.type === "script") {
      setScriptPreview(evt.preview || "");
      addLog(`Script generated: ${evt.chars || 0} chars. Preview is available above the log.`);
      return;
    }

    if (evt.type === "metric" && evt.label) {
      setMetrics((prev) => [...prev, { label: evt.label!, value: evt.value ?? "" }]);
      return;
    }

    if (evt.type === "step" && evt.message) return addLog(`STEP ${evt.message}`);
    if (evt.type === "file_log" && evt.message) return addLog(`FILE ${evt.message}`);
    if (evt.type === "runtime_status" && evt.message) return addLog(`STATUS ${evt.message}`);
    if (evt.type === "heartbeat" && evt.message) return addLog(`... ${evt.message}`);
    if (evt.type === "warning" && evt.message) return addLog(`WARNING ${evt.message}`);
    if (evt.type === "log" && evt.log) return addLog(evt.log);
    if (evt.log) return addLog(evt.log);

    if (evt.type === "file" && evt.name) {
      setFiles((prev) => [...prev, { name: evt.name!, size: evt.size }]);
      addLog(`Exported ${evt.name}${evt.size ? ` (${evt.size} bytes)` : ""}`);
      return;
    }

    if (evt.type === "error" || evt.error) {
      addLog(`ERROR ${evt.message || evt.error}`);
      setPhase("failed");
    }
  };

  const runTask = async () => {
    if (!input.trim() || loading) return;
    const task = input.trim();
    setInput("");
    resetRunState();
    setLoading(true);
    setPhase("prepare");
    startedAtRef.current = Date.now();
    addLog(`\n> ${task}`);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: task }),
      });

      if (!res.ok || !res.body) {
        addLog(`ERROR HTTP ${res.status}`);
        setPhase("failed");
        return;
      }

      const reader = res.body.getReader();
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
            const evt = JSON.parse(line) as AgentEvent;
            applyEvent(evt);
            if (evt.done) finalData = evt;
          } catch {
            addLog(line);
          }
        }
      }

      if (buf.trim()) {
        try {
          const evt = JSON.parse(buf) as AgentEvent;
          applyEvent(evt);
          if (evt.done) finalData = evt;
        } catch {
          addLog(buf);
        }
      }

      if (finalData?.tokensUsed) {
        setTotalUsed((prev) => prev + finalData.tokensUsed!);
        setRemaining((prev) => Math.max(0, prev - finalData.tokensUsed!));
      }
      if (finalData) {
        setResult(finalData);
        setPhase(finalData.filesCreated ? "done" : "finished");
        addLog(finalData.text || "Run finished.");
        if (finalData.filesCreated && finalData.files?.length) onFilesCreated?.(finalData.files);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Connection failed";
      addLog(`ERROR ${message}`);
      setPhase("failed");
    } finally {
      setLoading(false);
      startedAtRef.current = null;
    }
  };

  const doneCount = todos.filter((todo) => todo.status === "done").length;
  const phaseText = PHASE_LABELS[phase] || (phase === "done" ? "Done" : phase === "failed" ? "Failed" : "Ready");

  return (
    <div className="terminal-card flex flex-col h-[650px]">
      <div className="px-4 py-3 border-b border-border-color bg-bg-secondary/50">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${loading ? "bg-text-warning animate-pulse" : phase === "failed" ? "bg-text-error" : "bg-accent"}`} />
            <span className="text-text-primary font-semibold">{phaseText}</span>
            {loading && <span className="text-text-dim">{Math.round(elapsed / 1000)}s</span>}
          </div>
          <div className="flex items-center gap-4 text-text-dim">
            <span>Used <span className="text-text-warning">{formatTokenCount(totalUsed)}</span></span>
            <span>Left <span className="text-accent font-semibold">{formatTokenCount(remaining)}</span></span>
            <button onClick={clearSession} className="text-text-dim hover:text-text-error transition-colors">Clear</button>
          </div>
        </div>

        {todos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {todos.map((todo) => (
              <span
                key={todo.id}
                className={`px-2 py-1 rounded border ${
                  todo.status === "done" ? "border-accent/50 text-accent" :
                  todo.status === "failed" ? "border-text-error/50 text-text-error" :
                  todo.status === "doing" ? "border-text-warning/50 text-text-warning animate-pulse" :
                  "border-border-color text-text-dim"
                }`}
                title={todo.description || ""}
              >
                {todo.id}. {todo.title}
              </span>
            ))}
            <span className="text-text-dim px-2 py-1">{doneCount}/{todos.length}</span>
          </div>
        )}

        {metrics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-text-dim">
            {metrics.slice(-4).map((metric, idx) => (
              <span key={`${metric.label}-${idx}`}>{metric.label}: <span className="text-text-secondary">{metric.value}</span></span>
            ))}
          </div>
        )}
      </div>

      {scriptPreview && (
        <details className="border-b border-border-color bg-bg-tertiary/40 px-4 py-2 text-xs">
          <summary className="cursor-pointer text-text-primary">Generated script preview</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-text-dim">{scriptPreview}</pre>
        </details>
      )}

      {files.length > 0 && (
        <div className="border-b border-border-color px-4 py-2 text-xs flex flex-wrap gap-2">
          {files.map((file) => (
            <span key={file.name} className="text-accent border border-accent/40 rounded px-2 py-1">
              {file.name}{file.size ? ` (${formatTokenCount(file.size)}b)` : ""}
            </span>
          ))}
        </div>
      )}

      <div ref={logRef} className="flex-1 overflow-y-auto p-4 text-sm font-mono leading-relaxed" style={{ background: "var(--bg-primary, #0a0a0a)" }}>
        {logs.map((line, i) => {
          const cls =
            line.startsWith("ERROR") ? "text-text-error" :
            line.startsWith("WARNING") ? "text-text-warning" :
            line.startsWith("==") ? "text-accent font-semibold" :
            line.startsWith("STEP") || line.startsWith("FILE") || line.startsWith("STATUS") ? "text-text-primary" :
            line.startsWith(">") ? "text-text-primary font-semibold" :
            line.startsWith("...") ? "text-text-dim italic" :
            "text-text-secondary";
          return <div key={i} className={`${cls} whitespace-pre-wrap break-all`}>{line || " "}</div>;
        })}
      </div>

      {result?.text && (
        <div className="border-t border-border-color px-4 py-2 text-xs text-text-secondary">
          {result.text} {result.elapsedMs ? `(${Math.round(result.elapsedMs / 1000)}s)` : ""}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border-color flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              runTask();
            }
          }}
          placeholder={locale === "zh" ? "Describe a concrete task..." : "Describe a concrete task..."}
          disabled={loading}
          className="flex-1"
        />
        <button onClick={runTask} disabled={loading || !input.trim()} className="btn btn-primary text-xs whitespace-nowrap">
          {loading ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}
