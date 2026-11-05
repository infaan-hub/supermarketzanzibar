// GET /api/dashboard/stats - Legacy key metrics endpoint.
//
// The dashboard now uses /api/dashboard/overview. This route is kept for
// existing integrations and delegates to the same corrected aggregation
// service, so both endpoints agree on revenue and timezone rules.

import { json } from "@/lib/http";
import { getDashboardStats } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return json(await getDashboardStats(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return json(
      { detail: "An unexpected error occurred." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
