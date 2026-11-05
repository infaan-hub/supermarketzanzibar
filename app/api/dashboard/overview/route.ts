// GET /api/dashboard/overview - Complete dashboard payload.
//
// `range` is one of today | week | month | year. All period metrics, the
// revenue trend, payment mix and top sellers use the same business-timezone
// window; current facts (inventory, pending payments, recent sales) are
// returned alongside them.

import type { NextRequest } from "next/server";
import { badRequest, json } from "@/lib/http";
import { getDashboardOverview } from "@/lib/dashboard";
import { isDashboardRange } from "@/lib/dashboard-range";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const rawRange = request.nextUrl.searchParams.get("range") ?? "today";
  if (!isDashboardRange(rawRange)) {
    return badRequest(
      'range must be one of "today", "week", "month" or "year".',
    );
  }

  try {
    const overview = await getDashboardOverview(rawRange);
    return json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Dashboard overview failed:", error);
    return json(
      { detail: "An unexpected error occurred." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
