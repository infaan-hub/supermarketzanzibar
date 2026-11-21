// POST /api/auth/logout - Revoke the refresh token and clear its cookie.

import type { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { env } from "@/lib/env";
import { logoutUser } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  const cookieToken = request.cookies.get("refresh_token")?.value;
  await logoutUser(cookieToken);

  const res = json({ detail: "Signed out." });
  res.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
