import { useId } from "react";
import type { DashboardInventory } from "@/types/api";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import {
  formatCount,
  formatMoney,
  formatMoneyAdaptive,
} from "@/lib/format";
import { Panel, PanelHeader, PanelLink } from "./panel";

function InventoryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={
          tone === "danger"
            ? "text-sm font-semibold tabular-nums text-danger"
            : tone === "warning"
              ? "text-sm font-semibold tabular-nums text-warning"
              : "text-sm font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function InventorySummary({
  inventory,
}: {
  inventory: DashboardInventory;
}) {
  const titleId = useId();

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title="Inventory position"
        description="Current stock across active products"
        action={<PanelLink href="/stock">Open inventory</PanelLink>}
      />

      <div className="px-4 py-4 sm:px-5">
        <p className="text-xs text-muted">Stock value at cost</p>
        <p
          className="mt-1.5 font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground"
          title={formatMoney(inventory.stockValue)}
        >
          {formatMoneyAdaptive(inventory.stockValue)}
        </p>
      </div>

      <dl className="divide-y divide-border/70 border-t border-border/70">
        <InventoryRow
          label="Active products"
          value={formatCount(inventory.activeProducts)}
        />
        <InventoryRow
          label="Units on hand"
          value={formatCount(inventory.totalUnits)}
        />
        <InventoryRow
          label="Low stock"
          value={formatCount(inventory.lowStockCount)}
          tone={inventory.lowStockCount > 0 ? "warning" : undefined}
        />
        <InventoryRow
          label="Out of stock"
          value={formatCount(inventory.outOfStockCount)}
          tone={inventory.outOfStockCount > 0 ? "danger" : undefined}
        />
      </dl>

      <p className="border-t border-border/70 px-4 py-2.5 text-[11px] text-muted sm:px-5">
        Low stock means {LOW_STOCK_THRESHOLD} units or fewer. Stock value uses
        the product cost price.
      </p>
    </Panel>
  );
}
