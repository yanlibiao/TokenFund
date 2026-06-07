"use client";

import { useState, useRef, useEffect } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  tokensUsed?: number;
};

export default function AgentSandbox({
  projectId,
  provider,
  model,
  tokenRaised,
  locale,
}: {
  projectId: string;
  provider: string;
  model: string;
  tokenRaised: number;
  locale: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content:
        locale === "zh"
          ? `AI Agent 已就绪。已加载 ${formatTokenCount(tokenRaised)} tokens。请输入你的任务指令。`
          : `AI Agent ready. ${formatTokenCount(tokenRaised)} tokens loaded. Enter your task instructions.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUsed, setTotalUsed] = useState(0);
  const [remaining, setRemaining] = useState(tokenRaised);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: userMsg,
          provider,
          model,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              locale === "zh"
                ? `❌ 错误: ${data.error}`
                : `❌ Error: ${data.error}`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.text,
            tokensUsed: data.tokensUsed,
          },
        ]);
        setTotalUsed(data.totalUsed);
        setRemaining(data.remaining);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            locale === "zh"
              ? "❌ 网络错误，请重试"
              : "❌ Network error, please retry",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="terminal-card flex flex-col h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color flex items-center justify-between text-xs bg-bg-secondary/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-text-primary font-semibold">
            {locale === "zh" ? "AI Agent 沙盒" : "AI Agent Sandbox"}
          </span>
          <span className="text-text-dim">
            {provider}/{model}
          </span>
        </div>
        <div className="flex items-center gap-4 text-text-dim">
          <span>
            {locale === "zh" ? "已用" : "Used"}:{" "}
            <span className="text-text-warning">
              {formatTokenCount(totalUsed)}
            </span>
          </span>
          <span>
            {locale === "zh" ? "剩余" : "Remaining"}:{" "}
            <span className="text-accent font-semibold">
              {formatTokenCount(remaining)}
            </span>
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 text-sm"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded px-4 py-2 ${
                msg.role === "user"
                  ? "bg-accent/10 border border-accent/30 text-text-primary"
                  : msg.role === "system"
                    ? "bg-bg-tertiary border border-border-color text-text-dim text-xs text-center w-full"
                    : "bg-bg-tertiary border border-border-color text-text-secondary"
              }`}
            >
              <pre className="whitespace-pre-wrap font-mono text-inherit">
                {msg.content}
              </pre>
              {msg.tokensUsed && (
                <div className="mt-2 pt-2 border-t border-border-color text-xs text-text-dim">
                  {locale === "zh" ? "消耗" : "Used"}: {msg.tokensUsed} tokens
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary border border-border-color rounded px-4 py-2 text-text-dim text-xs">
              <span className="inline-block w-2 h-4 bg-accent animate-blink" />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border-color flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            locale === "zh"
              ? "输入任务指令，Enter 发送..."
              : "Enter task instructions, press Enter..."
          }
          disabled={loading || remaining <= 0}
          className="flex-1"
          autoFocus
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim() || remaining <= 0}
          className="btn btn-primary text-xs whitespace-nowrap"
        >
          {loading
            ? "..."
            : locale === "zh"
              ? "▶ 执行"
              : "▶ Run"}
        </button>
      </div>

      {remaining <= 0 && messages.some((m) => m.role === "assistant") && (
        <div className="px-4 py-2 border-t border-text-error/30 bg-text-error/5 text-text-error text-xs text-center">
          {locale === "zh"
            ? "⚠️ Token 已用完，需要更多贡献才能继续使用 AI Agent"
            : "⚠️ Tokens exhausted. More contributions needed to continue."}
        </div>
      )}
    </div>
  );
}
