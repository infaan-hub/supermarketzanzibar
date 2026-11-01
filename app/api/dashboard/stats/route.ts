// GET /api/dashboard/stats - Key metrics for the dashboard.
//
// Computed from the same Prisma models that back the other API routes, so the
// dashboard stays consistent with the rest of the system.

import { json } from "@/lib/http";
import { prisma } from "@/lib/db";

// Default inventory threshold (mirrors lib/stock.ts).
const LOW_STOCK_THRESHOLD = 10;

function dayBounds() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startOfToday, startOfWeek, startOfMonth };
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export async function GET() {
  try {
    const { startOfToday, startOfWeek, startOfMonth } = dayBounds();

    const [
      totalProducts,
      lowStockCount,
      totalCustomers,
      salesToday,
      salesWeek,
      salesMonth,
      pendingPayments,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({
        where: { quantity: { lte: LOW_STOCK_THRESHOLD } },
      }),
      prisma.customer.count(),
      prisma.sale.aggregate({
        _sum: { finalAmount: true },
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.sale.aggregate({
        _sum: { finalAmount: true },
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.sale.aggregate({
        _sum: { finalAmount: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.payment.count({
        where: { status: { not: "confirmed" } },
      }),
    ]);

    return json({
      totalSalesToday: toNumber(salesToday._sum.finalAmount ?? 0),
      totalSalesWeek: toNumber(salesWeek._sum.finalAmount ?? 0),
      totalSalesMonth: toNumber(salesMonth._sum.finalAmount ?? 0),
      lowStockCount,
      pendingPayments,
      totalCustomers,
      totalProducts,
    });
  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
