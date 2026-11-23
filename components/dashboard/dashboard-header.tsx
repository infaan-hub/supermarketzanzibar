"use client";

import type { DashboardOverview, DashboardRange } from "@/types/api";
import { DASHBOARD_RANGE_OPTIONS } from "@/lib/dashboard-range";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import {
  formatBusinessDate,
  formatBusinessTime,
  formatRelativeDateTime,
} from "@/lib/format";
import { getZonedParts } from "@/lib/timezone";
import { useNow } from "@/hooks/useNow";
import { AlertsMenu } from "./alerts-menu";
import { RefreshIcon } from "./icons";

function greetingFor(generatedAt: string): string {
  const hour = getZonedParts(new Date(generatedAt)).hour;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({
  data,
  lastUpdated,
  range,
  onRangeChange,
  refreshing,
  onRefresh,
  userName,
}: {
  data: DashboardOverview;
  lastUpdated: Date | null;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  refreshing: boolean;
  onRefresh: () => void;
  userName: string | null;
}) {
  const now = useNow(30_000);
  const generatedAt = data.generatedAt;
  const updatedAt = lastUpdated ?? new Date(generatedAt);
  const updatedLabel = formatRelativeDateTime(updatedAt, now);

  return (
    <section
      aria-labelledby="dashboard-title"
      className="space-y-4 border-b border-border pb-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1
            id="dashboard-title"
            className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl"
          >
            Marketplace Overview
          </h1>
          <p className="text-sm text-muted">
            <span className="font-semibold text-[#4CAF50]">
              {greetingFor(generatedAt)}
              {userName ? `, ${userName}` : ""} ·{" "}
            </span>
            Live Marketplace orders, popular products, and stock activity.
          </p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xs font-medium tabular-nums text-foreground">
            {formatBusinessDate(generatedAt)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {formatBusinessTime(generatedAt)} EAT · Updated {updatedLabel}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-xs font-medium text-muted">
            Period
          </span>
          <div
            role="group"
            aria-label="Reporting period"
            className="grid min-w-0 flex-1 grid-cols-4 rounded-full border border-white/10 bg-[#151518] p-1 sm:inline-flex sm:w-auto sm:flex-none"
          >
            {DASHBOARD_RANGE_OPTIONS.map((option) => {
              const active = option.key === range;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={
                    active
                      ? "h-7 rounded-full bg-[#4CAF50] px-3 text-xs font-semibold text-white shadow-sm cursor-pointer"
                      : "h-7 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:text-white cursor-pointer"
                  }
                  aria-pressed={active}
                  onClick={() => onRangeChange(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="sr-only" aria-live="polite">
            {refreshing
              ? "Refreshing dashboard"
              : `Dashboard updated ${updatedLabel}`}
          </span>

          <AlertsMenu
            lowStock={data.lowStock.total}
            outOfStock={data.inventory.outOfStockCount}
            pendingCount={data.pendingPayments.count}
            pendingAmount={data.pendingPayments.amount}
            threshold={LOW_STOCK_THRESHOLD}
          />

          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-border-hover hover:bg-surface-subtle disabled:cursor-wait disabled:opacity-70 cursor-pointer"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"}
          >
            <RefreshIcon
              className={
                refreshing ? "h-3.5 w-3.5 animate-spin text-primary" : "h-3.5 w-3.5 text-muted"
              }
            />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>
    </section>
  );
}
