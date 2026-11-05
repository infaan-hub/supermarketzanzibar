// Stock library: stock level queries for the API routes.

import { prisma } from "@/lib/db";
import { LOW_STOCK_THRESHOLD, REORDER_LEVEL } from "@/lib/inventory";

export interface StockLevel {
  productId: bigint;
  productName: string;
  barcode: string;
  categoryId: bigint | null;
  category: string | null;
  quantity: number;
  lowStockThreshold: number;
  reorderLevel: number;
}

export async function findStockLevels(): Promise<StockLevel[]> {
  const products = await prisma.product.findMany({
    include: { category: true },
  });

  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    barcode: p.barcode,
    categoryId: p.categoryId,
    category: p.category?.name ?? null,
    quantity: p.quantity,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    reorderLevel: REORDER_LEVEL,
  }));
}
