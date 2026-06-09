"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LLM_PROVIDERS, type LLMProvider } from "@/lib/token-utils";

type Category = { id: string; nameEn: string; nameZh: string; slug: string; icon: string | null };

export default function NewProjectPage() {
  const t = useTranslations("project");
  const locale = useLocale();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [categories, setCategories] = useState<Category[]>([]);
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

  // Fetch categories on mount
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data);
        if (data.length > 0) {
          setForm((f) => (f.categoryId ? f : { ...f, categoryId: data[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/${locale}/auth/login?callbackUrl=/${locale}/projects/new`);
    }
  }, [status, locale, router]);

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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      router.push(`/${locale}/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (status === "loading" || status === "unauthenticated" || !session) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-text-dim">
        {locale === "zh" ? "正在跳转到登录页..." : "Redirecting to login..."}
      </div>
    );
  }

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
            {t("title")} <span className="text-text-error">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            required
            className="w-full"
            placeholder="My awesome AI project"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("summary")} <span className="text-text-error">*</span>
          </label>
          <input
            type="text"
            value={form.summary}
            onChange={(e) => update("summary", e.target.value)}
            required
            className="w-full"
            placeholder={t("summaryPlaceholder")}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("description")}{" "}
            <span className="text-text-dim">(Markdown)</span>
            <span className="text-text-error"> *</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            required
            className="w-full min-h-[200px]"
            placeholder={t("descriptionPlaceholder")}
          />
        </div>

        {/* Token Goal */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("tokenGoal")} <span className="text-text-error">*</span>
          </label>
          <input
            type="number"
            value={form.tokenGoal}
            onChange={(e) => update("tokenGoal", e.target.value)}
            required
            min="1000"
            className="w-full"
            placeholder="1000000"
          />
          <p className="text-xs text-text-dim mt-1">{t("tokenGoalHelp")}</p>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm text-text-primary mb-1">
            {t("category")} <span className="text-text-error">*</span>
          </label>
          <select
            value={form.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
            required
            className="w-full"
          >
            {categories.length === 0 && (
              <option value="">Loading...</option>
            )}
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {locale === "zh" ? cat.nameZh : cat.nameEn}
              </option>
            ))}
          </select>
        </div>

        {/* LLM Provider & Model */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-primary mb-1">
              {t("llmProvider")} <span className="text-text-error">*</span>
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
              className="w-full"
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
              {t("llmModel")} <span className="text-text-error">*</span>
            </label>
            <select
              value={form.llmModel}
              onChange={(e) => update("llmModel", e.target.value)}
              className="w-full"
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
            onChange={(e) => update("repoUrl", e.target.value)}
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
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-ghost"
          >
            {locale === "zh" ? "取消" : "Cancel"}
          </button>
        </div>
      </form>
    </div>
  );
}
