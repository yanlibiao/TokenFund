import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status") || "FUNDING";
  const sort = searchParams.get("sort") || "newest";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");

  const where: any = {};

  if (status && status !== "all") {
    where.status = status;
  }

  if (category && category !== "all") {
    where.category = { slug: category };
  }

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

  const [projects, total] = await Promise.all([
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
  ]);

  return NextResponse.json({
    projects,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, description, tokenGoal, llmProvider, llmModel, categoryId, repoUrl } = body;

    // Validation
    if (!title || !summary || !description || !tokenGoal || !llmProvider || !llmModel || !categoryId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // TODO: Get user from session
    // For now using a placeholder
    const project = await prisma.project.create({
      data: {
        title,
        summary,
        description,
        tokenGoal: parseInt(tokenGoal),
        llmProvider,
        llmModel,
        categoryId,
        repoUrl: repoUrl || null,
        status: "FUNDING",
        creatorId: "demo", // TODO: Replace with actual user ID from auth session
      },
      include: {
        category: true,
        creator: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
