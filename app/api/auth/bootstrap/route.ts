// GET /api/auth/bootstrap - Check whether an initial administrator exists.

import { json } from "@/lib/http";
import { hasAnyAdmin } from "@/services/auth.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminExists = await hasAnyAdmin();
    return json({ hasAdmin: adminExists }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bootstrap check failed:", error);
    return json({ hasAdmin: true }, { headers: { "Cache-Control": "no-store" } });
  }
}
