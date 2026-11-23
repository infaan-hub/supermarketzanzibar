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
  price: number;
  costPrice: number;
  lowStockThreshold: number;
  reorderLevel: number;
}

export async function findStockLevels(): Promise<StockLevel[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      barcode: true,
      categoryId: true,
      quantity: true,
      price: true,
      costPrice: true,
      category: { select: { name: true } },
    },
    orderBy: [{ quantity: "asc" }, { name: "asc" }],
  });

  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    barcode: p.barcode,
    categoryId: p.categoryId,
    category: p.category?.name ?? null,
    quantity: p.quantity,
    price: Number(p.price),
    costPrice: Number(p.costPrice),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    reorderLevel: REORDER_LEVEL,
  }));
}
