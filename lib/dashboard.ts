// Dashboard aggregation service.
//
// Every figure here is computed from the Prisma models (or from SQL
// aggregations over the same tables). Revenue only counts confirmed payments,
// plus legacy sales that were marked paid before a payment row existed.
// Cancelled sales are never revenue.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildDashboardBuckets,
  buildDashboardPeriod,
} from "@/lib/dashboard-range";
import { metricDelta } from "@/lib/dashboard-metrics";
import { BUSINESS_TIME_ZONE } from "@/lib/timezone";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import type {
  DashboardInventory,
  DashboardLowStockItem,
  DashboardOverview,
  DashboardPaymentMethod,
  DashboardRange,
  DashboardRecentSale,
  DashboardStats,
  DashboardStockMovement,
  DashboardTopSeller,
  DashboardTrendPoint,
} from "@/types/api";

const RECENT_SALES_LIMIT = 6;
const LOW_STOCK_LIMIT = 6;
const TOP_SELLERS_LIMIT = 5;
const STOCK_MOVEMENT_LIMIT = 4;

function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Confirmed revenue: a confirmed payment, or a paid sale with no payment row. */
function revenueWhere(start: Date, end: Date): Prisma.SaleWhereInput {
  return {
    createdAt: { gte: start, lt: end },
    status: { not: "cancelled" },
    OR: [
      { payment: { is: { status: "confirmed" } } },
      { payment: { is: null }, paymentConfirmed: true },
    ],
  };
}

interface RevenueTotals {
  revenue: number;
  orders: number;
}

async function revenueTotals(
  where: Prisma.SaleWhereInput,
): Promise<RevenueTotals> {
  const result = await prisma.sale.aggregate({
    where,
    _sum: { finalAmount: true },
    _count: { _all: true },
  });

  return {
    revenue: toNumber(result._sum.finalAmount),
    orders: result._count._all,
  };
}

interface TrendRow {
  bucket: Date;
  orders: number;
  revenue: string;
}

interface MethodRow {
  method: string;
  orders: number;
  amount: string;
}

interface InventoryRow {
  active_products: number;
  total_units: number;
  stock_value: string;
  low_stock: number;
  out_of_stock: number;
}

