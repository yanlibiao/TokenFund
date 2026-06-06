import Link from "next/link";
import type { Project, Category } from "@prisma/client";

type ProjectWithCategory = Project & { category: Category };

export default function ProjectCard({
  project,
  locale,
}: {
  project: ProjectWithCategory;
  locale: string;
}) {
  const progressPct =
    project.tokenGoal > 0
      ? Math.min((project.tokenRaised / project.tokenGoal) * 100, 100)
      : 0;

  const categoryName = locale === "zh" ? project.category.nameZh : project.category.nameEn;

  const statusLabels: Record<string, string> = {
    DRAFT: locale === "zh" ? "草稿" : "Draft",
    FUNDING: locale === "zh" ? "筹款中" : "Funding",
    IN_PROGRESS: locale === "zh" ? "进行中" : "In Progress",
    COMPLETED: locale === "zh" ? "已完成" : "Completed",
    CANCELLED: locale === "zh" ? "已取消" : "Cancelled",
  };

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

  return (
    <Link
      href={`/${locale}/projects/${project.id}`}
      className="terminal-card block p-4 hover:no-underline group"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-text-dim">{categoryName}</span>
        <span className={`text-xs px-2 py-0.5 rounded border status-${project.status.toLowerCase()}`}>
          {statusLabels[project.status]}
        </span>
      </div>

      <h3 className="text-accent font-semibold text-base mb-1 group-hover:glow-text transition-all">
        {project.title}
      </h3>

      <p className="text-text-secondary text-xs line-clamp-2 mb-3">
        {project.summary}
      </p>

      {/* Progress bar */}
      <div className="token-progress mb-2">
        <div
          className="token-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-text-primary font-semibold">
          {formatTokens(project.tokenRaised)} / {formatTokens(project.tokenGoal)}
        </span>
        <span className="text-text-dim">
          {project.llmProvider}/{project.llmModel}
        </span>
      </div>
    </Link>
  );
}
