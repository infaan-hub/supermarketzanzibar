// Reports & End-of-Day Z-Report page (`/reports`, manager/admin only).
//
// Computes confirmed revenue, COGS (from Product.costPrice), gross profit &
// margin %, tax collected, payment drawer breakdown, top profitable items,
// and slow-moving stock across the Africa/Dar_es_Salaam business timezone.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/components/auth/auth-provider";
import { portalHref } from "@/lib/auth/roles";
import { fetchReports } from "@/lib/api";
import {
  formatBusinessDateTime,
  formatMoney,
  formatPercent,
  paymentMethodLabel,
} from "@/lib/format";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { cn } from "@/lib/utils";
import type {
  DashboardRange,
  ReportsResponse,
  RoleActivityReport,
  RoleMemberReportRow,
} from "@/types/api";

const RANGES: Array<{ key: DashboardRange; label: string }> = [
  { key: "today", label: "Today (Z-Report)" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function downloadCsvFile(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const val = String(cell ?? "");
          return val.includes(",") || val.includes('"') || val.includes("\n")
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportReportCsv(report: ReportsResponse) {
  const roleReports = report.roleReports ?? [];
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
    [
      "Top Profitable Product",
      "Barcode",
      "Units Sold",
      "Revenue",
      "COGS",
      "Profit",
      "Margin %",
    ],
    ...report.topProfitProducts.map((p) => [
      p.name,
      p.barcode,
      String(p.unitsSold),
      String(p.revenue),
      String(p.cogs),
      String(p.profit),
      p.marginPercent.toFixed(1),
    ]),
    [],
    [
      "Role Summary",
      "Active Users",
      "Total Users",
      "Signed In (Period)",
      "POS Orders Processed",
      "POS Revenue (TZS)",
      "Stock Movements",
      "Units Moved",
      "Purchase Orders",
      "Goods Receipts",
      "Audit Actions",
    ],
    ...roleReports.map((r) => [
      r.roleLabel,
      String(r.activeUsers),
      String(r.totalUsers),
      String(r.signedInPeriodCount),
      String(r.salesProcessedCount),
      String(r.salesRevenueAmount),
      String(r.stockMovementsCount),
      String(r.stockUnitsMoved),
      String(r.purchaseOrdersCount),
      String(r.goodsReceiptsCount),
      String(r.auditActionsCount),
    ]),
  ];

  downloadCsvFile(
    `z-report-${report.range.key}-${new Date().toISOString().slice(0, 10)}.csv`,
    rows,
  );
}

function exportAllRolesReportCsv(
  report: ReportsResponse,
  filterRole?: string,
) {
  const allRoles = report.roleReports ?? [];
  const roles = filterRole
    ? allRoles.filter((r) => r.role === filterRole)
    : allRoles;

  const rows: string[][] = [
    [
      "Marketplace — All Roles Activity & Performance Report",
      report.range.label,
      report.range.contextLabel,
    ],
    ["Generated At", report.generatedAt, report.timeZone],
    [],
    [
      "Role",
      "Description",
      "Active Users",
      "Total Users",
      "Signed In (Period)",
      "POS Orders",
      "POS Revenue (TZS)",
      "Stock Movements",
      "Units Moved",
      "Purchase Orders",
      "Goods Receipts",
      "Audit Actions",
    ],
    ...roles.map((r) => [
      r.roleLabel,
      r.description,
      String(r.activeUsers),
      String(r.totalUsers),
      String(r.signedInPeriodCount),
      String(r.salesProcessedCount),
      String(r.salesRevenueAmount),
      String(r.stockMovementsCount),
      String(r.stockUnitsMoved),
      String(r.purchaseOrdersCount),
      String(r.goodsReceiptsCount),
      String(r.auditActionsCount),
    ]),
    [],
    [
      "Role",
      "Full Name",
      "Username",
      "Email",
      "Phone",
      "Status",
      "Last Login",
      "POS Orders",
      "POS Revenue (TZS)",
      "Stock Movements",
      "Units Moved",
      "Purchase Orders",
      "Goods Receipts",
      "Audit Actions",
      "Latest Activity",
    ],
    ...roles.flatMap((r) =>
      r.members.map((m) => [
        r.roleLabel,
        m.fullName,
        m.username,
        m.email,
        m.phone,
        m.isActive ? "Active" : "Disabled",
        m.lastLogin ?? "Never",
        String(m.salesProcessedCount),
        String(m.salesRevenueAmount),
        String(m.stockMovementsCount),
        String(m.stockUnitsMoved),
        String(m.purchaseOrdersCount),
        String(m.goodsReceiptsCount),
        String(m.auditActionsCount),
        m.lastActionSummary ?? "—",
      ]),
    ),
  ];

  const suffix = filterRole ? `${filterRole}-role` : "all-roles";
  downloadCsvFile(
    `marketplace-${suffix}-report-${report.range.key}-${new Date().toISOString().slice(0, 10)}.csv`,
    rows,
  );
}

function exportSingleMemberReportCsv(
  report: ReportsResponse,
  member: RoleMemberReportRow,
) {
  const rows: string[][] = [
    ["Marketplace — Staff & Role Member Performance Report"],
    ["Period", report.range.label, report.range.contextLabel],
    ["Generated At", report.generatedAt, report.timeZone],
    [],
    ["Field", "Value"],
    ["Full Name", member.fullName],
    ["Username", `@${member.username}`],
    ["Role", member.roleLabel],
    ["Email", member.email],
    ["Phone", member.phone],
    ["Account Status", member.isActive ? "Active" : "Disabled"],
    ["Last Login", member.lastLogin ?? "Never"],
    ["POS Orders Processed", String(member.salesProcessedCount)],
    ["POS Revenue Processed (TZS)", String(member.salesRevenueAmount)],
    ["Stock Movements Performed", String(member.stockMovementsCount)],
    ["Stock Units Moved", String(member.stockUnitsMoved)],
    ["Purchase Orders Handled", String(member.purchaseOrdersCount)],
    ["Goods Receipts Recorded", String(member.goodsReceiptsCount)],
    ["Audit Actions Logged", String(member.auditActionsCount)],
    ["Latest Activity", member.lastActionSummary ?? "No activity in period"],
  ];

  downloadCsvFile(
    `marketplace-${member.role}-${member.username}-${report.range.key}.csv`,
    rows,
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const [range, setRange] = useState<DashboardRange>("today");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
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

  const roleReports: RoleActivityReport[] = useMemo(
    () => data?.roleReports ?? [],
    [data?.roleReports],
  );
  const visibleRoleReports = useMemo(
    () =>
      selectedRoleFilter === "all"
        ? roleReports
        : roleReports.filter((r) => r.role === selectedRoleFilter),
    [roleReports, selectedRoleFilter],
  );
  const visibleRoleMembers = useMemo(
    () => visibleRoleReports.flatMap((r) => r.members),
    [visibleRoleReports],
  );

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
        title="Reports, All Roles Analytics & End-of-Day Z-Report"
        description={`${settings.storeName} · ${data.range.contextLabel} · Generated ${formatBusinessDateTime(data.generatedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              size="sm"
              variant="default"
              onClick={() => exportAllRolesReportCsv(data)}
            >
              Download All Roles Report (CSV)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => exportReportCsv(data)}
            >
              Export Z-Report CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.print()}
            >
              Print Report
            </Button>
          </div>
        }
      />

      {/* Period Switcher */}
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-white/10 bg-[#151518] p-1 print:hidden">
        {RANGES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setRange(item.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              range === item.key
                ? "bg-[#4CAF50] text-white shadow-sm"
                : "text-muted hover:text-white",
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
                          href={portalHref(user?.role, `/products/${p.productId}`)}
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

      {/* ALL ROLES ACTIVITY & PERFORMANCE REPORTS STUDIO */}
      <section aria-labelledby="all-roles-report-heading" className="space-y-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="all-roles-report-heading"
              className="font-display text-lg font-bold text-white"
            >
              All Roles Activity &amp; Performance Reports
            </h2>
            <p className="text-xs text-muted">
              <span className="font-semibold text-[#4CAF50]">
                Role Supervision ·{" "}
              </span>
              View and download operational activity reports across Manager,
              MarketMaster, Supplier, Admin, Customer, and Viewer accounts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {selectedRoleFilter !== "all" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  exportAllRolesReportCsv(data, selectedRoleFilter)
                }
              >
                Download Selected Role CSV
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={() => exportAllRolesReportCsv(data)}
            >
              Download All Roles Report (CSV)
            </Button>
          </div>
        </div>

        {/* Role Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <button
            type="button"
            onClick={() => setSelectedRoleFilter("all")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              selectedRoleFilter === "all"
                ? "bg-[#4CAF50] text-white shadow-sm"
                : "border border-white/10 bg-[#2a2a2e] text-muted hover:text-white",
            )}
          >
            All Roles ({roleReports.reduce((s, r) => s + r.totalUsers, 0)})
          </button>
          {roleReports.map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => setSelectedRoleFilter(r.role)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                selectedRoleFilter === r.role
                  ? "bg-[#4CAF50] text-white shadow-sm"
                  : "border border-white/10 bg-[#2a2a2e] text-muted hover:text-white",
              )}
            >
              {r.roleLabel} ({r.totalUsers})
            </button>
          ))}
        </div>

        {/* Role Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRoleReports.map((roleItem) => (
            <Card key={roleItem.role} className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base text-white">
                      {roleItem.roleLabel} Role Report
                    </CardTitle>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                      {roleItem.description}
                    </p>
                  </div>
                  <Badge variant="default">
                    {roleItem.activeUsers} / {roleItem.totalUsers} Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-[#1c1c1e] p-3 text-xs">
                  <div>
                    <span className="block text-[10px] text-muted">
                      POS Orders / Revenue
                    </span>
                    <span className="font-semibold text-white tabular-nums">
                      {roleItem.salesProcessedCount} ·{" "}
                      {formatMoney(roleItem.salesRevenueAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted">
                      Stock Movements / Units
                    </span>
                    <span className="font-semibold text-white tabular-nums">
                      {roleItem.stockMovementsCount} ({roleItem.stockUnitsMoved}{" "}
                      units)
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted">
                      POs / Goods Received
                    </span>
                    <span className="font-semibold text-white tabular-nums">
                      {roleItem.purchaseOrdersCount} PO ·{" "}
                      {roleItem.goodsReceiptsCount} GRN
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted">
                      Signed In / Audit Logs
                    </span>
                    <span className="font-semibold text-white tabular-nums">
                      {roleItem.signedInPeriodCount} signed in ·{" "}
                      {roleItem.auditActionsCount} logs
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 print:hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRoleFilter(
                        selectedRoleFilter === roleItem.role
                          ? "all"
                          : roleItem.role,
                      )
                    }
                    className="text-xs font-semibold text-[#4CAF50] hover:underline cursor-pointer"
                  >
                    {selectedRoleFilter === roleItem.role
                      ? "Show All Roles"
                      : `Filter ${roleItem.roleLabel} Members`}
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      exportAllRolesReportCsv(data, roleItem.role)
                    }
                  >
                    Download {roleItem.roleLabel} CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Per-Member Role Activity Breakdown Table */}
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                Role Members &amp; Operational Activity Breakdown (
                {visibleRoleMembers.length})
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Individual account activity for {data.range.label} across{" "}
                {selectedRoleFilter === "all"
                  ? "all store roles"
                  : selectedRoleFilter}
                .
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visibleRoleMembers.length === 0 ? (
              <div className="p-6 text-sm text-muted">
                No user accounts found for this role filter.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User &amp; Role</TableHead>
                    <TableHead>Status &amp; Last Sign-In</TableHead>
                    <TableHead className="text-right">POS Sales</TableHead>
                    <TableHead className="text-right">Stock Moves</TableHead>
                    <TableHead className="text-right">PO / GRN</TableHead>
                    <TableHead className="text-right">Audit Logs</TableHead>
                    <TableHead className="text-right print:hidden">
                      Download
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRoleMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4CAF50] text-xs font-bold text-white">
                            {m.fullName.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-semibold text-white">
                              {m.fullName}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted">
                              <span>@{m.username}</span>
                              <span>·</span>
                              <span className="font-semibold text-[#4CAF50]">
                                {m.roleLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={m.isActive ? "success" : "danger"}>
                            {m.isActive ? "Active" : "Disabled"}
                          </Badge>
                          <span className="text-[11px] text-muted">
                            {m.lastLogin
                              ? formatBusinessDateTime(m.lastLogin)
                              : "Never signed in"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="block font-semibold text-white">
                          {formatMoney(m.salesRevenueAmount)}
                        </span>
                        <span className="text-[11px] text-muted">
                          {m.salesProcessedCount} orders
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="block font-semibold text-white">
                          {m.stockMovementsCount}
                        </span>
                        <span className="text-[11px] text-muted">
                          {m.stockUnitsMoved} units
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-semibold text-white">
                          {m.purchaseOrdersCount} PO
                        </span>{" "}
                        <span className="text-xs text-muted">
                          / {m.goodsReceiptsCount} GRN
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="block font-semibold text-white">
                          {m.auditActionsCount}
                        </span>
                        {m.lastActionSummary && (
                          <span
                            className="block max-w-[160px] truncate text-[10px] text-muted"
                            title={m.lastActionSummary}
                          >
                            {m.lastActionSummary}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right print:hidden">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => exportSingleMemberReportCsv(data, m)}
                        >
                          CSV
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
