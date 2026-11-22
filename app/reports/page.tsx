// Reports & End-of-Day Z-Report page (`/reports`, manager/admin only).
//
// Computes confirmed revenue, COGS (from Product.costPrice), gross profit &
// margin %, tax collected, payment drawer breakdown, top profitable items,
// and slow-moving stock across the Africa/Dar_es_Salaam business timezone.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchReports } from "@/lib/api";
import {
  formatBusinessDateTime,
  formatMoney,
  formatPercent,
  paymentMethodLabel,
} from "@/lib/format";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { cn } from "@/lib/utils";
import type { DashboardRange, ReportsResponse } from "@/types/api";

const RANGES: Array<{ key: DashboardRange; label: string }> = [
  { key: "today", label: "Today (Z-Report)" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function exportReportCsv(report: ReportsResponse) {
  const rows: string[][] = [
    ["Report Period", report.range.label, report.range.contextLabel],
    ["Generated At", report.generatedAt, report.timeZone],
    [],
    ["Metric", "Value"],
    ["Gross Revenue (TZS)", String(report.financials.grossRevenue)],
    ["Subtotal (TZS)", String(report.financials.subtotalRevenue)],
    ["Discounts Given (TZS)", String(report.financials.discountsGiven)],
    ["Tax Collected (TZS)", String(report.financials.taxCollected)],
    ["Cost of Goods Sold (TZS)", String(report.financials.costOfGoodsSold)],
    ["Gross Profit (TZS)", String(report.financials.grossProfit)],
    ["Gross Margin (%)", report.financials.grossMarginPercent.toFixed(2)],
    ["Confirmed Orders", String(report.financials.confirmedOrders)],
    ["Cancelled Orders", String(report.financials.cancelledOrders)],
    ["Units Sold", String(report.financials.unitsSold)],
    [],
    ["Payment Method", "Orders", "Amount (TZS)"],
    ...report.paymentBreakdown.map((m) => [
      paymentMethodLabel(m.method),
      String(m.orders),
      String(m.amount),
    ]),
    [],
    ["Top Profitable Product", "Barcode", "Units Sold", "Revenue", "COGS", "Profit", "Margin %"],
    ...report.topProfitProducts.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.barcode,
      String(p.unitsSold),
      String(p.revenue),
      String(p.cogs),
      String(p.profit),
      p.marginPercent.toFixed(1),
    ]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `z-report-${report.range.key}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { settings } = useStoreSettings();
  const [range, setRange] = useState<DashboardRange>("today");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchReports(range);
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to generate report.",
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-1/3" />
        <div className="h-80 rounded-lg border border-border p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Reports &amp; Z-Report</h1>
        <EmptyState
          title="Unable to generate report"
          description={error ?? "No data available."}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const f = data.financials;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Financial Intelligence · Z-Report"
        title="Reports & End-of-Day Z-Report"
        description={`${settings.storeName} · ${data.range.contextLabel} · Generated ${formatBusinessDateTime(data.generatedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button size="sm" variant="secondary" onClick={() => exportReportCsv(data)}>
              Export CSV
            </Button>
            <Button size="sm" variant="default" onClick={() => window.print()}>
              Print Z-Report
            </Button>
          </div>
        }
      />

      {/* Period Switcher */}
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-white/90 p-1 shadow-sm print:hidden">
        {RANGES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setRange(item.key)}
            className={cn(
              "rounded-xl px-3.5 py-2 font-display text-xs font-semibold transition-all cursor-pointer",
              range === item.key
                ? "bg-gradient-to-b from-teal-600 to-teal-700 text-white shadow-sm"
                : "text-muted hover:bg-surface-subtle hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Financial KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted">Gross Revenue</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {formatMoney(f.grossRevenue)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {f.confirmedOrders} confirmed · {f.cancelledOrders} cancelled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted">Gross Profit</p>
            <p className="mt-1 font-display text-2xl font-bold text-success tabular-nums">
              {formatMoney(f.grossProfit)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Margin: {f.grossMarginPercent.toFixed(1)}% · COGS:{" "}
              {formatMoney(f.costOfGoodsSold)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted">Tax Collected</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {formatMoney(f.taxCollected)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Discounts: {formatMoney(f.discountsGiven)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted">Avg Basket / Units</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {formatMoney(f.averageOrderValue)}
            </p>
            <p className="mt-1 text-xs text-muted">{f.unitsSold} units sold</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Drawer Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method Breakdown (Shift Closeout)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.paymentBreakdown.length === 0 ? (
            <div className="p-6 text-sm text-muted">
              No confirmed payments in this period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Method</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Collected Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.paymentBreakdown.map((m) => (
                  <TableRow key={m.method}>
                    <TableCell className="font-medium">
                      {paymentMethodLabel(m.method)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.orders}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted">
                      {formatPercent(m.share, 1)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatMoney(m.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Top Profitable Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Profitable Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topProfitProducts.length === 0 ? (
              <div className="p-6 text-sm text-muted">
                No product sales recorded in this period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProfitProducts.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell>
                        <Link
                          href={`/products/${p.productId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="text-[11px] text-muted">
                          Margin: {p.marginPercent.toFixed(1)}%
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.unitsSold}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(p.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-success tabular-nums">
                        {formatMoney(p.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Slow-Moving / High-Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle>Slow-Moving Inventory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.slowMovingProducts.length === 0 ? (
              <div className="p-6 text-sm text-muted">
                No stocked products to evaluate.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slowMovingProducts.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell>
                        <Link
                          href={`/products/${p.productId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="text-[11px] text-muted">
                          {p.category ?? "Uncategorized"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.unitsSold === 0 ? "warning" : "secondary"}>
                          {p.unitsSold}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.stock}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(p.stockValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
