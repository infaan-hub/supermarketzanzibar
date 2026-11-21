// GET /api/reports?range=today|week|month|year
//
// End-of-day (Z-Report) and gross profit analytics using `price` and `costPrice`
// across the Africa/Dar_es_Salaam business timezone (manager/admin only).

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, json, serverError } from "@/lib/http";
import { requireManager } from "@/lib/auth/request";
import { buildDashboardPeriod, isDashboardRange } from "@/lib/dashboard-range";
import { BUSINESS_TIME_ZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function confirmedSaleWhere(start: Date, end: Date): Prisma.SaleWhereInput {
  return {
    createdAt: { gte: start, lt: end },
    status: { not: "cancelled" },
    OR: [
      { payment: { is: { status: "confirmed" } } },
      { payment: { is: null }, paymentConfirmed: true },
    ],
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  const rawRange = request.nextUrl.searchParams.get("range") ?? "today";
  if (!isDashboardRange(rawRange)) {
    return badRequest('range must be one of "today", "week", "month" or "year".');
  }

  try {
    const now = new Date();
    const period = buildDashboardPeriod(rawRange, now);

    const [confirmedSales, cancelledCount, activeProducts] = await Promise.all([
      prisma.sale.findMany({
        where: confirmedSaleWhere(period.start, period.end),
        include: {
          payment: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  barcode: true,
                  costPrice: true,
                },
              },
            },
          },
        },
      }),
      prisma.sale.count({
        where: {
          createdAt: { gte: period.start, lt: period.end },
          status: "cancelled",
        },
      }),
      prisma.product.findMany({
        where: { isActive: true, quantity: { gt: 0 } },
        include: { category: true },
        orderBy: { quantity: "desc" },
      }),
    ]);

    let grossRevenue = 0;
    let subtotalRevenue = 0;
    let taxCollected = 0;
    let discountsGiven = 0;
    let costOfGoodsSold = 0;
    let unitsSold = 0;

    const methodMap = new Map<string, { orders: number; amount: number }>();
    const productStats = new Map<
      string,
      {
        productId: string;
        name: string;
        barcode: string;
        unitsSold: number;
        revenue: number;
        cogs: number;
      }
    >();

    for (const sale of confirmedSales) {
      const finalAmt = Number(sale.finalAmount);
      grossRevenue += finalAmt;
      subtotalRevenue += Number(sale.totalAmount);
      taxCollected += Number(sale.tax);
      discountsGiven += Number(sale.discount);

      const method = (sale.payment?.paymentMethod ?? sale.paymentMethod ?? "other")
        .trim() || "other";
      const mEntry = methodMap.get(method) ?? { orders: 0, amount: 0 };
      mEntry.orders += 1;
      mEntry.amount += finalAmt;
      methodMap.set(method, mEntry);

      for (const item of sale.items) {
        const lineRevenue = Number(item.total);
        const unitCost = Number(item.product.costPrice);
        const lineCogs = unitCost * item.quantity;
        costOfGoodsSold += lineCogs;
        unitsSold += item.quantity;

        const pid = item.productId.toString();
        const existing = productStats.get(pid) ?? {
          productId: pid,
          name: item.product.name,
          barcode: item.product.barcode,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
        };
        existing.unitsSold += item.quantity;
        existing.revenue += lineRevenue;
        existing.cogs += lineCogs;
        productStats.set(pid, existing);
      }
    }

    const confirmedOrders = confirmedSales.length;
    const netSalesExTax = Math.max(0, subtotalRevenue - discountsGiven);
    const grossProfit = netSalesExTax - costOfGoodsSold;
    const grossMarginPercent =
      netSalesExTax > 0 ? (grossProfit / netSalesExTax) * 100 : 0;
    const averageOrderValue =
      confirmedOrders > 0 ? grossRevenue / confirmedOrders : 0;

    const paymentBreakdown = Array.from(methodMap.entries())
      .map(([method, entry]) => ({
        method,
        orders: entry.orders,
        amount: entry.amount,
        share: confirmedOrders > 0 ? entry.orders / confirmedOrders : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topProfitProducts = Array.from(productStats.values())
      .map((entry) => {
        const profit = entry.revenue - entry.cogs;
        return {
          ...entry,
          profit,
          marginPercent:
            entry.revenue > 0 ? (profit / entry.revenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const slowMovingProducts = activeProducts
      .map((p) => {
        const sold = productStats.get(p.id.toString())?.unitsSold ?? 0;
        const unitCost = Number(p.costPrice) || Number(p.price);
        return {
          productId: p.id.toString(),
          name: p.name,
          barcode: p.barcode,
          category: p.category?.name ?? null,
          stock: p.quantity,
          stockValue: p.quantity * unitCost,
          unitsSold: sold,
        };
      })
      .sort((a, b) => a.unitsSold - b.unitsSold || b.stockValue - a.stockValue)
      .slice(0, 10);

    return json(
      {
        generatedAt: now.toISOString(),
        timeZone: BUSINESS_TIME_ZONE,
        range: {
          key: period.key,
          label: period.label,
          contextLabel: period.contextLabel,
          comparisonLabel: period.comparisonLabel,
          start: period.start.toISOString(),
          end: period.end.toISOString(),
          previousStart: period.previousStart.toISOString(),
          previousEnd: period.previousEnd.toISOString(),
        },
        financials: {
          grossRevenue,
          subtotalRevenue,
          taxCollected,
          discountsGiven,
          costOfGoodsSold,
          grossProfit,
          grossMarginPercent,
          confirmedOrders,
          cancelledOrders: cancelledCount,
          averageOrderValue,
          unitsSold,
        },
        paymentBreakdown,
        topProfitProducts,
        slowMovingProducts,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Reports query failed:", error);
    return serverError("Unable to generate report.");
  }
}
