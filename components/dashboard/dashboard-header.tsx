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
    <section aria-labelledby="dashboard-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-hover">
            Overview
          </p>
          <h1
            id="dashboard-title"
            className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            Business overview
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {greetingFor(generatedAt)}
            {userName ? `, ${userName}` : ""}. Here&apos;s how the store is
            performing.
          </p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-medium tabular-nums text-foreground">
            {formatBusinessDate(generatedAt)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            As of {formatBusinessTime(generatedAt)} EAT · Updated{" "}
            {updatedLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-y border-border/70 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-xs font-medium text-muted">
            Period
          </span>
          <div
            role="group"
            aria-label="Reporting period"
            className="grid min-w-0 flex-1 grid-cols-4 rounded-lg bg-surface-muted p-0.5 sm:inline-flex sm:w-auto sm:flex-none"
          >
            {DASHBOARD_RANGE_OPTIONS.map((option) => {
              const active = option.key === range;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={
                    active
                      ? "h-8 rounded-md bg-foreground px-2 text-xs font-medium text-background shadow-sm sm:px-3 sm:text-[13px]"
                      : "h-8 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:px-3 sm:text-[13px]"
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
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border-hover hover:bg-surface-subtle disabled:cursor-wait disabled:opacity-70 sm:px-3 sm:text-sm"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"}
          >
            <RefreshIcon
              className={
                refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4 text-muted"
              }
            />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>
    </section>
  );
}
