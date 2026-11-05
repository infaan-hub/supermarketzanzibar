// Dashboard page.
//
// One period control drives the revenue metrics, trend, payment mix and top
// sellers. Current facts (inventory, pending payments, recent sales and stock
// activity) are always shown as of now.

"use client";

import { useEffect, useState } from "react";
import type { DashboardRange } from "@/types/api";
import { useDashboard } from "@/hooks/useDashboard";
import { readWelcomeName } from "@/lib/auth/client";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { DashboardNotice } from "@/components/dashboard/dashboard-notice";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { PaymentMethods } from "@/components/dashboard/payment-methods";
import { LowStockTable } from "@/components/dashboard/low-stock";
import { InventorySummary } from "@/components/dashboard/inventory-summary";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { TopSellers } from "@/components/dashboard/top-sellers";
import { StockActivity } from "@/components/dashboard/stock-activity";

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("today");
  const [userName, setUserName] = useState<string | null>(null);
  const { data, loading, refreshing, error, lastUpdated, refresh } =
    useDashboard(range);

  useEffect(() => {
    setUserName(readWelcomeName());
  }, []);

  if (!data && loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <DashboardError
        error={error ?? new Error("No dashboard data was returned.")}
        onRetry={refresh}
      />
    );
  }

  const currentRangeData = data.range.key === range;
  if (error && !currentRangeData) {
    return <DashboardError error={error} onRetry={refresh} />;
  }

  const refreshError = error && currentRangeData ? error : null;

  return (
    <div className="relative isolate mx-auto w-full max-w-[1400px] space-y-5 sm:space-y-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(78,173,99,0.12),transparent_64%)]"
        aria-hidden="true"
      />

      <DashboardHeader
        data={data}
        lastUpdated={lastUpdated}
        range={range}
        onRangeChange={setRange}
        refreshing={refreshing}
        onRefresh={refresh}
        userName={userName}
      />

      {refreshError ? (
        <DashboardNotice error={refreshError} onRetry={refresh} />
      ) : null}

      <div
        className="space-y-5 sm:space-y-6"
        aria-busy={refreshing}
      >
        <MetricStrip data={data} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <SalesChart trend={data.trend} range={data.range} />
          <PaymentMethods methods={data.paymentMethods} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <LowStockTable
            lowStock={data.lowStock}
            inventory={data.inventory}
          />
          <InventorySummary inventory={data.inventory} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <RecentSales sales={data.recentSales} />
          <div className="space-y-5">
            <TopSellers
              sellers={data.topSellers}
              rangeLabel={data.range.label}
            />
            <StockActivity movements={data.stockMovements} />
          </div>
        </div>
      </div>
    </div>
  );
}
