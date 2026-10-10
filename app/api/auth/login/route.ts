// POST /api/auth/login - User login.
//
// Verifies credentials and returns access + refresh tokens.

import { NextResponse } from "next/server";
import { authenticate, type CurrentUser } from "@/lib/auth/request";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { validatePassword, type LoginInput } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginInput;
    const user = await prisma.user.findUnique({
      where: { username: body.username },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        fullName: true,
        password: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !validatePassword(body.password, user.password)) {
      return NextResponse.json(
        { detail: "Invalid credentials." },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { detail: "Account is disabled." },
        { status: 403 },
      );
    }

    const auth = await authenticate(request as unknown as Request);
    if (!auth.ok) {
      const accessToken = await signAccessToken({
        id: user.id,
        role: user.role,
        username: user.username,
      });
      const refreshToken = await signRefreshToken({
        id: user.id,
        role: user.role,
        username: user.username,
      });

      const res = NextResponse.json({
        access: accessToken,
        refresh: refreshToken,
        user: {
          id: user.id.toString(),
          username: user.username,
          email: user.email,
          full_name: user.fullName,
          phone: user.phone,
          role: user.role,
          is_active: user.isActive,
        },
      });

      const refreshExpires = new Date();
      refreshExpires.setDate(refreshExpires.getDate() + 7);

      res.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });

      return res;
    }

    return NextResponse.json({ detail: auth.error }, { status: 401 });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ detail: "Use POST to log in." }, { status: 405 });
}
