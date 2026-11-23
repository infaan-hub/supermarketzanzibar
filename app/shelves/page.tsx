"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { isInventoryRole, isManagerRole, portalHref } from "@/lib/auth/roles";
import {
  addShelfColumn,
  createShelf,
  fetchDepartments,
  fetchProducts,
  fetchShelves,
  transferWarehouseStockToShelf,
  updateShelfPosition,
} from "@/lib/api";
import {
  computeColumnRowPlan,
  isColumnFull,
} from "@/lib/digital-twin/product-layout";
import type { DepartmentSummary, Product, ShelfRecord } from "@/types/api";

function ShelvesPageInner() {
  const params = useSearchParams();
  const initialDept = params.get("dept") ?? "";

  const { user } = useAuth();
  const canEdit = isInventoryRole(user?.role);
  const canCreate = isManagerRole(user?.role);
  const href = (path: string) => portalHref(user?.role, path);

  const [departments, setDepartments] = React.useState<DepartmentSummary[]>([]);
  const [shelves, setShelves] = React.useState<ShelfRecord[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [deptFilter, setDeptFilter] = React.useState(initialDept);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  // Create Shelf Form
  const [newDeptId, setNewDeptId] = React.useState("");
  const [newCode, setNewCode] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newKind, setNewKind] = React.useState("gondola");
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, shelfRes, prodRes] = await Promise.all([
        fetchDepartments(),
        fetchShelves(deptFilter || undefined),
        fetchProducts({ take: 200 }),
      ]);
      setDepartments(deptRes.departments);
      setShelves(shelfRes.shelves);
      setProducts(prodRes.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shelves.");
    } finally {
      setLoading(false);
    }
  }, [deptFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreateShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setFeedback(null);
    try {
      await createShelf({
        departmentId: newDeptId,
        shelfCode: newCode.toUpperCase(),
        shelfName: newName,
        fixtureKind: newKind,
      });
      setNewCode("");
      setNewName("");
      setFeedback("Shelf created with 6 vertical 4-row product columns.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create shelf.");
    } finally {
      setCreating(false);
    }
  };

  const handleAssignProduct = async (positionId: string, productId: string) => {
    setBusyId(positionId);
    setError(null);
    setFeedback(null);
    try {
      await updateShelfPosition(positionId, {
        productId: productId || null,
      });
      setFeedback(
        "4-row product column updated (1 product per column) and synced to 3D.",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update shelf column.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateUnitsPerRow = async (
    positionId: string,
    unitsPerRow: number,
  ) => {
    setBusyId(positionId);
    setError(null);
    setFeedback(null);
    try {
      const nextCap = Math.max(4, unitsPerRow * 4);
      await updateShelfPosition(positionId, {
        maximumCapacity: nextCap,
      });
      setFeedback(
        `Updated row plan to ${unitsPerRow} units/row × 4 rows (${nextCap} total column capacity).`,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update row plan.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleAddColumn = async (
    shelfId: string,
    opts?: { sourcePositionId?: string; productName?: string },
  ) => {
    const key = opts?.sourcePositionId
      ? `add-same-${opts.sourcePositionId}`
      : `add-col-${shelfId}`;
    setBusyId(key);
    setError(null);
    setFeedback(null);
    try {
      const res = await addShelfColumn(shelfId, {
        sourcePositionId: opts?.sourcePositionId,
      });
      setFeedback(
        opts?.productName
          ? `Added new 4-row column ${res.column.positionCode} for "${opts.productName}" (same product, zero mixing).`
          : `Added new empty 4-row column ${res.column.positionCode} to ${res.column.shelfCode}.`,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add shelf column.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickRestock = async (
    positionId: string,
    allowAddColumn = false,
  ) => {
    setBusyId(positionId);
    setError(null);
    setFeedback(null);
    try {
      const res = await transferWarehouseStockToShelf({
        shelfPositionId: positionId,
        quantity: 6,
        allowAddColumn,
      });
      const overflowNote =
        res.addedColumnCodes && res.addedColumnCodes.length > 0
          ? ` (added overflow column ${res.addedColumnCodes.join(", ")} for same product)`
          : "";
      setFeedback(
        `Restocked +6 ${res.productName} onto ${res.shelfCode}/${res.positionCode}${overflowNote}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restock transfer failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeader
        title="Shelves & 4-Row Product Columns"
        description="Each vertical column holds 4 rows for ONE product with its product name displayed on top. When all 4 rows in a column are full, add another column for the same product instead of mixing products."
        actions={
          <>
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-9 w-48 text-xs"
              aria-label="Filter shelves by department"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </Select>
            <Link href={href("/digital-twin")}>
              <Button size="sm">Open 3D Twin</Button>
            </Link>
          </>
        }
      />

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
          {feedback}
        </div>
      )}

      {canCreate && departments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Shelf Fixture</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateShelf}
              className="grid gap-3 sm:grid-cols-5"
            >
              <Select
                value={newDeptId}
                onChange={(e) => setNewDeptId(e.target.value)}
                required
              >
                <option value="">Department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="Shelf Code (SH-GRO-05)"
                required
              />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Fixture display name"
                required
              />
              <Select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
              >
                <option value="gondola">Standard Gondola</option>
                <option value="double_gondola">Double Gondola</option>
                <option value="beverage_rack">Beverage Rack</option>
                <option value="refrigerator">Refrigerated Case</option>
                <option value="freezer">Freezer Unit</option>
                <option value="bakery_case">Bakery Display</option>
                <option value="cosmetics_display">Cosmetics Display</option>
              </Select>
              <Button type="submit" isLoading={creating}>
                Add Shelf
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading shelves and 4-row columns…</p>
      ) : shelves.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted">
            No shelves found. Open{" "}
            <Link
              href={href("/digital-twin")}
              className="font-semibold text-teal-700 underline"
            >
              3D Digital Twin
            </Link>{" "}
            and initialize the store layout.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {shelves.map((shelf) => (
            <Card key={shelf.id}>
              <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-2 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-800">
                      {shelf.shelfCode}
                    </span>
                    <Badge variant="secondary">{shelf.department.name}</Badge>
                    <Badge variant="secondary">
                      {shelf.positions.length} columns × 4 rows
                    </Badge>
                  </div>
                  <CardTitle className="mt-1 text-base">
                    {shelf.shelfName}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">
                    {shelf.totalUnits}/{shelf.capacity} units
                  </span>
                  {canEdit && shelf.positions.length < 12 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === `add-col-${shelf.id}`}
                      onClick={() => void handleAddColumn(shelf.id)}
                    >
                      + Add Column
                    </Button>
                  )}
                  <Link
                    href={`${href("/digital-twin")}?shelf=${encodeURIComponent(shelf.shelfCode)}`}
                  >
                    <Button size="sm" variant="secondary">
                      Focus 3D
                    </Button>
                  </Link>
                </div>
              </CardHeader>

              <CardContent>
                {/* Vertical 4-row product column planogram grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shelf.positions.map((pos) => {
                    const rowPlan = computeColumnRowPlan(
                      pos.quantity,
                      pos.maximumCapacity,
                      4,
                    );
                    const unitsPerRow = Math.max(
                      1,
                      Math.round(pos.maximumCapacity / 4),
                    );
                    const full = Boolean(
                      pos.product &&
                        isColumnFull(pos.quantity, pos.maximumCapacity),
                    );
                    const isLockedStock = Boolean(
                      pos.product && pos.quantity > 0,
                    );

                    return (
                      <div
                        key={pos.id}
                        className="flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-white shadow-xs"
                      >
                        {/* TOP-OF-COLUMN PRODUCT NAME HEADER */}
                        <div
                          className={`border-b px-3 py-2 ${
                            full
                              ? "border-amber-300 bg-amber-50"
                              : pos.product
                                ? "border-teal-200 bg-teal-50/70"
                                : "border-border bg-surface-subtle"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-teal-900">
                              {pos.positionCode} · 4 ROWS ({unitsPerRow}/ROW)
                            </span>
                            <Badge
                              variant={
                                !pos.product
                                  ? "secondary"
                                  : full
                                    ? "warning"
                                    : pos.quantity <= 0
                                      ? "danger"
                                      : pos.quantity <= pos.reorderLevel
                                        ? "warning"
                                        : "success"
                              }
                            >
                              {full
                                ? `4/4 FULL (${pos.quantity}/${pos.maximumCapacity})`
                                : `${pos.quantity}/${pos.maximumCapacity}`}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs font-bold text-foreground">
                            {pos.product?.name ?? "Empty Column (1 Product Max)"}
                          </p>
                        </div>

                        {/* 4 PLANNED VERTICAL ROWS (Row 4 Top -> Row 1 Bottom) */}
                        <div className="space-y-1.5 p-3">
                          {[3, 2, 1, 0].map((rowIdx) => {
                            const row = rowPlan[rowIdx];
                            return (
                              <div
                                key={rowIdx}
                                className={`space-y-1 rounded border px-2 py-1.5 text-[11px] ${
                                  row.isFull
                                    ? "border-amber-200 bg-amber-50/50 text-foreground"
                                    : row.quantity > 0
                                      ? "border-teal-200 bg-teal-50/40 text-foreground"
                                      : "border-dashed border-border bg-surface-subtle/50 text-muted"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[10px] font-semibold">
                                    {row.rowLabel}
                                  </span>
                                  <span className="truncate text-[11px]">
                                    {pos.product
                                      ? row.quantity > 0
                                        ? pos.product.name
                                        : "Planned empty row"
                                      : "Unassigned"}
                                  </span>
                                  <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums">
                                    {row.quantity}/{row.capacity}
                                    {row.isFull ? " FULL" : ""}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                                  <div
                                    className={`h-full transition-all ${
                                      row.isFull
                                        ? "bg-amber-500"
                                        : row.quantity > 0
                                          ? "bg-teal-600"
                                          : "bg-transparent"
                                    }`}
                                    style={{ width: `${row.fillPercent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* COLUMN CONTROLS: Assign 1 Product, Plan Units/Row, Add Same-Product Column */}
                        <div className="space-y-2 border-t border-border bg-surface-subtle/60 p-2.5">
                          {canEdit && (
                            <div className="space-y-1.5">
                              <Select
                                value={pos.product?.id ?? ""}
                                disabled={busyId === pos.id || isLockedStock}
                                onChange={(e) =>
                                  void handleAssignProduct(pos.id, e.target.value)
                                }
                                className="h-7 w-full text-xs"
                                title={
                                  isLockedStock
                                    ? "Column holds active stock — never mix different products in the same 4-row column"
                                    : "Assign 1 product to this 4-row column"
                                }
                                aria-label={`Assign single product to ${shelf.shelfCode} ${pos.positionCode}`}
                              >
                                <option value="">— Empty 4-row column —</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.quantity})
                                  </option>
                                ))}
                              </Select>

                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-medium text-muted">
                                  Plan per row:
                                </span>
                                <Select
                                  value={String(unitsPerRow)}
                                  disabled={busyId === pos.id}
                                  onChange={(e) =>
                                    void handleUpdateUnitsPerRow(
                                      pos.id,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="h-6 w-36 text-[11px]"
                                  aria-label={`Planned units per row for ${shelf.shelfCode} ${pos.positionCode}`}
                                >
                                  {[4, 6, 8, 10, 12, 16].map((n) => (
                                    <option key={n} value={String(n)}>
                                      {n}/row ({n * 4} col cap)
                                    </option>
                                  ))}
                                </Select>
                              </div>

                              {isLockedStock && (
                                <p className="text-[10px] text-muted">
                                  Single-product column locked while stocked (no mixing).
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5">
                            {canEdit && pos.product && !full && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 flex-1 px-2 text-[11px]"
                                isLoading={busyId === pos.id}
                                onClick={() =>
                                  void handleQuickRestock(pos.id, false)
                                }
                              >
                                +6 Restock
                              </Button>
                            )}

                            {canEdit &&
                              pos.product &&
                              shelf.positions.length < 12 && (
                                <Button
                                  size="sm"
                                  variant={full ? "default" : "secondary"}
                                  className="h-7 flex-1 px-2 text-[11px]"
                                  isLoading={
                                    busyId === `add-same-${pos.id}`
                                  }
                                  onClick={() =>
                                    void handleAddColumn(shelf.id, {
                                      sourcePositionId: pos.id,
                                      productName: pos.product!.name,
                                    })
                                  }
                                  title="Add another 4-row column on this shelf for the exact same product"
                                >
                                  {full
                                    ? "+ Add Same-Product Column"
                                    : "+ Overflow Col"}
                                </Button>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShelvesPage() {
  return (
    <React.Suspense
      fallback={<p className="text-sm text-muted">Loading shelves…</p>}
    >
      <ShelvesPageInner />
    </React.Suspense>
  );
}
