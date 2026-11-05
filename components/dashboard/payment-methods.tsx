import Link from "next/link";
import { useId } from "react";
import type { DashboardPaymentMethod } from "@/types/api";
import {
  formatCount,
  formatMoneyAdaptive,
  formatPercent,
  paymentMethodLabel,
} from "@/lib/format";
import { Panel, PanelEmpty, PanelHeader, PanelLink } from "./panel";

const METHOD_COLORS = [
  "#15722d",
  "#1f8f3a",
  "#4eae66",
  "#86c596",
  "#b9dcc2",
];

interface DisplayMethod {
  method: string;
  orders: number;
  amount: number;
  share: number;
  color: string;
}

function buildDisplayMethods(
  methods: DashboardPaymentMethod[],
): DisplayMethod[] {
  const totalOrders = methods.reduce((sum, method) => sum + method.orders, 0);
  if (totalOrders === 0) return [];

  const visible = methods
    .filter((method) => method.method !== "other")
    .slice(0, 4);
  const visibleMethods = new Set(visible.map((method) => method.method));
  const remaining = methods.filter(
    (method) => !visibleMethods.has(method.method),
  );

  const grouped: Array<{
    method: string;
    orders: number;
    amount: number;
  }> = visible.map((method) => ({
    method: method.method,
    orders: method.orders,
    amount: method.amount,
  }));

  if (remaining.length > 0) {
    grouped.push({
      method: "other",
      orders: remaining.reduce((sum, method) => sum + method.orders, 0),
      amount: remaining.reduce((sum, method) => sum + method.amount, 0),
    });
  }

  return grouped.map((method, index) => ({
    ...method,
    share: method.orders / totalOrders,
    color: METHOD_COLORS[index % METHOD_COLORS.length],
  }));
}

export function PaymentMethods({
  methods,
}: {
  methods: DashboardPaymentMethod[];
}) {
  const titleId = useId();
  const display = buildDisplayMethods(methods);
  const totalOrders = display.reduce((sum, method) => sum + method.orders, 0);

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title="Payment methods"
        description={`Share of ${formatCount(totalOrders)} confirmed ${
          totalOrders === 1 ? "order" : "orders"
        }`}
        action={<PanelLink href="/sales">View sales</PanelLink>}
      />

      {display.length === 0 ? (
        <PanelEmpty
          title="No confirmed payments yet"
          description="The payment mix appears once an order has a confirmed payment."
          action={
            <Link
              href="/pos"
              className="text-xs font-medium text-primary-hover hover:text-foreground"
            >
              Open point of sale
            </Link>
          }
        />
      ) : (
        <>
          <div className="px-4 pt-4 sm:px-5">
            <div
              className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-surface-muted"
              role="img"
              aria-label={display
                .map(
                  (method) =>
                    `${paymentMethodLabel(method.method)} ${formatPercent(
                      method.share,
                      0,
                    )}`,
                )
                .join(", ")}
            >
              {display.map((method) => (
                <span
                  key={method.method}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${method.share * 100}%`,
                    backgroundColor: method.color,
                  }}
                />
              ))}
            </div>
          </div>

          <ul className="mt-2 divide-y divide-border/70">
            {display.map((method) => (
              <li
                key={method.method}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: method.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {paymentMethodLabel(method.method)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatCount(method.orders)}{" "}
                      {method.orders === 1 ? "order" : "orders"} ·{" "}
                      {formatMoneyAdaptive(method.amount)}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatPercent(method.share, 0)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
