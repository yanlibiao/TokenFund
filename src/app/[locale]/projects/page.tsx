import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectFilters from "@/components/projects/ProjectFilters";
import { Suspense } from "react";

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "projects" });

  const category = sp.category || "all";
  const status = sp.status || "FUNDING";
  const sort = sp.sort || "newest";
  const search = sp.search || "";
  const page = parseInt(sp.page || "1");

  const where: any = {};
  if (status !== "all") where.status = status;
  if (category !== "all") where.category = { slug: category };
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { summary: { contains: search } },
    ];
  }

  const orderBy: any =
    sort === "mostFunded"
      ? { tokenRaised: "desc" }
      : sort === "trending"
        ? { stars: { _count: "desc" } }
        : { createdAt: "desc" };

  const limit = 12;
  const [projects, total, categories] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        category: true,
        creator: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { contributions: true, stars: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
    prisma.category.findMany(),
  ]);

  const totalPages = Math.ceil(total / limit);

  const buildUrl = (p: number) => {
    const qs = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => v !== undefined) as [string, string][]
    );
    qs.set("page", String(p));
    return `/${locale}/projects?${qs.toString()}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold text-text-primary">
          <span className="text-text-dim"># </span>
          {t("title")}
        </h1>
        <Link href={`/${locale}/projects/new`} className="btn btn-primary">
          + {t("createFirst")}
        </Link>
      </div>

      <Suspense fallback={<div className="text-text-dim">Loading filters...</div>}>
        <ProjectFilters locale={locale} categories={categories} />
      </Suspense>

      {projects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} locale={locale} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={buildUrl(p)}
                  className={`px-3 py-1 text-sm rounded border ${
                    p === page
                      ? "border-accent text-accent"
                      : "border-border-color text-text-dim hover:text-accent"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="terminal-card p-12 text-center text-text-dim">
          <p>{t("noProjects")}</p>
        </div>
      )}
    </div>
  );
}
