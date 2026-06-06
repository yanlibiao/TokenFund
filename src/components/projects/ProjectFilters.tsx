"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

type Category = {
  id: string;
  nameEn: string;
  nameZh: string;
  slug: string;
  icon: string | null;
};

export default function ProjectFilters({
  locale,
  categories,
}: {
  locale: string;
  categories: Category[];
}) {
  const t = useTranslations("projects");
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") || "all";
  const status = searchParams.get("status") || "FUNDING";
  const sort = searchParams.get("sort") || "newest";
  const search = searchParams.get("search") || "";

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key !== "search") params.set("page", "1");
    router.push(`/${locale}/projects?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-3 mb-8">
      <input
        type="text"
        defaultValue={search}
        placeholder={t("search")}
        className="flex-1 min-w-[200px]"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateParam("search", (e.target as HTMLInputElement).value);
          }
        }}
      />
      <select
        value={category}
        onChange={(e) => updateParam("category", e.target.value)}
        className="bg-bg-secondary border border-border-color text-text-primary rounded px-3 py-2 text-sm"
      >
        <option value="all">{t("allCategories")}</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.slug}>
            {cat.icon} {locale === "zh" ? cat.nameZh : cat.nameEn}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => updateParam("status", e.target.value)}
        className="bg-bg-secondary border border-border-color text-text-primary rounded px-3 py-2 text-sm"
      >
        <option value="all">{t("allStatuses")}</option>
        <option value="FUNDING">{locale === "zh" ? "筹款中" : "Funding"}</option>
        <option value="IN_PROGRESS">{locale === "zh" ? "进行中" : "In Progress"}</option>
        <option value="COMPLETED">{locale === "zh" ? "已完成" : "Completed"}</option>
      </select>
      <select
        value={sort}
        onChange={(e) => updateParam("sort", e.target.value)}
        className="bg-bg-secondary border border-border-color text-text-primary rounded px-3 py-2 text-sm"
      >
        <option value="newest">{t("newest")}</option>
        <option value="mostFunded">{t("mostFunded")}</option>
        <option value="trending">{t("trending")}</option>
      </select>
    </div>
  );
}
