import { useId } from "react";
import type { DashboardStockMovement } from "@/types/api";
import {
  formatCount,
  formatRelativeDateTime,
  stockMovementLabel,
} from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { Panel, PanelEmpty, PanelHeader, PanelLink } from "./panel";

export function StockActivity({
  movements,
}: {
  movements: DashboardStockMovement[];
}) {
  const titleId = useId();
  const now = useNow(60_000);

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title="Stock activity"
        description="Latest inventory movements"
        action={<PanelLink href="/stock">Inventory</PanelLink>}
      />

      {movements.length === 0 ? (
        <PanelEmpty
          title="No stock movements yet"
          description="Receipts and stock issues will appear here."
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {movements.map((movement) => {
            const incoming = movement.type === "IN";
            return (
              <li
                key={movement.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground sm:text-sm">
                    {movement.product}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {stockMovementLabel(movement.type)} ·{" "}
                    {formatRelativeDateTime(movement.date, now)}
                  </p>
                </div>
                <p
                  className={
                    incoming
                      ? "shrink-0 text-sm font-semibold tabular-nums text-success"
                      : "shrink-0 text-sm font-semibold tabular-nums text-foreground"
                  }
                >
                  {incoming ? "+" : "−"}
                  {formatCount(movement.quantity)}
                  <span className="ml-1 text-[11px] font-normal text-muted">
                    units
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
