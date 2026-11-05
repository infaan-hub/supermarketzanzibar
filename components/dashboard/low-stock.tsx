import { useId } from "react";
import type {
  DashboardInventory,
  DashboardLowStockItem,
} from "@/types/api";
import { LOW_STOCK_THRESHOLD, stockState } from "@/lib/inventory";
import { formatCount, formatMoney } from "@/lib/format";
import { Panel, PanelEmpty, PanelHeader, PanelLink } from "./panel";
import { StatusBadge } from "./status-badge";

export function LowStockTable({
  lowStock,
  inventory,
}: {
  lowStock: { items: DashboardLowStockItem[]; total: number };
  inventory: DashboardInventory;
}) {
  const titleId = useId();
  const threshold = lowStock.items[0]?.threshold ?? LOW_STOCK_THRESHOLD;

  return (
    <Panel aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title="Low stock"
        description={
          inventory.activeProducts === 0
            ? "No active products yet"
            : `${formatCount(lowStock.total)} ${
                lowStock.total === 1 ? "product" : "products"
              } at or below ${threshold} units`
        }
        action={<PanelLink href="/stock">View inventory</PanelLink>}
      />

      {inventory.activeProducts === 0 ? (
        <PanelEmpty
          title="No products in inventory"
          description="Add products to start tracking stock levels."
        />
      ) : lowStock.items.length === 0 ? (
        <PanelEmpty
          title="All products are above the reorder point"
          description={`No product is at or below ${threshold} units.`}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-border/70 text-xs font-normal text-muted">
                  <th
                    scope="col"
                    className="w-[68%] px-4 py-2 text-left font-normal sm:px-5 md:w-[45%] lg:w-[35%]"
                  >
                    Product
                  </th>
                  <th
                    scope="col"
                    className="hidden w-[25%] px-3 py-2 text-left font-normal md:table-cell"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="hidden w-[17%] px-3 py-2 text-right font-normal lg:table-cell"
                  >
                    Unit price
                  </th>
                  <th
                    scope="col"
                    className="w-[32%] px-4 py-2 text-right font-normal sm:px-5 md:w-[30%] lg:w-[28%]"
                  >
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {lowStock.items.map((item) => {
                  const state = stockState(item.quantity, item.threshold);
                  return (
                    <tr key={item.id} className="align-middle">
                      <td className="min-w-0 px-4 py-3 sm:px-5">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                          {item.barcode}
                        </p>
                      </td>
                      <td className="hidden truncate px-3 py-3 text-xs text-muted md:table-cell">
                        {item.category ?? "Uncategorized"}
                      </td>
                      <td className="hidden px-3 py-3 text-right text-xs tabular-nums text-muted lg:table-cell">
                        {formatMoney(item.price)}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5">
                        <StatusBadge
                          label={
                            state === "out"
                              ? `${formatCount(item.quantity)} · Out of stock`
                              : `${formatCount(item.quantity)} · Low`
                          }
                          tone={state === "out" ? "danger" : "warning"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lowStock.total > lowStock.items.length ? (
            <p className="border-t border-border/70 px-4 py-2.5 text-[11px] text-muted sm:px-5">
              Showing {formatCount(lowStock.items.length)} of{" "}
              {formatCount(lowStock.total)} low-stock products.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
