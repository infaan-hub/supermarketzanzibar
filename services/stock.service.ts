// Stock management service: stock movements, low-stock alerts.
//
// Ports Django `StockMovement` model and related views.

import { prisma } from "@/lib/db";

export type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "SALE" | "RETURN";

export interface StockMovementCreateInput {
  productId: bigint;
  saleItemId?: bigint;
  quantity: number;
  movementType: MovementType;
}

export interface StockMovementFindOptions {
  where?: {
    id?: bigint;
    productId?: bigint;
    saleItemId?: bigint | null;
    movementType?: MovementType;
  };
  orderBy?: { id?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export async function createMovement(data: StockMovementCreateInput) {
  return prisma.stockMovement.create({ data });
}

export async function findMovement(options: StockMovementFindOptions) {
  return prisma.stockMovement.findFirst(options);
}

export async function findMovements(options: StockMovementFindOptions = {}) {
  return prisma.stockMovement.findMany({
    orderBy: { date: "desc" },
    ...options,
  });
}

export async function findMovementsByProduct(productId: bigint) {
  return prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { date: "desc" },
  });
}

export async function findMovementsBySaleItem(saleItemId: bigint) {
  return prisma.stockMovement.findMany({
    where: { saleItemId },
    orderBy: { date: "desc" },
  });
}

export async function findMovementsByType(movementType: MovementType) {
  return prisma.stockMovement.findMany({
    where: { movementType },
    orderBy: { date: "desc" },
  });
}

export async function getProductStockLevels() {
  const movements = await prisma.stockMovement.groupBy({
    by: ["productId", "movementType"],
    _sum: { quantity: true },
  });

  const totals = new Map<bigint, Record<string, number>>();

  for (const m of movements) {
    const current = totals.get(m.productId) ?? {};
    totals.set(m.productId, {
      ...current,
      [m.movementType]: (current[m.movementType] ?? 0) + (m._sum?.quantity ?? 0),
    });
  }

  const result = [];
  const entries = Array.from(totals.entries());
  for (const [productId, types] of entries) {
    let net = 0;
    for (const type of Object.keys(types)) {
      if (type === "IN" || type === "RETURN" || type === "SALE") {
        net += types[type] ?? 0;
      } else if (type === "OUT") {
        net -= types[type] ?? 0;
      } else if (type === "ADJUSTMENT") {
        net += types[type] ?? 0;
      }
    }
    result.push({ productId, net, details: types });
  }

  return result;
}

export async function getStockLevelsByProductIds(ids: bigint[]) {
  const movements = await prisma.stockMovement.groupBy({
    by: ["productId", "movementType"],
    _sum: { quantity: true },
    where: { productId: { in: ids } },
  });

  const totals = new Map<bigint, Record<string, number>>();

  for (const m of movements) {
    const current = totals.get(m.productId) ?? {};
    totals.set(m.productId, {
      ...current,
      [m.movementType]: (current[m.movementType] ?? 0) + (m._sum?.quantity ?? 0),
    });
  }

  const result = [];
  for (const id of ids) {
    let net = 0;
    const details: Record<string, number> = {};
    const types = totals.get(id) ?? {};
    for (const type of Object.keys(types)) {
      const qty = types[type] ?? 0;
      details[type] = qty;
      if (type === "IN" || type === "RETURN" || type === "SALE") {
        net += qty;
      } else if (type === "OUT") {
        net -= qty;
      } else if (type === "ADJUSTMENT") {
        net += qty;
      }
    }
    result.push({ productId: id, net, details });
  }

  return result;
}

export async function countMovements(options: { where?: { movementType?: MovementType } } = {}) {
  return prisma.stockMovement.count(options);
}

export async function getStockMovementHistory(productId: bigint, limit = 100) {
  return prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function getSoldStockByProductId(productId: bigint) {
  const movements = await prisma.stockMovement.groupBy({
    by: ["productId", "movementType"],
    _sum: { quantity: true },
    where: { productId, movementType: "OUT" },
  });

  const total = movements.reduce((sum, m) => sum + (m._sum?.quantity ?? 0), 0);
  return { productId, quantity: total };
}
