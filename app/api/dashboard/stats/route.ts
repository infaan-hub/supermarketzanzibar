// GET /api/dashboard/stats - Compact dashboard summary (staff only).

import type { NextRequest } from "next/server";
import { json, serverError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/request";
import { getDashboardStats } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const stats = await getDashboardStats();
    return json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return serverError();
  }
}
