import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTokenCount } from "@/lib/token-utils";
import ApiKeysSection from "./ApiKeysSection";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/auth/login`);
  }

  const userId = session.user.id;

  const [myProjects, myContributions, apiKeys] = await Promise.all([
    prisma.project.findMany({
      where: { creatorId: userId },
      include: { category: true, _count: { select: { contributions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contribution.findMany({
      where: { userId },
      include: {
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        label: true,
        maskedKey: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalContributed = myContributions.reduce((sum, c) => sum + c.amount, 0);
  const totalReceived = myProjects.reduce((sum, p) => sum + p.tokenRaised, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-text-primary mb-8">
        <span className="text-text-dim">&gt; </span>
        {session.user.name || session.user.username}{" "}
        <span className="text-text-dim text-sm">({t("title")})</span>
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="terminal-card p-4 text-center">
          <p className="text-2xl font-bold text-accent">
            {formatTokenCount(totalReceived)}
          </p>
          <p className="text-xs text-text-dim mt-1">{t("totalReceived")}</p>
        </div>
        <div className="terminal-card p-4 text-center">
          <p className="text-2xl font-bold text-accent">
            {formatTokenCount(totalContributed)}
          </p>
          <p className="text-xs text-text-dim mt-1">{t("totalContributed")}</p>
        </div>
        <div className="terminal-card p-4 text-center">
          <p className="text-2xl font-bold text-accent">
            {myProjects.length}
          </p>
          <p className="text-xs text-text-dim mt-1">{t("myProjects")}</p>
        </div>
      </div>

      {/* My Projects */}
      <div className="terminal-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">
            <span className="text-text-dim">## </span>
            {t("myProjects")}
          </h2>
          <Link
            href={`/${locale}/projects/new`}
            className="btn btn-primary text-xs"
          >
            + New
          </Link>
        </div>
        {myProjects.length > 0 ? (
          <div className="space-y-3">
            {myProjects.map((project) => (
              <Link
                key={project.id}
                href={`/${locale}/projects/${project.id}`}
                className="flex items-center justify-between p-3 border border-border-color rounded hover:border-accent-dim transition-colors hover:no-underline"
              >
                <div>
                  <p className="text-text-primary text-sm">{project.title}</p>
                  <p className="text-text-dim text-xs">
                    {project.category.nameEn} ·{" "}
                    {formatTokenCount(project.tokenRaised)} /{" "}
                    {formatTokenCount(project.tokenGoal)} ·{" "}
                    {project._count.contributions} backers
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded border status-${project.status.toLowerCase()}`}
                >
                  {project.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-text-dim text-sm">
            <p>{t("noProjects")}</p>
            <Link
              href={`/${locale}/projects/new`}
              className="btn btn-secondary text-xs mt-3 inline-block"
            >
              Create your first project
            </Link>
          </div>
        )}
      </div>

      {/* API Keys — interactive client component */}
      <ApiKeysSection
        locale={locale}
        initialKeys={apiKeys}
      />

      {/* Contribution History */}
      <div className="terminal-card p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          <span className="text-text-dim">## </span>
          {t("myContributions")}
        </h2>
        {myContributions.length > 0 ? (
          <div className="space-y-2">
            {myContributions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 border border-border-color rounded text-sm"
              >
                <div>
                  <Link
                    href={`/${locale}/projects/${c.project.id}`}
                    className="text-text-primary hover:text-accent text-sm"
                  >
                    {c.project.title}
                  </Link>
                  <p className="text-text-dim text-xs">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-accent font-semibold text-sm">
                  +{formatTokenCount(c.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-dim text-sm text-center py-4">
            No contributions yet.
          </p>
        )}
      </div>
    </div>
  );
}
