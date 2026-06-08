import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "project" });

  const [project, usageTotal] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        category: true,
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
            githubHandle: true,
            createdAt: true,
          },
        },
        contributions: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        deliverables: {
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
            replies: {
              include: {
                user: { select: { id: true, username: true, avatarUrl: true } },
              },
            },
          },
          where: { parentId: null },
          orderBy: { createdAt: "desc" },
        },
        usages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: { select: { stars: true, comments: true } },
      },
    }),
    prisma.tokenUsage.aggregate({
      _sum: { amount: true },
      where: { projectId: id },
    }),
  ]);

  if (!project) notFound();

  const totalTokensUsed = usageTotal._sum.amount || 0;
  const remainingTokens = project.tokenRaised - totalTokensUsed;
  const progressPct = project.tokenGoal > 0
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

  return (
    <ProjectDetailClient
      project={project}
      locale={locale}
      categoryName={categoryName}
      statusLabel={statusLabels[project.status]}
      progressPct={progressPct}
      totalTokensUsed={totalTokensUsed}
      remainingTokens={remainingTokens}
    />
  );
}
