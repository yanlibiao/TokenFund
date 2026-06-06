import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MatrixRain from "@/components/terminal/MatrixRain";
import ProjectCard from "@/components/projects/ProjectCard";
import { formatTokenCount } from "@/lib/token-utils";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  const projects = await prisma.project.findMany({
    where: { status: "FUNDING" },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const [totalTokens, totalProjects, totalContributors] = await Promise.all([
    prisma.project.aggregate({
      _sum: { tokenRaised: true },
      where: { status: { in: ["FUNDING", "IN_PROGRESS", "COMPLETED"] } },
    }),
    prisma.project.count({
      where: { status: { in: ["FUNDING", "IN_PROGRESS", "COMPLETED"] } },
    }),
    prisma.contribution.count(),
  ]);

  const statsTokens = totalTokens._sum.tokenRaised || 0;

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center matrix-bg">
        <MatrixRain />
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-accent glow-text mb-4">
            {t("heroTitle")}
            <br />
            {t("heroTitle2")}
          </h1>
          <p className="text-text-secondary text-sm md:text-base mb-8 max-w-xl mx-auto leading-relaxed">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/${locale}/projects`} className="btn btn-primary">
              {t("browseProjects")}
            </Link>
            <Link
              href={`/${locale}/projects/new`}
              className="btn btn-secondary"
            >
              {t("startProject")}
            </Link>
          </div>
        </div>
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg-primary to-transparent" />
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border-color bg-bg-secondary">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl md:text-3xl font-bold text-accent glow-text">
              {formatTokenCount(statsTokens)}
            </p>
            <p className="text-xs text-text-dim mt-1">{t("statsTokens")}</p>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-bold text-accent glow-text">
              {totalProjects}
            </p>
            <p className="text-xs text-text-dim mt-1">{t("statsProjects")}</p>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-bold text-accent glow-text">
              {totalContributors}
            </p>
            <p className="text-xs text-text-dim mt-1">
              {t("statsContributors")}
            </p>
          </div>
        </div>
      </section>

      {/* Trending Projects */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-xl font-bold text-text-primary mb-8">
          <span className="text-text-dim"># </span>
          {t("trendingProjects")}
        </h2>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <div className="terminal-card p-12 text-center text-text-dim">
            <p className="mb-4">
              &gt; No projects yet. Be the first to launch one!
            </p>
            <Link href={`/${locale}/projects/new`} className="btn btn-primary">
              {t("startProject")}
            </Link>
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="border-t border-border-color py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-text-primary mb-8 text-center">
            <span className="text-text-dim">## </span>
            {t("howItWorks")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="terminal-card p-6 text-center">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="text-accent font-semibold mb-2">
                {t("step1Title")}
              </h3>
              <p className="text-text-secondary text-sm">{t("step1Desc")}</p>
            </div>
            <div className="terminal-card p-6 text-center">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-accent font-semibold mb-2">
                {t("step2Title")}
              </h3>
              <p className="text-text-secondary text-sm">{t("step2Desc")}</p>
            </div>
            <div className="terminal-card p-6 text-center">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="text-accent font-semibold mb-2">
                {t("step3Title")}
              </h3>
              <p className="text-text-secondary text-sm">{t("step3Desc")}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
