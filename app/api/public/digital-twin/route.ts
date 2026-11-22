// GET /api/public/digital-twin — Read-only sanitized 3D Store layout for guest
// visitors (`/store-3d`). Strips internal cost prices, warehouse stock & PII.

import { json, serverError } from "@/lib/http";
import { getDigitalTwinSnapshot } from "@/services/digital-twin.service";
import type { DigitalTwinSnapshot } from "@/types/digital-twin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getDigitalTwinSnapshot();

    // Return ONLY customer-facing retail floor data; strip internal warehouse & cost fields.
    const sanitized: DigitalTwinSnapshot = {
      initialized: snapshot.initialized,
      generatedAt: snapshot.generatedAt,
      store: snapshot.store,
      departments: snapshot.departments,
      shelves: snapshot.shelves.map((shelf) => ({
        ...shelf,
        positions: shelf.positions.map((pos) => ({
          ...pos,
          warehouseQuantity: 0,
          reservedQuantity: 0,
          nearestExpiryDate: null,
          product: pos.product
            ? {
                ...pos.product,
                costPrice: 0,
              }
            : null,
        })),
      })),
      warehouseRacks: [],
      mappings: [],
      summary: {
        totalProducts: snapshot.summary.totalProducts,
        totalShelfUnits: snapshot.summary.totalShelfUnits,
        totalWarehouseUnits: 0,
        lowStockCount: snapshot.summary.lowStockCount,
        outOfStockCount: snapshot.summary.outOfStockCount,
        expiringSoonCount: 0,
        expiredCount: 0,
      },
    };

    return json(sanitized);
  } catch (error) {
    console.error("Load public 3D store failed:", error);
    return serverError("Unable to load public 3D store view.");
  }
}
