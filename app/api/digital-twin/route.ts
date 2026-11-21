// GET  /api/digital-twin — Live 3D Digital Twin snapshot directly from PostgreSQL.
// POST /api/digital-twin — Idempotently initialize / synchronize Store, Departments,
//                          Shelves, WarehouseLocations, ThreeDAssets & Mappings.

import type { NextRequest } from "next/server";
import { requireExplorer, requireManager } from "@/lib/auth/request";
import { json, serverError, serviceUnavailable } from "@/lib/http";
import {
  getDigitalTwinSnapshot,
  initializeDigitalTwinLayout,
  isMissingTwinTables,
} from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  try {
    const snapshot = await getDigitalTwinSnapshot();
    return json(snapshot);
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable(
        "Digital Twin database tables are not yet deployed. Run `npx prisma migrate deploy`.",
      );
    }
    console.error("Load digital twin snapshot failed:", error);
    return serverError("Unable to load 3D Digital Twin state.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  try {
    const snapshot = await initializeDigitalTwinLayout(guard.user.id);
    return json(snapshot, 201);
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable(
        "Digital Twin database tables are not yet deployed. Run `npx prisma migrate deploy` first.",
      );
    }
    console.error("Initialize digital twin layout failed:", error);
    return serverError("Unable to initialize 3D Digital Twin layout.");
  }
}
