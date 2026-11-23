// GET /api/reports?range=today|week|month|year
//
// End-of-day (Z-Report) and gross profit analytics using `price` and `costPrice`
// across the Africa/Dar_es_Salaam business timezone (manager/admin only).

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, json, serverError } from "@/lib/http";
import { requireManager } from "@/lib/auth/request";
import { roleDescription, roleLabel } from "@/lib/auth/roles";
import { buildDashboardPeriod, isDashboardRange } from "@/lib/dashboard-range";
import { BUSINESS_TIME_ZONE } from "@/lib/timezone";
import type { RoleActivityReport, RoleMemberReportRow } from "@/types/api";

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

    const [
      confirmedSales,
      cancelledCount,
      activeProducts,
      allUsers,
      periodMovements,
      periodPurchaseOrders,
      periodGoodsReceipts,
      periodAuditLogs,
    ] = await Promise.all([
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
        select: {
          id: true,
          name: true,
          barcode: true,
          price: true,
          costPrice: true,
          quantity: true,
          category: { select: { name: true } },
        },
        orderBy: { quantity: "desc" },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          lastLogin: true,
        },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      }),
      prisma.stockMovement
        .findMany({
          where: { date: { gte: period.start, lt: period.end } },
          select: { performedById: true, quantity: true },
        })
        .catch(() => [] as Array<{ performedById: bigint | null; quantity: number }>),
      prisma.purchaseOrder
        .findMany({
          where: { createdAt: { gte: period.start, lt: period.end } },
          select: {
            createdById: true,
            supplier: { select: { userId: true } },
          },
        })
        .catch(
          () =>
            [] as Array<{
              createdById: bigint | null;
              supplier: { userId: bigint } | null;
            }>,
        ),
      prisma.goodsReceipt
        .findMany({
          where: { receivedAt: { gte: period.start, lt: period.end } },
          select: {
            receivedById: true,
            supplier: { select: { userId: true } },
          },
        })
        .catch(
          () =>
            [] as Array<{
              receivedById: bigint | null;
              supplier: { userId: bigint } | null;
            }>,
        ),
      prisma.auditLog
        .findMany({
          where: { createdAt: { gte: period.start, lt: period.end } },
          select: {
            actorId: true,
            action: true,
            summary: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
        .catch(
          () =>
            [] as Array<{
              actorId: bigint | null;
              action: string;
              summary: string;
              createdAt: Date;
            }>,
        ),
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

    // Build All Roles Activity & Performance Reports across every system role.
    const userActivityMap = new Map<
      string,
      {
        salesProcessedCount: number;
        salesRevenueAmount: number;
        stockMovementsCount: number;
        stockUnitsMoved: number;
        purchaseOrdersCount: number;
        goodsReceiptsCount: number;
        auditActionsCount: number;
        lastActionSummary: string | null;
      }
    >();

    const ensureUserStats = (uid: string) => {
      let entry = userActivityMap.get(uid);
      if (!entry) {
        entry = {
          salesProcessedCount: 0,
          salesRevenueAmount: 0,
          stockMovementsCount: 0,
          stockUnitsMoved: 0,
          purchaseOrdersCount: 0,
          goodsReceiptsCount: 0,
          auditActionsCount: 0,
          lastActionSummary: null,
        };
        userActivityMap.set(uid, entry);
      }
      return entry;
    };

    for (const sale of confirmedSales) {
      const amt = Number(sale.finalAmount);
      const actorIds = new Set<string>();
      if (sale.userId) actorIds.add(sale.userId.toString());
      if (sale.payment?.confirmedById) {
        actorIds.add(sale.payment.confirmedById.toString());
      }
      for (const uid of actorIds) {
        const st = ensureUserStats(uid);
        st.salesProcessedCount += 1;
        st.salesRevenueAmount += amt;
      }
    }

    for (const mv of periodMovements) {
      if (!mv.performedById) continue;
      const st = ensureUserStats(mv.performedById.toString());
      st.stockMovementsCount += 1;
      st.stockUnitsMoved += Math.abs(mv.quantity);
    }

    for (const po of periodPurchaseOrders) {
      if (po.createdById) {
        ensureUserStats(po.createdById.toString()).purchaseOrdersCount += 1;
      }
      if (po.supplier?.userId) {
        ensureUserStats(po.supplier.userId.toString()).purchaseOrdersCount += 1;
      }
    }

    for (const gr of periodGoodsReceipts) {
      if (gr.receivedById) {
        ensureUserStats(gr.receivedById.toString()).goodsReceiptsCount += 1;
      }
      if (gr.supplier?.userId) {
        ensureUserStats(gr.supplier.userId.toString()).goodsReceiptsCount += 1;
      }
    }

    for (const log of periodAuditLogs) {
      if (!log.actorId) continue;
      const st = ensureUserStats(log.actorId.toString());
      st.auditActionsCount += 1;
      if (!st.lastActionSummary && log.summary) {
        st.lastActionSummary = log.summary;
      }
    }

    const orderedRoleKeys = [
      "manager",
      "marketmaster",
      "supplier",
      "admin",
      "customer",
      "viewer",
    ];
    const membersByRole = new Map<string, RoleMemberReportRow[]>();
    for (const rk of orderedRoleKeys) {
      membersByRole.set(rk, []);
    }

    for (const u of allUsers) {
      const rKey = (u.role || "viewer").trim().toLowerCase();
      if (!membersByRole.has(rKey)) {
        membersByRole.set(rKey, []);
      }
      const uid = u.id.toString();
      const st = ensureUserStats(uid);
      membersByRole.get(rKey)!.push({
        id: uid,
        username: u.username,
        fullName: u.fullName || u.username,
        email: u.email,
        phone: u.phone,
        role: rKey,
        roleLabel: roleLabel(rKey),
        isActive: u.isActive,
        lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
        salesProcessedCount: st.salesProcessedCount,
        salesRevenueAmount: st.salesRevenueAmount,
        stockMovementsCount: st.stockMovementsCount,
        stockUnitsMoved: st.stockUnitsMoved,
        purchaseOrdersCount: st.purchaseOrdersCount,
        goodsReceiptsCount: st.goodsReceiptsCount,
        auditActionsCount: st.auditActionsCount,
        lastActionSummary: st.lastActionSummary,
      });
    }

    const roleReports: RoleActivityReport[] = Array.from(
      membersByRole.entries(),
    ).map(([rKey, members]) => {
      const signedInPeriodCount = members.filter((m) => {
        if (!m.lastLogin) return false;
        const ts = new Date(m.lastLogin).getTime();
        return ts >= period.start.getTime() && ts < period.end.getTime();
      }).length;

      return {
        role: rKey,
        roleLabel: roleLabel(rKey),
        description: roleDescription(rKey),
        totalUsers: members.length,
        activeUsers: members.filter((m) => m.isActive).length,
        signedInPeriodCount,
        salesProcessedCount: members.reduce(
          (s, m) => s + m.salesProcessedCount,
          0,
        ),
        salesRevenueAmount: members.reduce(
          (s, m) => s + m.salesRevenueAmount,
          0,
        ),
        stockMovementsCount: members.reduce(
          (s, m) => s + m.stockMovementsCount,
          0,
        ),
        stockUnitsMoved: members.reduce((s, m) => s + m.stockUnitsMoved, 0),
        purchaseOrdersCount: members.reduce(
          (s, m) => s + m.purchaseOrdersCount,
          0,
        ),
        goodsReceiptsCount: members.reduce(
          (s, m) => s + m.goodsReceiptsCount,
          0,
        ),
        auditActionsCount: members.reduce((s, m) => s + m.auditActionsCount, 0),
        members,
      };
    });

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
        roleReports,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Reports query failed:", error);
    return serverError("Unable to generate report.");
  }
}
