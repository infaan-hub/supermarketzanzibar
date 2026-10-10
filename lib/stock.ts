// Stock library: stock level queries for the API routes.

import { prisma } from "@/lib/db";

export interface StockLevel {
  productId: bigint;
  productName: string;
  categoryId: bigint | null;
  category: string | null;
  quantity: number;
  lowStockThreshold: number;
  reorderLevel: number;
}

// Default inventory thresholds used when product records do not store them.
const LOW_STOCK_THRESHOLD = 10;
const REORDER_LEVEL = 20;

export async function findStockLevels(): Promise<StockLevel[]> {
  const products = await prisma.product.findMany({
    include: { category: true },
  });

  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    categoryId: p.categoryId,
    category: p.category?.name ?? null,
    quantity: p.quantity,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    reorderLevel: REORDER_LEVEL,
  }));
}
