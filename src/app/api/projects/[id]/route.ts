import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      category: true,
      creator: {
        select: { id: true, username: true, avatarUrl: true, createdAt: true },
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
      _count: { select: { stars: true, comments: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}
