"use client";

import { useState, useRef, useEffect } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type Message = {
  role: "user" | "agent" | "system" | "error";
  content: string;
  tokensUsed?: number;
  files?: string[];
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
        ? `🤖 AI Agent · ${provider}/${model}\n📊 Token pool: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}\n\n输入任务，Agent 自动创建 .docx / 代码 / 文档到产出物区。`
        : `🤖 AI Agent · ${provider}/${model}\n📊 Pool: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}\n\nEnter a task. Agent creates .docx / code / docs in deliverables.`,
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
        content: data.text || "",
        tokensUsed: data.tokensUsed,
        files: data.files,
      }]);
      if (data.totalUsed != null) setTotalUsed(data.totalUsed);
      if (data.remaining != null) setRemaining(data.remaining);

      if (data.filesCreated > 0) {
        setTimeout(() => location.reload(), 2000);
      }
    } catch {
      setMessages((p) => [...p, { role: "error", content: "❌ 网络错误" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="terminal-card flex flex-col h-[600px]">
      <div className="px-4 py-3 border-b border-border-color flex flex-wrap items-center justify-between gap-2 text-xs bg-bg-secondary/50">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-text-primary font-semibold">AI Agent</span>
          <span className="text-text-dim">{provider}/{model}</span>
        </div>
        <div className="flex items-center gap-4 text-text-dim">
          <span>消耗: {formatTokenCount(totalUsed)}</span>
          <span>剩余: <span className="text-accent">{formatTokenCount(remaining)}</span></span>
        </div>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-lg px-4 py-3 ${
              msg.role === "user" ? "bg-accent/10 border border-accent/30 text-text-primary" :
              msg.role === "error" ? "bg-text-error/10 border border-text-error/30 text-text-error" :
              msg.role === "system" ? "bg-bg-tertiary border border-border-color text-text-dim text-xs w-full text-center" :
              "bg-bg-tertiary border border-border-color text-text-secondary"
            }`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>

              {msg.files && msg.files.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border-color">
                  <div className="text-text-primary text-xs font-semibold mb-1">📦 已生成文件：</div>
                  {msg.files.map((f, j) => (
                    <div key={j} className="text-accent text-xs">✅ {f}</div>
                  ))}
                  <div className="text-text-dim text-xs mt-1">页面即将刷新，文件出现在产出物区域</div>
                </div>
              )}

              {msg.role === "agent" && msg.tokensUsed && (
                <div className="mt-2 text-text-dim text-xs">消耗 {msg.tokensUsed} tokens</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary border border-border-color rounded-lg px-4 py-3 text-text-dim text-xs">
              <span className="inline-block w-2 h-4 bg-accent animate-blink" />{" "}
              Agent 工作中...（调用 DeepSeek + 创建文件，约 8-15 秒）
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border-color flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="输入任务...（如：帮我写一份项目计划书 / 生成一个React登录组件）"
          className="flex-1"
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn btn-primary text-xs">
          {loading ? "..." : "▶ 运行"}
        </button>
      </div>
    </div>
  );
}
