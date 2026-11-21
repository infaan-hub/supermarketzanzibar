// GET /api/digital-twin/locate?q=... — Phase 15 global 3D locator across
// products, SKUs, barcodes, categories, shelves, and warehouse rack positions.

import type { NextRequest } from "next/server";
import { requireExplorer } from "@/lib/auth/request";
import { json, serverError } from "@/lib/http";
import { locateInDigitalTwin } from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const result = await locateInDigitalTwin(q);
    return json(result);
  } catch (error) {
    console.error("Locate in digital twin failed:", error);
    return serverError("Unable to search 3D store locations.");
  }
}
