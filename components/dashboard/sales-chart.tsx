"use client";

import { useEffect, useId, useState } from "react";
import type {
  DashboardRangeSummary,
  DashboardTrend,
  DashboardTrendPoint,
} from "@/types/api";
import {
  formatCompactNumber,
  formatCount,
  formatMoney,
} from "@/lib/format";
import { useElementWidth } from "@/hooks/useElementWidth";
import { Panel, PanelEmpty, PanelHeader, PanelLink } from "./panel";

const CHART_HEIGHT = 244;
const SERIES_COLOR = "#1f8f3a";

function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0];

  const roughStep = max / 4;
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / 10 ** exponent;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  const step = Math.max(1, niceFraction * 10 ** exponent);

  let top = Math.ceil(max / step) * step;
  // Keep the highest tick above the highest data point so the line never
  // touches the top edge of the plot.
  if (top <= max) top += step;

  const ticks: number[] = [];
  for (let value = 0; value <= top + step * 1e-9; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks;
}

function labelIndexes(count: number, width: number): number[] {
  const maxLabels = width < 480 ? 4 : 6;
  if (count <= maxLabels) {
    return Array.from({ length: count }, (_, index) => index);
  }

  const step = Math.ceil((count - 1) / (maxLabels - 1));
  const indexes: number[] = [];
  for (let index = 0; index < count; index += step) {
    indexes.push(index);
  }
  const last = count - 1;
  if (indexes[indexes.length - 1] !== last) {
    indexes.push(last);
  }
  return indexes;
}

function granularityLabel(granularity: DashboardTrend["granularity"]): string {
  if (granularity === "hour") return "hourly";
  if (granularity === "month") return "monthly";
  return "daily";
}

