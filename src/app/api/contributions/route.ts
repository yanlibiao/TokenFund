import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, amount, message } = body;

    if (!projectId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid contribution data" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "FUNDING" && project.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Project is not accepting contributions" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    const [contribution] = await prisma.$transaction([
      prisma.contribution.create({
        data: {
          amount: parseInt(amount),
          projectId,
          userId,
          message: message || null,
        },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: { tokenRaised: { increment: parseInt(amount) } },
      }),
    ]);

    const updated = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (updated && updated.tokenRaised >= updated.tokenGoal && updated.status === "FUNDING") {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "IN_PROGRESS" },
      });
    }

    return NextResponse.json(contribution, { status: 201 });
  } catch (error) {
    console.error("Failed to create contribution:", error);
    return NextResponse.json(
      { error: "Failed to process contribution" },
      { status: 500 }
    );
  }
}
