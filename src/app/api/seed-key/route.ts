import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, maskKey } from "@/lib/encryption";
import { auth } from "@/lib/auth";

// Development-only helper for seeding a platform API key.
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await auth();
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = session?.user?.email?.toLowerCase();

    if (!userEmail || !adminEmails.includes(userEmail)) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { key, provider } = body;

    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const p = provider || "openai";

    // Ensure platform user exists
    let user = await prisma.user.findUnique({ where: { id: "platform" } });
    if (!user) {
      user = await prisma.user.create({ data: { id: "platform", email: "platform@tokenfund.dev", username: "platform" } });
    }

    const encrypted = encrypt(key);
    const masked = maskKey(key);
    const id = `key-${p}-${Date.now()}`;

    const apiKey = await prisma.apiKey.create({
      data: { id, userId: "platform", provider: p, label: `${p.toUpperCase()} Key`, encryptedKey: encrypted, maskedKey: masked, isActive: true },
      select: { id: true, provider: true, label: true, maskedKey: true, isActive: true },
    });

    return NextResponse.json({ ok: true, key: apiKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to seed key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
