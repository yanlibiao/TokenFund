"use client";

import { useState, useRef, useEffect } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type Message = {
  role: "user" | "assistant" | "system" | "info";
  content: string;
  tokensUsed?: number;
  mode?: string;
  filesCreated?: number;
};

export default function AgentSandbox({
  projectId, provider, model, tokenRaised, tokenGoal, projectStatus, locale,
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
        ? `🤖 AI Agent 已就绪

🔌 模型: ${provider}/${model}
📊 Token: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}

Agent 会通过真实 API 调用创建文件。输入你的需求开始。`
        : `🤖 AI Agent Ready

🔌 Model: ${provider}/${model}
📊 Tokens: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}

The Agent creates real files via API calls. Enter your request to begin.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUsed, setTotalUsed] = useState(0);
  const [remaining, setRemaining] = useState(tokenRaised);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

      if (!res.ok) {
        setMessages((p) => [...p, { role: "assistant", content: `❌ ${data.error}` }]);
      } else {
        setMessages((p) => [...p, {
          role: "assistant",
          content: data.text,
          tokensUsed: data.tokensUsed,
          mode: data.mode,
          filesCreated: data.filesCreated,
        }]);

        if (data.filesCreated > 0) {
          // Reload page after a delay to show new deliverables
          setTimeout(() => window.location.reload(), 2500);
        }

        setTotalUsed(data.totalUsed);
        setRemaining(data.remaining);
      }
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "❌ Network error" }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="terminal-card flex flex-col h-[650px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color flex flex-wrap items-center justify-between gap-2 text-xs bg-bg-secondary/50">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-text-primary font-semibold">
            {locale === "zh" ? "AI Agent" : "AI Agent"}
          </span>
          <span className="text-text-dim">{provider}/{model}</span>
        </div>
        <div className="flex items-center gap-4 text-text-dim">
          <span>{locale === "zh" ? "消耗" : "Used"}: <span className="text-text-warning">{formatTokenCount(totalUsed)}</span></span>
          <span>{locale === "zh" ? "剩余" : "Left"}: <span className="text-accent font-semibold">{formatTokenCount(remaining)}</span></span>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-lg px-4 py-3 ${
              msg.role === "user" ? "bg-accent/10 border border-accent/30" :
              msg.role === "system" ? "bg-bg-tertiary border border-border-color text-text-dim text-xs text-center w-full" :
              "bg-bg-tertiary border border-border-color"
            }`}>
              {msg.role === "system" && <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>}
              {msg.role === "user" && <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>}
              {msg.role === "assistant" && (
                <div className="text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">
                  {msg.content}
                  {msg.tokensUsed != null && msg.tokensUsed > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-color flex items-center gap-4 text-xs text-text-dim">
                      <span>{locale === "zh" ? "消耗" : "Used"}: {msg.tokensUsed} tokens</span>
                      {msg.mode === "real" && <span className="text-accent">🟢 {locale === "zh" ? "真实 AI" : "Real AI"}</span>}
                      {msg.mode === "no-key" && <span className="text-text-warning">⚠️ {locale === "zh" ? "缺少 API Key" : "No API Key"}</span>}
                      {msg.filesCreated != null && msg.filesCreated > 0 && (
                        <span className="text-accent">
                          📦 {msg.filesCreated} {locale === "zh" ? "个文件已创建" : "files created"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary border border-border-color rounded-lg px-4 py-3 text-text-dim text-xs">
              <span className="inline-block w-2 h-4 bg-accent animate-blink" />{" "}
              {locale === "zh" ? "Agent 工作中..." : "Agent working..."}
            </div>
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
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={locale === "zh"
            ? "告诉 Agent 你要什么，它会自动创建文件... (如：帮我写一份项目计划书)"
            : "Tell the Agent what to create... (e.g. Write a project proposal)"}
          className="flex-1"
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn btn-primary text-xs whitespace-nowrap">
          {loading ? "..." : locale === "zh" ? "▶ 运行" : "▶ Run"}
        </button>
      </div>
    </div>
  );
}
