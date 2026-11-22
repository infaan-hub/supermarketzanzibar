"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { portalHref } from "@/lib/auth/roles";
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
  const { user } = useAuth();
  const href = (path: string) => portalHref(user?.role, path);
  const [qty, setQty] = React.useState("6");
  const product = position.product;
  const style = INVENTORY_STATE_STYLES[position.visualState];

  if (!product) {
    return (
      <div className="space-y-3 text-sm">
        <Badge variant="secondary">Empty shelf position</Badge>
        <p className="font-mono text-xs text-muted">{position.objectName}</p>
        <p className="text-xs text-muted">
          No product is assigned to slot <strong>{position.positionCode}</strong>{" "}
          on shelf <strong>{position.shelfCode}</strong>. Assign one from{" "}
          <Link href={href("/shelves")} className="text-primary hover:underline">
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
        <h3 className="text-base font-semibold text-foreground">
          {product.name}
        </h3>
        <p className="text-xs text-muted">
          {product.categoryName ?? "Uncategorized"} · SKU {product.sku} ·
          Barcode <span className="font-mono">{product.barcode}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
        <div className="bg-white p-2.5">
          <p className="text-[11px] text-muted">Selling price</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {formatMoney(product.price)}
          </p>
        </div>
        <div className="bg-white p-2.5">
          <p className="text-[11px] text-muted">Shelf stock</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {position.quantity} / {position.maximumCapacity}
          </p>
        </div>
        <div className="bg-white p-2.5">
          <p className="text-[11px] text-muted">Warehouse</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {position.warehouseQuantity}
          </p>
        </div>
        <div className="bg-white p-2.5">
          <p className="text-[11px] text-muted">Reorder level</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {position.reorderLevel}
          </p>
        </div>
      </div>

      {position.nearestExpiryDate && (
        <div className="rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-xs text-warning">
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
          className="space-y-2 rounded-md border border-border bg-surface-subtle p-3"
        >
          <p className="text-xs font-medium text-foreground">
            Restock shelf from warehouse
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={Math.max(1, position.maximumCapacity - position.quantity)}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-8"
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
          href={href(`/products/${product.id}`)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition-colors hover:border-border-hover hover:bg-surface-subtle"
        >
          Edit product
        </Link>
        <Link
          href={href(`/stock/movements?productId=${product.id}`)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition-colors hover:border-border-hover hover:bg-surface-subtle"
        >
          Stock history
        </Link>
        <Link
          href={href("/pos")}
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Sell in POS
        </Link>
        <Link
          href={href("/sales")}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition-colors hover:border-border-hover hover:bg-surface-subtle"
        >
          View sales
        </Link>
      </div>
    </div>
  );
}
