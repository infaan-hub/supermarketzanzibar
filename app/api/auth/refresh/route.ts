// POST /api/auth/refresh - Refresh access token.
//
// Uses the `refresh_token` cookie to issue a new access token.

import { NextResponse, type NextRequest } from "next/server";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get("refresh_token");
    if (!cookie) {
      return NextResponse.json(
        { detail: "Refresh token not found." },
        { status: 401 },
      );
    }

    let claims;
    try {
      claims = await verifyRefreshToken(cookie.value);
    } catch {
      return NextResponse.json(
        { detail: "Invalid or expired refresh token." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(claims.sub) },
      select: { id: true, username: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { detail: "User not found or inactive." },
        { status: 401 },
      );
    }

    const accessToken = await signAccessToken({
      id: user.id,
      role: user.role,
      username: user.username,
    });

    const res = NextResponse.json({
      access: accessToken,
      user: {
        id: user.id.toString(),
        username: user.username,
        role: user.role,
        is_active: user.isActive,
      },
    });

    return res;
  } catch (error) {
    console.error("Refresh failed:", error);
    return NextResponse.json({ detail: "An unexpected error occurred." }, {
      status: 500,
    });
  }
}
