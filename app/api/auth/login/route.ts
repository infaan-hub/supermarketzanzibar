// POST /api/auth/login - Authenticate user and issue JWT access + refresh tokens.

import type { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { AuthError, loginUser } from "@/services/auth.service";
import { REFRESH_TOKEN_TTL_SECONDS, env } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      username?: string;
      password?: string;
    } | null;

    if (!body || typeof body !== "object") {
      return json({ detail: "Username and password are required." }, { status: 400 });
    }

    const result = await loginUser(body.username ?? "", body.password ?? "");

    const res = json({
      access: result.access,
      refresh: result.refresh,
      user: result.user,
    });

    res.cookies.set("refresh_token", result.refresh, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
      path: "/",
    });

    return res;
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ detail: error.message }, { status: error.status });
    }
    console.error("Login failed:", error);
    return json({ detail: "An unexpected error occurred." }, { status: 500 });
  }
}

export async function GET() {
  return json({ detail: "Use POST to log in." }, { status: 405 });
}
