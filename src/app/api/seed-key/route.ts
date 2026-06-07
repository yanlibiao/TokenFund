// Temporary route to seed an API key into the database
// DELETE THIS FILE after testing
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, maskKey } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Ensure demo user exists
    let user = await prisma.user.findUnique({ where: { id: "demo" } });
    if (!user) {
      user = await prisma.user.create({
        data: { id: "demo", email: "demo@tokenfund.dev", username: "demo" },
      });
    }

    // Delete old keys
    await prisma.apiKey.deleteMany({ where: { userId: "demo" } });

    // Add new key
    const encrypted = encrypt(key);
    const masked = maskKey(key);

    const apiKey = await prisma.apiKey.create({
      data: {
        id: "key-ds-prod-001",
        userId: "demo",
        provider: "deepseek",
        label: "DeepSeek (Platform)",
        encryptedKey: encrypted,
        maskedKey: masked,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        label: true,
        maskedKey: true,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, key: apiKey });
  } catch (error: any) {
    console.error("Seed key error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
