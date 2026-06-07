"use client";

import { useState, useRef, useEffect } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type Message = {
  role: "user" | "agent" | "system" | "error";
  content: string;
  tokensUsed?: number;
  mode?: string;
  filesCreated?: number;
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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: locale === "zh"
        ? `🤖 AI Agent 就绪\n📊 Token: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}\n\n输入任务，Agent 自动创建文件到产出物区域。`
        : `🤖 AI Agent ready\n📊 Tokens: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}\n\nEnter a task. Agent creates files in the deliverables section.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUsed, setTotalUsed] = useState(0);
  const [remaining, setRemaining] = useState(tokenRaised);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: userMsg }),
      });
      const data = await res.json();

      setMessages((p) => [...p, {
        role: data.mode === "error" ? "error" : "agent",
        content: data.text || data.error || "No response",
        tokensUsed: data.tokensUsed,
        mode: data.mode,
        filesCreated: data.filesCreated,
      }]);
      if (data.totalUsed != null) setTotalUsed(data.totalUsed);
      if (data.remaining != null) setRemaining(data.remaining);

      // Reload after short delay so deliverables section updates
      if (data.filesCreated > 0) {
        setTimeout(() => location.reload(), 2000);
      }
    } catch {
      setMessages((p) => [...p, { role: "error", content: "❌ Network error" }]);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (text: string) => {
    // Render code blocks with styling
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const inner = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
        return (
          <pre key={i} className="bg-bg-tertiary border border-border-color rounded p-3 my-2 overflow-x-auto text-xs">
            <code>{inner}</code>
          </pre>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="terminal-card flex flex-col h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color flex flex-wrap items-center justify-between gap-2 text-xs bg-bg-secondary/50">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-text-primary font-semibold">AI Agent</span>
          <span className="text-text-dim">{provider}/{model}</span>
        </div>
        <div className="flex items-center gap-4 text-text-dim">
          <span>Used: <span className="text-text-warning">{formatTokenCount(totalUsed)}</span></span>
          <span>Left: <span className="text-accent font-semibold">{formatTokenCount(remaining)}</span></span>
        </div>
      </div>

      {/* Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-lg px-4 py-3 ${
              msg.role === "user" ? "bg-accent/10 border border-accent/30 text-text-primary" :
              msg.role === "error" ? "bg-text-error/10 border border-text-error/30 text-text-error" :
              msg.role === "system" ? "bg-bg-tertiary border border-border-color text-text-dim text-xs w-full text-center" :
              "bg-bg-tertiary border border-border-color text-text-secondary"
            }`}>
              <div className="text-sm leading-relaxed">{renderContent(msg.content)}</div>
              {msg.role !== "system" && msg.role !== "user" && (
                <div className="mt-2 pt-2 border-t border-border-color flex items-center gap-3 text-xs text-text-dim">
                  {msg.tokensUsed ? <span>消耗: {msg.tokensUsed} tokens</span> : null}
                  {msg.filesCreated ? <span className="text-accent">📦 {msg.filesCreated} 个文件已创建，页面即将刷新...</span> : null}
                  {msg.mode === "error" ? <span className="text-text-error">出错了</span> : null}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary border border-border-color rounded-lg px-4 py-3 text-text-dim text-xs">
              <span className="inline-block w-2 h-4 bg-accent animate-blink" /> Agent 工作中...（调用 DeepSeek API + 创建文件，约 5-10 秒）
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border-color flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={locale === "zh" ? "输入任务... (如：帮我写一份项目计划书 / 生成一个Python脚本)" : "Enter task..."}
          className="flex-1"
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn btn-primary text-xs whitespace-nowrap">
          {loading ? "..." : "▶ 运行"}
        </button>
      </div>
    </div>
  );
}