function ChartPlot({
  points,
  range,
  granularity,
}: {
  points: DashboardTrendPoint[];
  range: DashboardRangeSummary;
  granularity: DashboardTrend["granularity"];
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const summaryId = useId();

  useEffect(() => {
    setActiveIndex(null);
  }, [points]);

  const height = CHART_HEIGHT;
  const compact = width > 0 && width < 420;
  const margin = {
    top: 24,
    right: 10,
    bottom: 28,
    left: compact ? 46 : 56,
  };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const ticks = niceTicks(Math.max(0, ...points.map((point) => point.revenue)));
  const topTick = ticks[ticks.length - 1] ?? 0;

  const xFor = (index: number) =>
    points.length <= 1
      ? margin.left + innerWidth / 2
      : margin.left + (innerWidth * index) / (points.length - 1);
  const yFor = (value: number) =>
    topTick === 0
      ? margin.top + innerHeight
      : margin.top + innerHeight - (value / topTick) * innerHeight;

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(
          point.revenue,
        ).toFixed(2)}`,
    )
    .join(" ");
  const baseline = margin.top + innerHeight;
  const areaPath =
    points.length > 1
      ? `${linePath} L ${xFor(points.length - 1).toFixed(2)} ${baseline.toFixed(
          2,
        )} L ${xFor(0).toFixed(2)} ${baseline.toFixed(2)} Z`
      : "";

  const totalOrders = points.reduce((sum, point) => sum + point.orders, 0);
  const totalRevenue = points.reduce((sum, point) => sum + point.revenue, 0);
  const active =
    activeIndex !== null && activeIndex < points.length
      ? points[activeIndex]
      : null;
  const activeX = activeIndex !== null ? xFor(activeIndex) : 0;
  const tooltipHalf = Math.min(96, Math.max(0, width / 2 - 8));
  const tooltipLeft = Math.min(
    Math.max(activeX, tooltipHalf),
    Math.max(tooltipHalf, width - tooltipHalf),
  );
  const labelWidth = compact ? 10 : 11;

  return (
    <div ref={ref} className="relative">
      {width === 0 ? (
        <div
          className="h-[244px] w-full animate-pulse rounded-lg bg-surface-subtle/60"
          aria-hidden="true"
        />
      ) : (
        <figure className="relative m-0" aria-labelledby={summaryId}>
          <figcaption id={summaryId} className="sr-only">
        {`Revenue trend for ${range.label}: ${formatMoney(totalRevenue)} in ${formatCount(
          totalOrders,
        )} confirmed ${totalOrders === 1 ? "order" : "orders"}.`}
      </figcaption>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block max-w-full"
        aria-hidden="true"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width === 0 || innerWidth === 0) return;
          const pointerX =
            ((event.clientX - rect.left) / rect.width) * width;
          const ratio = (pointerX - margin.left) / innerWidth;
          const index = Math.round(ratio * (points.length - 1));
          if (index >= 0 && index < points.length) {
            setActiveIndex(index);
          }
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={SERIES_COLOR}
              stopOpacity="0.16"
            />
            <stop
              offset="100%"
              stopColor={SERIES_COLOR}
              stopOpacity="0.01"
            />
          </linearGradient>
        </defs>

        <text
          x={0}
          y={11}
          fontSize={10}
          fill="var(--color-muted)"
          aria-hidden="true"
        >
          TSh
        </text>

        {ticks.map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                stroke="var(--color-chart-grid)"
                strokeWidth={1}
              />
              <text
                x={margin.left - 8}
                y={y + 3}
                textAnchor="end"
                fontSize={labelWidth}
                fill="var(--color-muted)"
                className="tabular-nums"
              >
                {formatCompactNumber(tick)}
              </text>
            </g>
          );
        })}

        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={baseline}
          y2={baseline}
          stroke="var(--color-border-hover)"
          strokeWidth={1.25}
        />

        {points.length > 1 ? (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={SERIES_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : null}

        {points.length === 1 ? (
          <circle
            cx={xFor(0)}
            cy={yFor(points[0].revenue)}
            r={4}
            fill={SERIES_COLOR}
            stroke="#ffffff"
            strokeWidth={2}
          />
        ) : null}

        {labelIndexes(points.length, width).map((index) => (
          <text
            key={points[index].bucket}
            x={xFor(index)}
            y={height - 8}
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
            fontSize={labelWidth}
            fill="var(--color-muted)"
            className="tabular-nums"
          >
            {points[index].label}
          </text>
        ))}

        {active ? (
          <>
            <line
              x1={activeX}
              x2={activeX}
              y1={margin.top}
              y2={baseline}
              stroke="var(--color-border-hover)"
              strokeWidth={1}
            />
            <circle
              cx={activeX}
              cy={yFor(active.revenue)}
              r={4}
              fill={SERIES_COLOR}
              stroke="#ffffff"
              strokeWidth={2}
            />
          </>
        ) : null}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-0 z-10 w-[190px] -translate-x-1/2 rounded-lg border border-border bg-background px-3 py-2 shadow-soft"
          style={{ left: tooltipLeft }}
          aria-hidden="true"
        >
          <p className="text-[11px] text-muted">{active.fullLabel}</p>
          <p className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(active.revenue)}
            </span>
            <span className="text-[11px] text-muted">
              {formatCount(active.orders)}{" "}
              {active.orders === 1 ? "order" : "orders"}
            </span>
          </p>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>
          Revenue by {granularityLabel(granularity)} for {range.label}
        </caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Revenue</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.bucket}>
              <th scope="row">{point.fullLabel}</th>
              <td>{formatMoney(point.revenue)}</td>
              <td>{formatCount(point.orders)}</td>
            </tr>
          ))}
        </tbody>
      </table>
        </figure>
      )}
    </div>
  );
}

export function SalesChart({
  trend,
  range,
}: {
  trend: DashboardTrend;
  range: DashboardRangeSummary;
}) {
  const titleId = useId();

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title="Sales trend"
        description={`Confirmed revenue · ${granularityLabel(
          trend.granularity,
        )} · ${range.label}`}
        action={<PanelLink href="/sales">View sales</PanelLink>}
      />

      {trend.points.length === 0 ? (
        <PanelEmpty
          title="No sales in this period"
          description="The trend appears as soon as a confirmed sale is recorded."
        />
      ) : (
        <>
          <div className="relative px-4 pt-4 sm:px-5">
            <ChartPlot
              points={trend.points}
              range={range}
              granularity={trend.granularity}
            />
          </div>
          <p className="border-t border-border/70 px-4 py-2.5 text-[11px] text-muted sm:px-5">
            Confirmed revenue only — cancelled sales and unconfirmed payments
            are excluded.
          </p>
        </>
      )}
    </Panel>
  );
}
