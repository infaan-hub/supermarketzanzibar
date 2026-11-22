import type {
  DashboardMetricDelta,
  DashboardOverview,
} from "@/types/api";
import {
  formatCount,
  formatMoney,
  formatMoneyAdaptive,
  formatPercent,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { MinusIcon, TrendDownIcon, TrendUpIcon } from "./icons";

function changeLabel(
  delta: DashboardMetricDelta,
  formatChange: (value: number) => string,
): string {
  const sign = delta.change >= 0 ? "+" : "−";
  const absoluteChange = Math.abs(delta.change);

  if (delta.direction === "new") {
    return `${sign}${formatChange(absoluteChange)} (new)`;
  }

  const absolutePercent = Math.abs(delta.changePercent ?? 0);
  if (absolutePercent > 999 && delta.previous > 0) {
    const multiple = Math.abs(delta.current / delta.previous);
    return `${sign}${multiple.toFixed(1)}×`;
  }

  return `${sign}${formatPercent(absolutePercent / 100, 1)}`;
}

function DeltaLine({
  delta,
  comparisonLabel,
  formatChange,
}: {
  delta: DashboardMetricDelta;
  comparisonLabel: string;
  formatChange: (value: number) => string;
}) {
  const flat = delta.direction === "flat";
  const positive = delta.direction === "up" || delta.direction === "new";

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium tabular-nums",
          flat ? "text-muted" : positive ? "text-success" : "text-danger",
        )}
      >
        {flat ? (
          <MinusIcon />
        ) : positive ? (
          <TrendUpIcon />
        ) : (
          <TrendDownIcon />
        )}
        {flat ? "No change" : changeLabel(delta, formatChange)}
      </span>
      <span className="text-muted">{comparisonLabel}</span>
    </div>
  );
}

function FactLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted sm:text-xs">
      {children}
      <span>Current</span>
    </div>
  );
}

function MetricCell({
  label,
  value,
  title,
  accent = "bg-teal-500",
  children,
}: {
  label: string;
  value: React.ReactNode;
  title?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-white/95 p-4 shadow-card transition-shadow hover:shadow-soft xl:p-5">
      <div className={cn("absolute inset-x-0 top-0 h-1", accent)} aria-hidden="true" />
      <dt className="font-display text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-2.5 min-w-0">
        <span
          className="block whitespace-nowrap font-display text-[22px] font-bold leading-none tracking-tight tabular-nums text-foreground sm:text-2xl"
          title={title}
        >
          {value}
        </span>
        {children}
      </dd>
    </div>
  );
}

export function MetricStrip({ data }: { data: DashboardOverview }) {
  const { metrics, inventory, pendingPayments, range } = data;

  return (
    <section aria-label="Key metrics">
      <dl className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <MetricCell
          label="Net sales"
          accent="bg-gradient-to-r from-teal-500 to-emerald-500"
          value={
            <>
              {formatMoneyAdaptive(metrics.revenue.current)}
              <span className="sr-only">
                {" "}
                ({formatMoney(metrics.revenue.current)})
              </span>
            </>
          }
          title={formatMoney(metrics.revenue.current)}
        >
          <DeltaLine
            delta={metrics.revenue}
            comparisonLabel={range.comparisonLabel}
            formatChange={formatMoney}
          />
        </MetricCell>

        <MetricCell
          label="Orders"
          value={formatCount(metrics.orders.current)}
        >
          <DeltaLine
            delta={metrics.orders}
            comparisonLabel={range.comparisonLabel}
            formatChange={formatCount}
          />
        </MetricCell>

        <MetricCell
          label="Average order"
          value={
            <>
              {formatMoneyAdaptive(metrics.averageOrderValue.current)}
              <span className="sr-only">
                {" "}
                ({formatMoney(metrics.averageOrderValue.current)})
              </span>
            </>
          }
          title={formatMoney(metrics.averageOrderValue.current)}
        >
          <DeltaLine
            delta={metrics.averageOrderValue}
            comparisonLabel={range.comparisonLabel}
            formatChange={formatMoney}
          />
        </MetricCell>

        <MetricCell
          label="Low stock"
          accent="bg-gradient-to-r from-amber-400 to-orange-500"
          value={formatCount(inventory.lowStockCount)}
        >
          <FactLine>
            {inventory.outOfStockCount > 0 ? (
              <span className="font-medium text-warning">
                {formatCount(inventory.outOfStockCount)} out of stock
              </span>
            ) : (
              <span>All items stocked</span>
            )}
          </FactLine>
        </MetricCell>

        <MetricCell
          label="Pending payments"
          accent="bg-gradient-to-r from-cyan-500 to-teal-600"
          value={formatCount(pendingPayments.count)}
        >
          <FactLine>
            {pendingPayments.count > 0 ? (
              <span
                className="font-medium text-warning"
                title={formatMoney(pendingPayments.amount)}
              >
                {formatMoneyAdaptive(pendingPayments.amount)} awaiting
              </span>
            ) : (
              <span>None outstanding</span>
            )}
          </FactLine>
        </MetricCell>

        <MetricCell
          label="Active products"
          value={formatCount(inventory.activeProducts)}
        >
          <FactLine>
            <span>{formatCount(inventory.totalUnits)} units on hand</span>
          </FactLine>
        </MetricCell>
      </dl>
    </section>
  );
}
