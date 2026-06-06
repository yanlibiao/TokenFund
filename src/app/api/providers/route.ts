import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, maskKey } from "@/lib/encryption";

export async function GET() {
  // TODO: Get user from session, return their API keys (masked)
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: "demo" },
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
        userId: "demo", // TODO: Replace with actual user ID
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
