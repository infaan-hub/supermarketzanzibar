// GET /api/stock - List stock levels.
//
// Returns product-stock pairs for inventory management.

import { NextResponse } from "next/server";
import { findStockLevels } from "@/lib/stock";

export async function GET() {
  try {
    const stock = await findStockLevels();

    return NextResponse.json({
      stock: stock.map((s) => ({
        productId: s.productId.toString(),
        productName: s.productName,
        category: s.category && s.categoryId
          ? { id: s.categoryId.toString(), name: s.category }
          : null,
        quantity: s.quantity,
        lowStockThreshold: s.lowStockThreshold,
        reorderLevel: s.reorderLevel,
      })),
    });
  } catch (error) {
    console.error("List stock failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
