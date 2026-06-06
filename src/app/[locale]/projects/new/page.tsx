"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { LLM_PROVIDERS, type LLMProvider } from "@/lib/token-utils";

export default function NewProjectPage() {
  const t = useTranslations("project");
  const locale = useLocale();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    summary: "",
    description: "",
    tokenGoal: "",
    llmProvider: "anthropic" as LLMProvider,
    llmModel: "claude-sonnet-4-6",
    categoryId: "",
    repoUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch categories
  const [categories, setCategories] = useState<
    Array<{ id: string; nameEn: string; nameZh: string; slug: string }>
  >([]);

  useState(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        // We need a separate categories API, but for now seed from the homepage
      })
      .catch(() => {});
  });

  const selectedProvider = LLM_PROVIDERS[form.llmProvider];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tokenGoal: parseInt(form.tokenGoal),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();
      router.push(`/${locale}/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-text-primary mb-8">
        <span className="text-text-dim">&gt; </span>
        {t("create")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <div className="border border-text-error text-text-error px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("title")}
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="w-full"
            placeholder="My awesome AI project"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("summary")}
          </label>
          <input
            type="text"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            required
            className="w-full"
            placeholder={t("summaryPlaceholder")}
          />
        </div>

        {/* Description (Markdown) */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("description")} <span className="text-text-dim">(Markdown)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            required
            className="w-full min-h-[200px]"
            placeholder={t("descriptionPlaceholder")}
          />
        </div>

        {/* Token Goal */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("tokenGoal")}
          </label>
          <input
            type="number"
            value={form.tokenGoal}
            onChange={(e) => setForm({ ...form, tokenGoal: e.target.value })}
            required
            min="1000"
            className="w-full"
            placeholder="1000000"
          />
          <p className="text-xs text-text-dim mt-1">{t("tokenGoalHelp")}</p>
        </div>

        {/* LLM Provider & Model */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-primary mb-1">
              {t("llmProvider")}
            </label>
            <select
              value={form.llmProvider}
              onChange={(e) => {
                const provider = e.target.value as LLMProvider;
                setForm({
                  ...form,
                  llmProvider: provider,
                  llmModel: LLM_PROVIDERS[provider].defaultModel,
                });
              }}
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
            <label className="block text-sm text-text-primary mb-1">
              {t("llmModel")}
            </label>
            <select
              value={form.llmModel}
              onChange={(e) => setForm({ ...form, llmModel: e.target.value })}
              className="w-full bg-bg-secondary border border-border-color text-text-primary rounded px-3 py-2 text-sm"
            >
              {selectedProvider.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* GitHub Repo */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("repoUrl")}
          </label>
          <input
            type="url"
            value={form.repoUrl}
            onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
            className="w-full"
            placeholder="https://github.com/username/repo"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? "..." : t("create")}
          </button>
        </div>
      </form>
    </div>
  );
}
