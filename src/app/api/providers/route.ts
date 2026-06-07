import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, maskKey } from "@/lib/encryption";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      label: true,
      maskedKey: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(apiKeys);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { provider, label, key } = body;

    if (!provider || !label || !key) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const encryptedKey = encrypt(key);
    const masked = maskKey(key);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        provider,
        label,
        encryptedKey,
        maskedKey: masked,
      },
      select: {
        id: true,
        provider: true,
        label: true,
        maskedKey: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    console.error("Failed to add API key:", error);
    return NextResponse.json(
      { error: "Failed to add API key" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Ensure user owns this key
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.apiKey.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
