"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { findAreaByCode } from "@/lib/digital-twin/spatial-plan";
import { INVENTORY_STATE_STYLES } from "@/lib/digital-twin/inventory-state";
import { ProductInspection } from "@/components/digital-twin/products/ProductInspection";
import { useAuth } from "@/components/auth/auth-provider";
import { portalHref } from "@/lib/auth/roles";
import type {
  DigitalTwinSnapshot,
  TwinSelection,
  TwinShelfNode,
  TwinShelfPositionNode,
} from "@/types/digital-twin";

export function ObjectInformationPanel({
  snapshot,
  selection,
  canRestock,
  onSelectShelf,
  onSelectProduct,
  onRestockShelfPosition,
  onTransferFromWarehouse,
  onClose,
}: {
  snapshot: DigitalTwinSnapshot;
  selection: TwinSelection;
  canRestock: boolean;
  onSelectShelf: (shelf: TwinShelfNode) => void;
  onSelectProduct: (pos: TwinShelfPositionNode) => void;
  onRestockShelfPosition: (positionId: string, quantity: number) => Promise<void>;
  onTransferFromWarehouse: (
    warehouseLocationId: string,
    targetShelfPositionId: string,
    quantity: number,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const href = (path: string) => portalHref(user?.role, path);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [transferQty, setTransferQty] = React.useState("10");
  const [targetShelfPosId, setTargetShelfPosId] = React.useState("");

  React.useEffect(() => {
    setActionError(null);
  }, [selection]);

  const handleRestock = async (positionId: string, quantity: number) => {
    setBusy(true);
    setActionError(null);
    try {
      await onRestockShelfPosition(positionId, quantity);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Restock transfer failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!selection) {
    return (
      <div className="space-y-4 p-4 text-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            Inspector
          </p>
          <h2 className="font-display text-lg font-bold text-foreground">
            {snapshot.store?.name ?? "Supermarket Zanzibar"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Click any department sign, shelf, product, or warehouse pallet slot
            in the 3D viewport to inspect live PostgreSQL inventory and execute
            real operations.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-border bg-surface-subtle p-3">
            <p className="text-[11px] text-muted">Tracked SKUs</p>
            <p className="font-display text-xl font-bold tabular-nums">
              {snapshot.summary.totalProducts}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-subtle p-3">
            <p className="text-[11px] text-muted">Active Shelves</p>
            <p className="font-display text-xl font-bold tabular-nums">
              {snapshot.shelves.length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-subtle p-3">
            <p className="text-[11px] text-muted">Shelf Units</p>
            <p className="font-display text-xl font-bold tabular-nums text-teal-800">
              {snapshot.summary.totalShelfUnits}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-subtle p-3">
            <p className="text-[11px] text-muted">Warehouse Units</p>
            <p className="font-display text-xl font-bold tabular-nums text-amber-800">
              {snapshot.summary.totalWarehouseUnits}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-foreground">Quick Links</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={href("/pos")}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-gradient-to-b from-teal-600 to-teal-700 px-3 font-display text-xs font-semibold text-white shadow-sm hover:from-teal-500 hover:to-teal-700"
            >
              Open POS
            </Link>
            <Link
              href={href("/warehouse")}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-white px-3 font-display text-xs font-semibold text-foreground shadow-sm hover:border-teal-400 hover:bg-surface-subtle"
            >
              Warehouse Ops
            </Link>
            <Link
              href={href("/shelves")}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-white px-3 font-display text-xs font-semibold text-foreground shadow-sm hover:border-teal-400 hover:bg-surface-subtle"
            >
              Shelves Setup
            </Link>
            <Link
              href={href("/purchase-orders")}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-white px-3 font-display text-xs font-semibold text-foreground shadow-sm hover:border-teal-400 hover:bg-surface-subtle"
            >
              Purchase Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          {selection.type === "department"
            ? "Department"
            : selection.type === "shelf"
              ? "Shelf Inspection"
              : selection.type === "product"
                ? "Product Inspection"
                : "Warehouse Location"}
        </span>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-7 px-2">
          Close
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {actionError && (
          <div className="rounded-md border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
            {actionError}
          </div>
        )}

        {/* DEPARTMENT INSPECTOR */}
        {selection.type === "department" && (() => {
          const area = findAreaByCode(selection.departmentCode);
          const dept = snapshot.departments.find(
            (d) => d.code.toUpperCase() === selection.departmentCode.toUpperCase(),
          );
          const deptShelves = snapshot.shelves.filter(
            (s) =>
              s.departmentCode.toUpperCase() ===
              selection.departmentCode.toUpperCase(),
          );

          return (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold">
                  {dept?.name ?? area?.name ?? selection.departmentCode}
                </h3>
                <p className="text-xs text-muted">
                  {dept?.description ?? area?.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Shelves</p>
                  <p className="font-display text-base font-bold">
                    {deptShelves.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Total Units</p>
                  <p className="font-display text-base font-bold">
                    {dept?.totalUnits ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Low Stock</p>
                  <p className="font-display text-base font-bold text-warning">
                    {dept?.lowStockCount ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Out of Stock</p>
                  <p className="font-display text-base font-bold text-danger">
                    {dept?.outOfStockCount ?? 0}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">
                  Department Shelves
                </p>
                {deptShelves.length === 0 ? (
                  <p className="text-xs text-muted">
                    No shelves configured in this area.
                  </p>
                ) : (
                  deptShelves.map((shelf) => (
                    <button
                      key={shelf.id}
                      type="button"
                      onClick={() => onSelectShelf(shelf)}
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-left text-xs hover:bg-surface-subtle"
                    >
                      <div>
                        <p className="font-mono font-bold text-teal-800">
                          {shelf.code}
                        </p>
                        <p className="text-[11px] text-muted">{shelf.name}</p>
                      </div>
                      <Badge variant="secondary">{shelf.totalUnits} u</Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* SHELF INSPECTOR */}
        {selection.type === "shelf" && (() => {
          const shelf = snapshot.shelves.find((s) => s.id === selection.shelfId);
          if (!shelf) {
            return <p className="text-xs text-muted">Shelf record not found.</p>;
          }
          const style = INVENTORY_STATE_STYLES[shelf.visualState];
          return (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={style.badgeTone}>{style.label}</Badge>
                  <span className="font-mono text-xs text-muted">
                    {shelf.code}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold">{shelf.name}</h3>
                <p className="text-xs text-muted">
                  Department: {shelf.departmentName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Total Units / Cap</p>
                  <p className="font-display text-base font-bold tabular-nums">
                    {shelf.totalUnits} / {shelf.capacity}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Products Placed</p>
                  <p className="font-display text-base font-bold tabular-nums">
                    {shelf.productCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Low Stock Slots</p>
                  <p className="font-display text-base font-bold text-warning tabular-nums">
                    {shelf.lowStockCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Empty Positions</p>
                  <p className="font-display text-base font-bold tabular-nums">
                    {shelf.emptyPositions}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs">
                Restocking Status:{" "}
                <strong
                  className={
                    shelf.restockNeeded ? "text-warning" : "text-success"
                  }
                >
                  {shelf.restockNeeded
                    ? "Replenishment Recommended"
                    : "Stocked"}
                </strong>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold">
                  Shelf Positions ({shelf.positions.length})
                </p>
                {shelf.positions.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => onSelectProduct(pos)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 text-left text-xs hover:bg-surface-subtle"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {pos.product?.name ?? "Empty Slot"}
                      </p>
                      <p className="font-mono text-[10px] text-muted">
                        {pos.positionCode} · WH: {pos.warehouseQuantity}
                      </p>
                    </div>
                    <Badge
                      variant={
                        INVENTORY_STATE_STYLES[pos.visualState].badgeTone
                      }
                      className="text-[10px]"
                    >
                      {pos.quantity}/{pos.maximumCapacity}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* PRODUCT INSPECTOR */}
        {selection.type === "product" && (() => {
          const allPositions = snapshot.shelves.flatMap((s) => s.positions);
          const pos = allPositions.find((p) => p.id === selection.positionId);
          if (!pos) {
            return (
              <p className="text-xs text-muted">
                Selected shelf position is no longer available.
              </p>
            );
          }
          return (
            <ProductInspection
              position={pos}
              canRestock={canRestock}
              onRestock={handleRestock}
              restocking={busy}
            />
          );
        })()}

        {/* WAREHOUSE POSITION INSPECTOR */}
        {selection.type === "warehouse_position" && (() => {
          const allWh = snapshot.warehouseRacks.flatMap((r) => r.positions);
          const loc = allWh.find((p) => p.id === selection.locationId);
          if (!loc) {
            return (
              <p className="text-xs text-muted">
                Warehouse location not found.
              </p>
            );
          }

          const matchingShelfSlots = loc.product
            ? snapshot.shelves
                .flatMap((s) => s.positions)
                .filter((p) => p.product?.id === loc.product?.id)
            : [];

          const chosenTarget =
            targetShelfPosId || matchingShelfSlots[0]?.id || "";

          return (
            <div className="space-y-4">
              <div className="space-y-1">
                <Badge variant="secondary">
                  {loc.zoneCode} · {loc.locationType}
                </Badge>
                <h3 className="font-display text-lg font-bold">
                  {loc.rackCode} / {loc.levelCode} / {loc.positionCode}
                </h3>
                <p className="font-mono text-[11px] text-muted">
                  {loc.objectName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Quantity Stored</p>
                  <p className="font-display text-base font-bold tabular-nums">
                    {loc.quantityOnHand} / {loc.capacity}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-2.5">
                  <p className="text-[11px] text-muted">Available Space</p>
                  <p className="font-display text-base font-bold tabular-nums">
                    {Math.max(0, loc.capacity - loc.quantityOnHand)}
                  </p>
                </div>
              </div>

              {loc.product ? (
                <div className="rounded-lg border border-border bg-white p-3 text-xs space-y-1">
                  <p className="text-muted">Stored Product</p>
                  <Link
                    href={`/products/${loc.product.id}`}
                    className="block text-sm font-semibold text-primary hover:underline"
                  >
                    {loc.product.name}
                  </Link>
                  <p className="font-mono text-muted">{loc.product.barcode}</p>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  This pallet slot is empty and ready for goods receiving.
                </p>
              )}

              {canRestock && loc.product && loc.quantityOnHand > 0 && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!chosenTarget) return;
                    const q = Number(transferQty);
                    if (!Number.isInteger(q) || q <= 0) return;
                    setBusy(true);
                    setActionError(null);
                    try {
                      await onTransferFromWarehouse(loc.id, chosenTarget, q);
                    } catch (err) {
                      setActionError(
                        err instanceof Error
                          ? err.message
                          : "Transfer failed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="space-y-2.5 rounded-lg border border-teal-200 bg-teal-50/60 p-3"
                >
                  <p className="text-xs font-semibold text-teal-900">
                    Transfer to Retail Shelf
                  </p>
                  {matchingShelfSlots.length === 0 ? (
                    <p className="text-[11px] text-muted">
                      Assign this product to a shelf position on{" "}
                      <Link href="/shelves" className="text-primary underline">
                        Shelves &amp; Locations
                      </Link>{" "}
                      before transferring.
                    </p>
                  ) : (
                    <>
                      <Select
                        value={chosenTarget}
                        onChange={(e) => setTargetShelfPosId(e.target.value)}
                      >
                        {matchingShelfSlots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {slot.shelfCode} · {slot.positionCode} (
                            {slot.quantity}/{slot.maximumCapacity})
                          </option>
                        ))}
                      </Select>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={loc.quantityOnHand}
                          value={transferQty}
                          onChange={(e) => setTransferQty(e.target.value)}
                          className="h-9"
                        />
                        <Button type="submit" size="sm" isLoading={busy}>
                          Move
                        </Button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
