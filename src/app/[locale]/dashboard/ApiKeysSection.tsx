"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LLM_PROVIDERS, type LLMProvider } from "@/lib/token-utils";

type ApiKeyData = {
  id: string;
  provider: string;
  label: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: Date;
};

export default function ApiKeysSection({
  locale,
  initialKeys,
}: {
  locale: string;
  initialKeys: ApiKeyData[];
}) {
  const t = useTranslations("dashboard");
  const [keys, setKeys] = useState<ApiKeyData[]>(initialKeys);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    provider: "anthropic" as LLMProvider,
    label: "",
    key: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add key");
        setLoading(false);
        return;
      }

      setKeys((prev) => [data, ...prev]);
      setModalOpen(false);
      setForm({ provider: "anthropic", label: "", key: "" });
    } catch {
      setError(locale === "zh" ? "网络错误" : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      await fetch(`/api/providers?id=${keyId}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="terminal-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">
          <span className="text-text-dim">## </span>
          {t("myApiKeys")}
        </h2>
        <button
          onClick={() => setModalOpen(true)}
          className="btn btn-secondary text-xs"
        >
          + {t("addApiKey")}
        </button>
      </div>

      {keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 border border-border-color rounded text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-text-primary">{key.label}</span>
                <span className="text-text-dim text-xs">
                  {key.provider} · {key.maskedKey}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs ${key.isActive ? "text-accent" : "text-text-dim"}`}
                >
                  {key.isActive ? t("active") : t("inactive")}
                </span>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="text-text-dim hover:text-text-error text-xs transition-colors"
                  title={locale === "zh" ? "删除" : "Delete"}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-text-dim text-sm text-center py-4">
          {locale === "zh"
            ? "还没有 API Key。添加一个来开始贡献 Token。"
            : "No API keys yet. Add one to start contributing tokens."}
        </p>
      )}

      {/* Add API Key Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="terminal-card p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-accent mb-4">
              &gt; {t("addApiKey")}
            </h2>

            {error && (
              <div className="border border-text-error text-text-error px-4 py-2 rounded text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-text-dim mb-1">
                  {t("apiKeyLabel")}
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) =>
                    setForm({ ...form, label: e.target.value })
                  }
                  required
                  className="w-full"
                  placeholder={locale === "zh" ? "我的 OpenAI Key" : "My OpenAI Key"}
                />
              </div>

              <div>
                <label className="block text-xs text-text-dim mb-1">
                  {t("apiKeyProvider")}
                </label>
                <select
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value as LLMProvider })
                  }
                  className="w-full bg-bg-secondary border border-border-color text-text-primary rounded px-3 py-2 text-sm"
                >
                  {(Object.keys(LLM_PROVIDERS) as LLMProvider[]).map((key) => (
                    <option key={key} value={key}>
                      {LLM_PROVIDERS[key].name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-dim mb-1">
                  {t("apiKeyValue")}
                </label>
                <input
                  type="password"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  required
                  className="w-full"
                  placeholder="sk-..."
                />
                <p className="text-xs text-text-dim mt-1">
                  {locale === "zh"
                    ? "密钥加密存储，只展示最后 4 位"
                    : "Encrypted at rest, only last 4 chars shown"}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex-1"
                >
                  {loading
                    ? "..."
                    : locale === "zh"
                      ? "保存"
                      : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setError("");
                  }}
                  className="btn btn-ghost"
                >
                  {locale === "zh" ? "取消" : "Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
