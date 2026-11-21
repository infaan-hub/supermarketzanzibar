"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INVENTORY_STATE_STYLES } from "@/lib/digital-twin/inventory-state";
import { formatDate, formatMoney } from "@/lib/format";
import type { TwinShelfPositionNode } from "@/types/digital-twin";

export function ProductInspection({
  position,
  canRestock,
  onRestock,
  restocking,
}: {
  position: TwinShelfPositionNode;
  canRestock: boolean;
  onRestock: (positionId: string, quantity: number) => Promise<void>;
  restocking: boolean;
}) {
  const [qty, setQty] = React.useState("6");
  const product = position.product;
  const style = INVENTORY_STATE_STYLES[position.visualState];

  if (!product) {
    return (
      <div className="space-y-3 text-sm">
        <Badge variant="secondary">Empty Shelf Position</Badge>
        <p className="font-mono text-xs text-muted">{position.objectName}</p>
        <p className="text-muted">
          No product is assigned to slot <strong>{position.positionCode}</strong>{" "}
          on shelf <strong>{position.shelfCode}</strong>. Assign one from{" "}
          <Link href="/shelves" className="text-primary hover:underline">
            Shelves &amp; Locations
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={style.badgeTone}>{style.label}</Badge>
          <span className="font-mono text-[11px] text-muted">
            {position.objectName}
          </span>
        </div>
        <h3 className="font-display text-lg font-bold text-foreground">
          {product.name}
        </h3>
        <p className="text-xs text-muted">
          {product.categoryName ?? "Uncategorized"} · SKU {product.sku} ·
          Barcode <span className="font-mono">{product.barcode}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-sm">
        <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
          <p className="text-[11px] text-muted">Selling Price</p>
          <p className="font-display text-base font-bold tabular-nums">
            {formatMoney(product.price)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
          <p className="text-[11px] text-muted">Shelf Stock</p>
          <p className="font-display text-base font-bold tabular-nums">
            {position.quantity} / {position.maximumCapacity}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
          <p className="text-[11px] text-muted">Warehouse Stock</p>
          <p className="font-display text-base font-bold tabular-nums">
            {position.warehouseQuantity}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
          <p className="text-[11px] text-muted">Reorder Level</p>
          <p className="font-display text-base font-bold tabular-nums">
            {position.reorderLevel}
          </p>
        </div>
      </div>

      {position.nearestExpiryDate && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Nearest batch expiry:{" "}
          <strong>{formatDate(position.nearestExpiryDate)}</strong>
        </div>
      )}

      {canRestock && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = Number(qty);
            if (Number.isInteger(parsed) && parsed > 0) {
              void onRestock(position.id, parsed);
            }
          }}
          className="space-y-2 rounded-lg border border-teal-200/80 bg-teal-50/50 p-3"
        >
          <p className="text-xs font-semibold text-teal-900">
            Restock Shelf from Warehouse
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={Math.max(1, position.maximumCapacity - position.quantity)}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-9"
              aria-label="Restock units"
            />
            <Button
              type="submit"
              size="sm"
              isLoading={restocking}
              disabled={position.warehouseQuantity <= 0}
            >
              Transfer
            </Button>
          </div>
          {position.warehouseQuantity <= 0 && (
            <p className="text-[11px] text-muted">
              No warehouse reserve available — receive stock in Goods Received
              first.
            </p>
          )}
        </form>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Link
          href={`/products/${product.id}`}
          className="inline-flex h-9 items-center justify-center rounded border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent/5"
        >
          Edit Product
        </Link>
        <Link
          href={`/stock/movements?productId=${product.id}`}
          className="inline-flex h-9 items-center justify-center rounded border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent/5"
        >
          Stock History
        </Link>
        <Link
          href="/pos"
          className="inline-flex h-9 items-center justify-center rounded bg-primary-hover px-3 text-xs font-medium text-white hover:bg-[#0f5c23]"
        >
          Sell in POS
        </Link>
        <Link
          href="/sales"
          className="inline-flex h-9 items-center justify-center rounded border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent/5"
        >
          View Sales
        </Link>
      </div>
    </div>
  );
}