async function inventoryTotals(): Promise<DashboardInventory> {
  const [row] = await prisma.$queryRaw<InventoryRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE is_active)::int AS active_products,
      COALESCE(SUM(quantity) FILTER (WHERE is_active), 0)::int AS total_units,
      COALESCE(SUM(quantity * cost_price) FILTER (WHERE is_active), 0)::text AS stock_value,
      COUNT(*) FILTER (WHERE is_active AND quantity <= ${LOW_STOCK_THRESHOLD})::int AS low_stock,
      COUNT(*) FILTER (WHERE is_active AND quantity <= 0)::int AS out_of_stock
    FROM supermarketzanzibar_product
  `;

  return {
    activeProducts: row?.active_products ?? 0,
    totalUnits: row?.total_units ?? 0,
    stockValue: toNumber(row?.stock_value),
    lowStockCount: row?.low_stock ?? 0,
    outOfStockCount: row?.out_of_stock ?? 0,
  };
}

export async function getDashboardOverview(
  rangeKey: DashboardRange,
): Promise<DashboardOverview> {
  const now = new Date();
  const period = buildDashboardPeriod(rangeKey, now);
  const buckets = buildDashboardBuckets(period);

  const [
    trendRows,
    methodRows,
    previous,
    pending,
    inventory,
    lowStockRows,
    recentSalesRows,
    topSellerRows,
    stockMovementRows,
  ] = await Promise.all([
    prisma.$queryRaw<TrendRow[]>`
      SELECT
        date_trunc(
          ${period.granularity}::text,
          s.created_at AT TIME ZONE ${BUSINESS_TIME_ZONE}::text
        ) AT TIME ZONE ${BUSINESS_TIME_ZONE}::text AS bucket,
        COUNT(*)::int AS orders,
        COALESCE(SUM(s.final_amount), 0)::text AS revenue
      FROM supermarketzanzibar_sale s
      LEFT JOIN supermarketzanzibar_payment p ON p.sale_id = s.id
      WHERE s.created_at >= ${period.start}
        AND s.created_at < ${period.end}
        AND s.status <> 'cancelled'
        AND (
          p.status = 'confirmed'
          OR (p.id IS NULL AND s.payment_confirmed = true)
        )
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<MethodRow[]>`
      SELECT
        COALESCE(p.payment_method, s.payment_method) AS method,
        COUNT(*)::int AS orders,
        COALESCE(SUM(s.final_amount), 0)::text AS amount
      FROM supermarketzanzibar_sale s
      LEFT JOIN supermarketzanzibar_payment p ON p.sale_id = s.id
      WHERE s.created_at >= ${period.start}
        AND s.created_at < ${period.end}
        AND s.status <> 'cancelled'
        AND (
          p.status = 'confirmed'
          OR (p.id IS NULL AND s.payment_confirmed = true)
        )
      GROUP BY 1
      ORDER BY orders DESC, method ASC
    `,
    revenueTotals(
      revenueWhere(period.previousStart, period.previousEnd),
    ),
    prisma.sale.aggregate({
      where: {
        status: { not: "cancelled" },
        payment: { is: { status: "pending" } },
      },
      _count: { _all: true },
      _sum: { finalAmount: true },
    }),
    inventoryTotals(),
    prisma.product.findMany({
      where: {
        isActive: true,
        quantity: { lte: LOW_STOCK_THRESHOLD },
      },
      orderBy: [{ quantity: "asc" }, { name: "asc" }],
      take: LOW_STOCK_LIMIT,
      select: {
        id: true,
        name: true,
        barcode: true,
        quantity: true,
        price: true,
        category: { select: { name: true } },
      },
    }),
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_SALES_LIMIT,
      select: {
        id: true,
        status: true,
        finalAmount: true,
        paymentMethod: true,
        paymentConfirmed: true,
        createdAt: true,
        customerFullName: true,
        payment: { select: { status: true, paymentMethod: true } },
        customer: {
          select: {
            user: {
              select: { fullName: true, firstName: true, lastName: true, username: true },
            },
          },
        },
        items: { select: { quantity: true } },
      },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: revenueWhere(period.start, period.end) },
      _sum: { quantity: true, total: true },
      orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }],
      take: TOP_SELLERS_LIMIT,
    }),
    prisma.stockMovement.findMany({
      orderBy: { date: "desc" },
      take: STOCK_MOVEMENT_LIMIT,
      select: {
        id: true,
        quantity: true,
        movementType: true,
        date: true,
        product: { select: { name: true } },
      },
    }),
  ]);

  const revenueByBucket = new Map<
    number,
    { revenue: number; orders: number }
  >();
  for (const row of trendRows) {
    revenueByBucket.set(row.bucket.getTime(), {
      revenue: toNumber(row.revenue),
      orders: row.orders,
    });
  }

  const trendPoints: DashboardTrendPoint[] = buckets.map((bucket) => {
    const found = revenueByBucket.get(bucket.start.getTime());
    return {
      bucket: bucket.start.toISOString(),
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      revenue: found?.revenue ?? 0,
      orders: found?.orders ?? 0,
    };
  });

  const currentRevenue = trendPoints.reduce(
    (sum, point) => sum + point.revenue,
    0,
  );
  const currentOrders = trendPoints.reduce(
    (sum, point) => sum + point.orders,
    0,
  );
  const currentAverageOrder = currentOrders
    ? currentRevenue / currentOrders
    : 0;
  const previousAverageOrder = previous.orders
    ? previous.revenue / previous.orders
    : 0;

  const methodOrders = methodRows.reduce((sum, row) => sum + row.orders, 0);
  const paymentMethods: DashboardPaymentMethod[] = methodRows.map((row) => ({
    method: row.method?.trim() || "other",
    orders: row.orders,
    amount: toNumber(row.amount),
    share: methodOrders > 0 ? row.orders / methodOrders : 0,
  }));

  const lowStockItems: DashboardLowStockItem[] = lowStockRows.map((product) => ({
    id: product.id.toString(),
    name: product.name,
    barcode: product.barcode,
    category: product.category?.name ?? null,
    quantity: product.quantity,
    threshold: LOW_STOCK_THRESHOLD,
    price: toNumber(product.price),
  }));

  const recentSales: DashboardRecentSale[] = recentSalesRows.map((sale) => {
    const profileName = sale.customer?.user;
    const customer =
      sale.customerFullName.trim() ||
      profileName?.fullName.trim() ||
      [profileName?.firstName, profileName?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      profileName?.username ||
      "Walk-in customer";

    return {
      id: sale.id.toString(),
      customer,
      items: sale.items.length,
      units: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      amount: toNumber(sale.finalAmount),
      paymentMethod:
        sale.payment?.paymentMethod ?? sale.paymentMethod ?? "other",
      paymentStatus:
        sale.payment?.status ?? (sale.paymentConfirmed ? "confirmed" : null),
      status: sale.status,
      createdAt: sale.createdAt.toISOString(),
    };
  });

  const topProductIds = topSellerRows.map((row) => row.productId);
  const topProducts = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true },
      })
    : [];
  const productNameById = new Map(
    topProducts.map((product) => [product.id.toString(), product.name]),
  );

  const topSellers: DashboardTopSeller[] = topSellerRows.map((row) => ({
    productId: row.productId.toString(),
    name: productNameById.get(row.productId.toString()) ?? "Unknown product",
    quantity: row._sum.quantity ?? 0,
    revenue: toNumber(row._sum.total),
  }));

  const stockMovements: DashboardStockMovement[] = stockMovementRows.map(
    (movement) => ({
      id: movement.id.toString(),
      product: movement.product.name,
      type: movement.movementType,
      quantity: movement.quantity,
      date: movement.date.toISOString(),
    }),
  );

  return {
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
    metrics: {
      revenue: metricDelta(currentRevenue, previous.revenue),
      orders: metricDelta(currentOrders, previous.orders),
      averageOrderValue: metricDelta(
        currentAverageOrder,
        previousAverageOrder,
      ),
    },
    trend: {
      granularity: period.granularity,
      points: trendPoints,
    },
    paymentMethods,
    inventory,
    lowStock: {
      items: lowStockItems,
      total: inventory.lowStockCount,
    },
    pendingPayments: {
      count: pending._count._all,
      amount: toNumber(pending._sum.finalAmount),
    },
    recentSales,
    topSellers,
    stockMovements,
  };
}

/** Legacy stats endpoint, using the same corrected revenue and timezone rules. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const today = buildDashboardPeriod("today", now);
  const week = buildDashboardPeriod("week", now);
  const month = buildDashboardPeriod("month", now);

  const [todayTotals, weekTotals, monthTotals, pending, inventory, totalCustomers] =
    await Promise.all([
      revenueTotals(revenueWhere(today.start, today.end)),
      revenueTotals(revenueWhere(week.start, week.end)),
      revenueTotals(revenueWhere(month.start, month.end)),
      prisma.sale.aggregate({
        where: {
          status: { not: "cancelled" },
          payment: { is: { status: "pending" } },
        },
        _count: { _all: true },
      }),
      inventoryTotals(),
      prisma.customer.count(),
    ]);

  return {
    totalSalesToday: todayTotals.revenue,
    totalSalesWeek: weekTotals.revenue,
    totalSalesMonth: monthTotals.revenue,
    lowStockCount: inventory.lowStockCount,
    pendingPayments: pending._count._all,
    totalCustomers,
    totalProducts: inventory.activeProducts,
  };
}
