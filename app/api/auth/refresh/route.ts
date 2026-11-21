// POST /api/auth/refresh - Rotate refresh token and issue a fresh access token.

import type { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { REFRESH_TOKEN_TTL_SECONDS, env } from "@/lib/env";
import { AuthError, refreshTokens } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    let token = request.cookies.get("refresh_token")?.value ?? "";

    if (!token) {
      const body = (await request.json().catch(() => null)) as {
        refresh?: string;
      } | null;
      if (body && typeof body.refresh === "string") {
        token = body.refresh.trim();
      }
    }

    if (!token) {
      return json({ detail: "Refresh token not found." }, { status: 401 });
    }

    const rotated = await refreshTokens(token);

    const res = json({
      access: rotated.access,
      refresh: rotated.refresh,
      user: rotated.user,
    });

    res.cookies.set("refresh_token", rotated.refresh, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
      path: "/",
    });

    return res;
  } catch (error) {
    if (error instanceof AuthError) {
      const res = json({ detail: error.message }, { status: error.status });
      if (error.status === 401) {
        res.cookies.set("refresh_token", "", {
          httpOnly: true,
          secure: env.isProduction,
          sameSite: "lax",
          maxAge: 0,
          path: "/",
        });
      }
      return res;
    }
    console.error("Refresh failed:", error);
    return json({ detail: "An unexpected error occurred." }, { status: 500 });
  }
}
