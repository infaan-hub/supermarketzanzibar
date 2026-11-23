"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { portalHref } from "@/lib/auth/roles";
import { INVENTORY_STATE_STYLES } from "@/lib/digital-twin/inventory-state";
import {
  computeColumnRowPlan,
  isColumnFull,
} from "@/lib/digital-twin/product-layout";
import { formatDate, formatMoney } from "@/lib/format";
import type { TwinShelfPositionNode } from "@/types/digital-twin";

export function ProductInspection({
  position,
  canRestock,
  onRestock,
  onAddSameProductColumn,
  restocking,
}: {
  position: TwinShelfPositionNode;
  canRestock: boolean;
  onRestock: (
    positionId: string,
    quantity: number,
    allowAddColumn?: boolean,
  ) => Promise<void>;
  onAddSameProductColumn?: (shelfId: string, sourcePositionId: string) => Promise<void>;
  restocking: boolean;
}) {
  const { user } = useAuth();
  const href = (path: string) => portalHref(user?.role, path);
  const [qty, setQty] = React.useState("6");
  const product = position.product;
  const style = INVENTORY_STATE_STYLES[position.visualState];
  const rowPlan = computeColumnRowPlan(
    position.quantity,
    position.maximumCapacity,
    4,
  );
  const colFull = Boolean(
    product && isColumnFull(position.quantity, position.maximumCapacity),
  );

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

      {/* 4-Row Vertical Column Planogram (1 Product per Column, Never Mixed) */}
      <div className="space-y-1.5 rounded-md border border-border bg-white p-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-foreground">
            Column {position.positionCode} · 4 Planned Rows
          </span>
          <span className="font-mono text-muted">
            {colFull
              ? "4/4 FULL"
              : `${rowPlan.filter((r) => r.isFull).length}/4 full`}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {rowPlan.map((row) => (
            <div
              key={row.rowIndex}
              className={`rounded border px-1.5 py-1 text-center font-mono text-[10px] ${
                row.isFull
                  ? "border-amber-300 bg-amber-50 font-semibold text-amber-900"
                  : row.quantity > 0
                    ? "border-teal-200 bg-teal-50 font-semibold text-teal-900"
                    : "border-dashed border-border bg-surface-subtle text-muted"
              }`}
            >
              R{row.rowIndex + 1}: {row.quantity}/{row.capacity}
            </div>
          ))}
        </div>
        {canRestock && onAddSameProductColumn && (
          <Button
            type="button"
            size="sm"
            variant={colFull ? "default" : "secondary"}
            className="mt-1.5 h-7 w-full text-xs"
            isLoading={restocking}
            onClick={() =>
              void onAddSameProductColumn(position.shelfId, position.id)
            }
          >
            {colFull
              ? "+ Column full — Add same-product column"
              : "+ Add another column for this product"}
          </Button>
        )}
      </div>

      {canRestock && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = Number(qty);
            if (Number.isInteger(parsed) && parsed > 0) {
              const needsOverflow =
                parsed > Math.max(0, position.maximumCapacity - position.quantity);
              void onRestock(position.id, parsed, needsOverflow);
            }
          }}
          className="space-y-2 rounded-md border border-border bg-surface-subtle p-3"
        >
          <p className="text-xs font-medium text-foreground">
            {colFull
              ? "Restock into new same-product overflow column"
              : "Restock column from warehouse"}
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={Math.max(1, position.warehouseQuantity || 24)}
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
              {colFull ? "Add col & move" : "Transfer"}
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
