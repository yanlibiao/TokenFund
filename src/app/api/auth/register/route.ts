import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password } = body;

    // Validation
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (username.length < 2 || username.length > 30) {
      return NextResponse.json(
        { error: "Username must be 2-30 characters" },
        { status: 400 }
      );
    }

    // Check uniqueness
    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
    });

    // Create wallet for user
    await prisma.tokenWallet.create({
      data: {
        userId: user.id,
        balance: 0,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
