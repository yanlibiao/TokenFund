"use client";

import { useState, useRef, useEffect } from "react";
import { formatTokenCount } from "@/lib/token-utils";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  tokensUsed?: number;
  mode?: string;
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
        ? `🤖 AI Agent 已就绪\n\n📊 ${tokenRaised >= tokenGoal ? "✅ 已满筹" : "🔵 筹款中"} | Token: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}\n🔌 ${provider}/${model}\n\n💡 即使没有 API Key 也能生成有用内容（代码/文档/分析）。添加 API Key 后启用真实 AI。\n\n输入你的需求开始。`
        : `🤖 AI Agent Ready\n\n📊 ${tokenRaised >= tokenGoal ? "✅ Funded" : "🔵 Funding"} | Tokens: ${formatTokenCount(tokenRaised)}/${formatTokenCount(tokenGoal)}\n🔌 ${provider}/${model}\n\n💡 Generates useful content even without an API key. Add one for real AI.\n\nEnter your request to begin.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUsed, setTotalUsed] = useState(0);
  const [remaining, setRemaining] = useState(tokenRaised);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  const downloadFile = (content: string, index: number, format: "md" | "html" | "txt") => {
    const exts = { md: "text/markdown", html: "text/html", txt: "text/plain" };
    let body = content;
    if (format === "html") {
      body = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.7}pre{background:#f5f5f5;padding:1rem;border-radius:6px;overflow-x:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}blockquote{border-left:4px solid #3b82f6;margin:1rem 0;padding-left:1rem;color:#666}</style></head><body>${content.replace(/\n/g, "<br>").replace(/```(\w+)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>').replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>").replace(/^- (.+)$/gm, "<li>$1</li>")}</body></html>`;
    }
    const blob = new Blob([body], { type: exts[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-output-${index + 1}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        body: JSON.stringify({ projectId, message: userMsg, provider, model }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((p) => [...p, { role: "assistant", content: `❌ ${data.error}` }]);
      } else {
        setMessages((p) => [...p, { role: "assistant", content: data.text, tokensUsed: data.tokensUsed, mode: data.mode }]);
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
          <span className="text-text-primary font-semibold">{locale === "zh" ? "AI Agent 沙盒" : "AI Agent Sandbox"}</span>
          <span className="text-text-dim">{provider}/{model}</span>
        </div>
        <div className="flex items-center gap-4 text-text-dim">
          <span>{locale === "zh" ? "已用" : "Used"}: <span className="text-text-warning">{formatTokenCount(totalUsed)}</span></span>
          <span>{locale === "zh" ? "剩余" : "Remaining"}: <span className="text-accent font-semibold">{formatTokenCount(remaining)}</span></span>
          <span className="text-xs px-2 py-0.5 rounded border">
            {projectStatus === "IN_PROGRESS" || projectStatus === "COMPLETED"
              ? (locale === "zh" ? "🟢 可用" : "🟢 Live")
              : (locale === "zh" ? "🟡 模拟" : "🟡 Demo")}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
              msg.role === "user" ? "bg-accent/10 border border-accent/30" :
              msg.role === "system" ? "bg-bg-tertiary border border-border-color text-text-dim text-xs text-center w-full" :
              "bg-bg-tertiary border border-border-color"
            }`}>
              {msg.role === "system" && <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>}
              {msg.role === "user" && <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>}
              {msg.role === "assistant" && (
                <div>
                  <div className="text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</div>
                  <div className="mt-3 pt-3 border-t border-border-color flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {msg.tokensUsed && <span className="text-xs text-text-dim">{locale === "zh" ? "消耗" : "Used"}: {msg.tokensUsed} tokens</span>}
                      {msg.mode === "real" && <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">🟢 {locale === "zh" ? "真实 AI" : "Real AI"}</span>}
                      {msg.mode === "simulation" && <span className="text-xs text-text-warning bg-text-warning/10 px-1.5 py-0.5 rounded">🟡 {locale === "zh" ? "模拟" : "Sim"}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => downloadFile(msg.content, i, "md")} className="btn btn-secondary text-xs">📥 .md</button>
                      <button onClick={() => downloadFile(msg.content, i, "html")} className="btn btn-secondary text-xs">🌐 .html</button>
                      <button onClick={() => downloadFile(msg.content, i, "txt")} className="btn btn-secondary text-xs">📄 .txt</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary border border-border-color rounded-lg px-4 py-3 text-text-dim text-xs">
              <span className="inline-block w-2 h-4 bg-accent animate-blink" /> {locale === "zh" ? "AI 思考中..." : "AI thinking..."}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border-color flex gap-3">
        <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={locale === "zh" ? "输入需求，Enter 发送... (如：帮我写一份项目计划书 / 写一个 Python 脚本)" : "Enter request, press Enter... (e.g. Write a project proposal / Create a React component)"}
          className="flex-1" />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn btn-primary text-xs whitespace-nowrap">
          {loading ? "..." : locale === "zh" ? "▶ 执行" : "▶ Run"}
        </button>
      </div>
    </div>
  );
}
