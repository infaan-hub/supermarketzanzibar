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
  createShelf,
  fetchDepartments,
  fetchProducts,
  fetchShelves,
  transferWarehouseStockToShelf,
  updateShelfPosition,
} from "@/lib/api";
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
      setFeedback("Shelf created with 6 addressable product positions.");
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
      setFeedback("Shelf position updated and synced to the 3D scene.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update shelf position.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickRestock = async (positionId: string) => {
    setBusyId(positionId);
    setError(null);
    setFeedback(null);
    try {
      const res = await transferWarehouseStockToShelf({
        shelfPositionId: positionId,
        quantity: 6,
      });
      setFeedback(
        `Restocked +6 ${res.productName} onto ${res.shelfCode}/${res.positionCode}.`,
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
        eyebrow="Planogram & Shelf-Slot Operations"
        title="Shelves & Product Positions"
        description="Assign products to physical shelf slots, manage capacities, and trigger live warehouse restocks reflected immediately in 3D."
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
        <p className="text-sm text-muted">Loading shelves and slots…</p>
      ) : shelves.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted">
            No shelves found. Open{" "}
            <Link href="/digital-twin" className="font-semibold text-teal-700 underline">
              3D Digital Twin
            </Link>{" "}
            and initialize the store layout.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shelves.map((shelf) => (
            <Card key={shelf.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-800">
                      {shelf.shelfCode}
                    </span>
                    <Badge variant="secondary">{shelf.department.name}</Badge>
                  </div>
                  <CardTitle className="mt-1 text-base">
                    {shelf.shelfName}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">
                    {shelf.totalUnits}/{shelf.capacity} units
                  </span>
                  <Link
                    href={`/digital-twin?shelf=${encodeURIComponent(shelf.shelfCode)}`}
                  >
                    <Button size="sm" variant="secondary">
                      Focus 3D
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {shelf.positions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle/60 px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="font-mono font-semibold text-teal-800">
                        {pos.positionCode}
                      </span>
                      {canEdit ? (
                        <Select
                          value={pos.product?.id ?? ""}
                          disabled={busyId === pos.id}
                          onChange={(e) =>
                            void handleAssignProduct(pos.id, e.target.value)
                          }
                          className="h-7 max-w-[230px] text-xs"
                          aria-label={`Assign product to ${shelf.shelfCode} ${pos.positionCode}`}
                        >
                          <option value="">— Empty slot —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.quantity})
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="truncate font-medium">
                          {pos.product?.name ?? "Empty slot"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          !pos.product
                            ? "secondary"
                            : pos.quantity <= 0
                              ? "danger"
                              : pos.quantity <= pos.reorderLevel
                                ? "warning"
                                : "success"
                        }
                      >
                        {pos.quantity}/{pos.maximumCapacity}
                      </Badge>
                      {canEdit &&
                        pos.product &&
                        pos.quantity < pos.maximumCapacity && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-[11px]"
                            isLoading={busyId === pos.id}
                            onClick={() => void handleQuickRestock(pos.id)}
                          >
                            +6 Restock
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
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
