import { useId } from "react";
import type { DashboardTopSeller } from "@/types/api";
import {
  formatCount,
  formatMoney,
  formatMoneyAdaptive,
} from "@/lib/format";
import { Panel, PanelEmpty, PanelHeader, PanelLink } from "./panel";

export function TopSellers({
  sellers,
  rangeLabel,
}: {
  sellers: DashboardTopSeller[];
  rangeLabel: string;
}) {
  const titleId = useId();
  const maxQuantity = Math.max(1, sellers[0]?.quantity ?? 1);

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title="Top sellers"
        description={`By units sold · ${rangeLabel}`}
        action={<PanelLink href="/products">Products</PanelLink>}
      />

      {sellers.length === 0 ? (
        <PanelEmpty
          title="No products sold in this period"
          description="Top sellers appear after confirmed sales are recorded."
        />
      ) : (
        <ol className="divide-y divide-border/70">
          {sellers.map((seller, index) => (
            <li
              key={seller.productId}
              className="flex items-center gap-3 px-4 py-3 sm:px-5"
            >
              <span className="w-5 shrink-0 text-[11px] font-medium tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground sm:text-sm">
                  {seller.name}
                </p>
                <div
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(
                        2,
                        (seller.quantity / maxQuantity) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCount(seller.quantity)}
                  <span className="ml-1 text-[11px] font-normal text-muted">
                    sold
                  </span>
                </p>
                <p
                  className="mt-0.5 text-[11px] tabular-nums text-muted"
                  title={formatMoney(seller.revenue)}
                >
                  {formatMoneyAdaptive(seller.revenue)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
