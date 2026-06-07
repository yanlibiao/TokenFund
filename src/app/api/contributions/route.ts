import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, amount, message } = body;

    if (!projectId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid contribution data" },
        { status: 400 }
      );
    }

    // Verify project exists and is in FUNDING status
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

    // TODO: Get user from session
    const userId = "demo";

    // Create contribution and update project in a transaction
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
        data: {
          tokenRaised: { increment: parseInt(amount) },
        },
      }),
    ]);

    // If goal reached, update status to IN_PROGRESS
    const updatedProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (updatedProject && updatedProject.tokenRaised >= updatedProject.tokenGoal) {
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
