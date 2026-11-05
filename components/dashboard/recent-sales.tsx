import { useId } from "react";
import type { DashboardRecentSale } from "@/types/api";
import {
  formatCount,
  formatMoney,
  formatMoneyAdaptive,
  paymentMethodLabel,
  paymentStatusLabel,
  saleStatusTone,
  statusLabel,
} from "@/lib/format";
import { Panel, PanelEmpty, PanelHeader, PanelLink } from "./panel";
import { StatusBadge } from "./status-badge";

function shortSaleStatus(status: string): string {
  if (status === "pending_payment") return "Pending";
  return statusLabel(status);
}

export function RecentSales({ sales }: { sales: DashboardRecentSale[] }) {
  const titleId = useId();

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title="Recent sales"
        description="Latest orders across all statuses"
        action={<PanelLink href="/sales">All sales</PanelLink>}
      />

      {sales.length === 0 ? (
        <PanelEmpty
          title="No sales yet"
          description="Completed and pending orders will appear here."
          action={
            <PanelLink href="/pos">Open point of sale</PanelLink>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-border/70 text-xs text-muted">
                <th
                  scope="col"
                  className="w-[46%] px-2.5 py-2 text-left font-normal sm:w-[52%] sm:px-4 md:w-[33%]"
                >
                  Sale
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2 text-right font-normal sm:table-cell sm:w-[10%]"
                >
                  Items
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2 text-left font-normal md:table-cell md:w-[20%]"
                >
                  Payment
                </th>
                <th
                  scope="col"
                  className="w-[28%] px-2.5 py-2 text-left font-normal sm:w-[17%] sm:px-3 md:w-[16%]"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="w-[26%] px-2.5 py-2 text-right font-normal sm:w-[21%] sm:px-4 md:w-[21%]"
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="align-middle transition-colors hover:bg-surface-subtle/60"
                >
                  <td className="min-w-0 px-2.5 py-3 sm:px-4">
                    <p className="truncate text-[13px] font-medium text-foreground sm:text-sm">
                      {sale.customer}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      #{sale.id} · {formatCount(sale.units)}{" "}
                      {sale.units === 1 ? "unit" : "units"}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 text-right text-xs tabular-nums text-muted sm:table-cell">
                    {formatCount(sale.items)}
                  </td>
                  <td className="hidden px-3 py-3 md:table-cell">
                    <p className="truncate text-xs font-medium text-foreground">
                      {paymentMethodLabel(sale.paymentMethod)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {paymentStatusLabel(sale.paymentStatus)}
                    </p>
                  </td>
                  <td className="px-2.5 py-3 sm:px-3">
                    <StatusBadge
                      label={shortSaleStatus(sale.status)}
                      tone={saleStatusTone(sale.status)}
                    />
                  </td>
                  <td
                    className="whitespace-nowrap px-2.5 py-3 text-right text-xs font-medium tabular-nums text-foreground sm:px-4 sm:text-sm"
                    title={formatMoney(sale.amount)}
                  >
                    {formatMoneyAdaptive(sale.amount)}
                    <span className="sr-only">
                      {" "}
                      ({formatMoney(sale.amount)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
