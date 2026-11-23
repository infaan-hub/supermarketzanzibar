import { useId } from "react";
import Link from "next/link";
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
        title="Order Reports"
        description={`${formatCount(sales.length)}+ New orders processed this period`}
        action={<PanelLink href="/sales">View More</PanelLink>}
      />

      {sales.length === 0 ? (
        <PanelEmpty
          title="No orders yet"
          description="Completed and pending orders will appear here."
          action={
            <PanelLink href="/pos">Open point of sale</PanelLink>
          }
        />
      ) : (
        <div className="overflow-x-auto p-4 pt-3">
          <table className="w-full table-fixed border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="bg-[#38383f] text-xs font-medium text-[#d4d4d8]">
                <th
                  scope="col"
                  className="w-[38%] rounded-l-full px-4 py-2.5 text-left font-medium sm:w-[34%]"
                >
                  Customer
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2.5 text-left font-medium sm:table-cell sm:w-[20%]"
                >
                  Order number
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2.5 text-left font-medium md:table-cell md:w-[18%]"
                >
                  Payment
                </th>
                <th
                  scope="col"
                  className="w-[30%] px-3 py-2.5 text-right font-medium sm:w-[16%]"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="w-[32%] rounded-r-full px-4 py-2.5 text-right font-medium sm:w-[18%]"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, idx) => {
                const avatarColors = [
                  "bg-[#eab308] text-[#18181b]",
                  "bg-[#38bdf8] text-[#0f172a]",
                  "bg-[#ef4b42] text-white",
                  "bg-[#4ade80] text-[#0f172a]",
                ];
                return (
                  <tr
                    key={sale.id}
                    className="align-middle transition-colors hover:bg-white/[0.04]"
                  >
                    <td className="min-w-0 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                            avatarColors[idx % avatarColors.length]
                          }`}
                        >
                          {sale.customer.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/sales/${sale.id}`}
                            className="block truncate text-xs font-semibold text-white hover:text-[#ef4b42] sm:text-[13px]"
                          >
                            {sale.customer}
                          </Link>
                          <p className="truncate text-[10px] text-muted sm:hidden">
                            #{sale.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-[#d4d4d8] sm:table-cell">
                      <Link href={`/sales/${sale.id}`} className="hover:text-[#ef4b42] hover:underline">
                        #{String(sale.id).padStart(8, "0")}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <p className="truncate text-xs font-medium text-[#d4d4d8]">
                        {paymentMethodLabel(sale.paymentMethod)}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {paymentStatusLabel(sale.paymentStatus)}
                      </p>
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-white"
                      title={formatMoney(sale.amount)}
                    >
                      {formatMoneyAdaptive(sale.amount)}
                      <span className="sr-only">
                        {" "}
                        ({formatMoney(sale.amount)})
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <StatusBadge
                        label={shortSaleStatus(sale.status)}
                        tone={saleStatusTone(sale.status)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
