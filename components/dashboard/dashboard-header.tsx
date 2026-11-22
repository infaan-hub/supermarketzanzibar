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
      className="page-banner rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Executive Overview
          </p>
          <h1
            id="dashboard-title"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Business overview
          </h1>
          <p className="mt-1 text-sm text-muted">
            {greetingFor(generatedAt)}
            {userName ? `, ${userName}` : ""}. Here&apos;s how the store is
            performing right now.
          </p>
        </div>

        <div className="shrink-0 rounded-xl border border-border/70 bg-white/80 px-3.5 py-2 text-left shadow-sm sm:text-right">
          <p className="font-display text-sm font-semibold tabular-nums text-foreground">
            {formatBusinessDate(generatedAt)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatBusinessTime(generatedAt)} EAT · Updated {updatedLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 items-center gap-2.5 sm:w-auto">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">
            Period
          </span>
          <div
            role="group"
            aria-label="Reporting period"
            className="grid min-w-0 flex-1 grid-cols-4 rounded-xl border border-border/80 bg-white/85 p-1 shadow-sm sm:inline-flex sm:w-auto sm:flex-none"
          >
            {DASHBOARD_RANGE_OPTIONS.map((option) => {
              const active = option.key === range;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={
                    active
                      ? "h-8 rounded-lg bg-gradient-to-b from-teal-600 to-teal-700 px-2.5 font-display text-xs font-semibold text-white shadow-sm sm:px-3.5 sm:text-[13px] cursor-pointer"
                      : "h-8 rounded-lg px-2.5 font-display text-xs font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-foreground sm:px-3.5 sm:text-[13px] cursor-pointer"
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
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-teal-400/70 hover:bg-surface-subtle disabled:cursor-wait disabled:opacity-70 sm:px-3.5 sm:text-sm cursor-pointer"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"}
          >
            <RefreshIcon
              className={
                refreshing ? "h-4 w-4 animate-spin text-teal-600" : "h-4 w-4 text-teal-700"
              }
            />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>
    </section>
  );
}
