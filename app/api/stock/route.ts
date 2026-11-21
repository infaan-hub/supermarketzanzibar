// GET /api/stock - List current stock levels for active products.

import type { NextRequest } from "next/server";
import { json, serverError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/request";
import { findStockLevels } from "@/lib/stock";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const stock = await findStockLevels();

    return json({
      stock: stock.map((s) => ({
        productId: s.productId.toString(),
        productName: s.productName,
        barcode: s.barcode,
        category:
          s.category && s.categoryId
            ? { id: s.categoryId.toString(), name: s.category }
            : null,
        quantity: s.quantity,
        price: s.price,
        costPrice: s.costPrice,
        lowStockThreshold: s.lowStockThreshold,
        reorderLevel: s.reorderLevel,
      })),
    });
  } catch (error) {
    console.error("List stock failed:", error);
    return serverError();
  }
}
