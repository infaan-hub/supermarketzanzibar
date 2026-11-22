"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DigitalTwinWorkspace } from "@/components/digital-twin/DigitalTwinWorkspace";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { isInventoryRole, portalHref } from "@/lib/auth/roles";
import {
  fetchProducts,
  fetchShelves,
  fetchWarehouse,
  receiveDirectWarehouseStock,
  transferWarehouseStockToShelf,
} from "@/lib/api";
import type {
  Product,
  ShelfRecord,
  WarehouseOverviewResponse,
} from "@/types/api";

export default function WarehousePage() {
  const { user } = useAuth();
  const canEdit = isInventoryRole(user?.role);
  const href = (path: string) => portalHref(user?.role, path);

  const [warehouse, setWarehouse] =
    React.useState<WarehouseOverviewResponse | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [shelves, setShelves] = React.useState<ShelfRecord[]>([]);
  const [zoneFilter, setZoneFilter] = React.useState("ALL");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  // Direct Warehouse Intake Form
  const [intakeProductId, setIntakeProductId] = React.useState("");
  const [intakeLocationId, setIntakeLocationId] = React.useState("");
  const [intakeQty, setIntakeQty] = React.useState("24");
  const [intakeBatch, setIntakeBatch] = React.useState("");
  const [intakeExpiry, setIntakeExpiry] = React.useState("");
  const [submittingIntake, setSubmittingIntake] = React.useState(false);

  // Quick Transfer to Retail Shelf Form
  const [transferSourceId, setTransferSourceId] = React.useState("");
  const [transferTargetPosId, setTransferTargetPosId] = React.useState("");
  const [transferQty, setTransferQty] = React.useState("10");
  const [submittingTransfer, setSubmittingTransfer] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [whRes, prodRes, shelfRes] = await Promise.all([
        fetchWarehouse(),
        fetchProducts({ take: 200 }),
        fetchShelves(),
      ]);
      setWarehouse(whRes);
      setProducts(prodRes.products);
      setShelves(shelfRes.shelves);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load warehouse data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const allShelfPositions = React.useMemo(
    () =>
      shelves.flatMap((s) =>
        s.positions
          .filter((p) => p.product !== null)
          .map((p) => ({
            id: p.id,
            label: `${s.shelfCode}/${p.positionCode} — ${p.product!.name} (${p.quantity}/${p.maximumCapacity})`,
            productId: p.product!.id,
          })),
      ),
    [shelves],
  );

  const filteredLocations = React.useMemo(() => {
    const locs = warehouse?.locations ?? [];
    if (zoneFilter === "ALL") return locs;
    return locs.filter((l) => l.zoneCode === zoneFilter);
  }, [warehouse, zoneFilter]);

  const handleIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeProductId || !intakeLocationId) return;
    setSubmittingIntake(true);
    setError(null);
    setFeedback(null);
    try {
      await receiveDirectWarehouseStock({
        productId: intakeProductId,
        warehouseLocationId: intakeLocationId,
        quantity: Number(intakeQty),
        batchNumber: intakeBatch.trim() || undefined,
        expiryDate: intakeExpiry || undefined,
      });
      setFeedback("Warehouse stock recorded and synced to the 3D Digital Twin.");
      setIntakeBatch("");
      setIntakeExpiry("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to store stock in rack.",
      );
    } finally {
      setSubmittingIntake(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetPosId) return;
    setSubmittingTransfer(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await transferWarehouseStockToShelf({
        shelfPositionId: transferTargetPosId,
        warehouseLocationId: transferSourceId || undefined,
        quantity: Number(transferQty),
      });
      setFeedback(
        `Transferred +${transferQty} ${res.productName} to ${res.shelfCode}/${res.positionCode}.`,
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Warehouse-to-shelf transfer failed.",
      );
    } finally {
      setSubmittingTransfer(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeader
        eyebrow="3D Warehouse Digital Twin"
        title="Storage Warehouse & Racks"
        description="Inspect Zones A–D in 3D, receive bulk pallets into exact rack levels, and transfer reserve stock to retail shelves."
        actions={
          <>
            <Link href={href("/digital-twin?scope=warehouse")}>
              <Button variant="secondary" size="sm">
                Full-Screen 3D Warehouse
              </Button>
            </Link>
            <Link href={href("/goods-received")}>
              <Button size="sm">Record Goods Receipt</Button>
            </Link>
          </>
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}
      {feedback && (
        <div
          role="status"
          className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {feedback}
        </div>
      )}

      {/* Embedded Live 3D Warehouse Viewport */}
      <DigitalTwinWorkspace initialScope="warehouse" embedded />

      {/* Zone Capacity Summary Cards */}
      {warehouse && warehouse.zones.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {warehouse.zones.map((z) => {
            const pct =
              z.capacity > 0
                ? Math.min(100, Math.round((z.totalUnits / z.capacity) * 100))
                : 0;
            return (
              <Card key={z.zoneCode}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-teal-800">
                      {z.zoneCode}
                    </span>
                    <Badge variant="secondary">{z.racksCount} racks</Badge>
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold tabular-nums">
                    {z.totalUnits.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-muted">
                      / {z.capacity.toLocaleString()} units
                    </span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Operational Forms (Inventory Staff / Manager / Admin) */}
      {canEdit && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Receive Stock Into Warehouse Rack
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleIntake} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Product
                  </label>
                  <Select
                    value={intakeProductId}
                    onChange={(e) => setIntakeProductId(e.target.value)}
                    required
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.quantity})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Rack / Level / Position
                  </label>
                  <Select
                    value={intakeLocationId}
                    onChange={(e) => setIntakeLocationId(e.target.value)}
                    required
                  >
                    <option value="">Select warehouse position…</option>
                    {(warehouse?.locations ?? []).map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.zoneCode} · {loc.rackCode}/{loc.levelCode}/
                        {loc.positionCode} ({loc.totalUnits}/{loc.capacity})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Quantity (Units)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={500000}
                    value={intakeQty}
                    onChange={(e) => setIntakeQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Batch Number (Optional)
                  </label>
                  <Input
                    value={intakeBatch}
                    onChange={(e) => setIntakeBatch(e.target.value)}
                    placeholder="e.g. BATCH-2026-A1"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Expiry Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={intakeExpiry}
                    onChange={(e) => setIntakeExpiry(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={submittingIntake}
                  >
                    Store in Rack
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Transfer Warehouse Reserve → Retail Shelf
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTransfer} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Target Retail Shelf Slot
                  </label>
                  <Select
                    value={transferTargetPosId}
                    onChange={(e) => setTransferTargetPosId(e.target.value)}
                    required
                  >
                    <option value="">Select assigned shelf slot…</option>
                    {allShelfPositions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Source Rack Position (Optional — auto-picks highest reserve)
                  </label>
                  <Select
                    value={transferSourceId}
                    onChange={(e) => setTransferSourceId(e.target.value)}
                  >
                    <option value="">Auto-select matching warehouse reserve</option>
                    {(warehouse?.locations ?? [])
                      .filter((l) => l.totalUnits > 0)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.rackCode}/{loc.levelCode}/{loc.positionCode} —{" "}
                          {loc.items.map((i) => `${i.productName} (${i.quantityOnHand})`).join(", ")}
                        </option>
                      ))}
                  </Select>
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Units to Move
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      value={transferQty}
                      onChange={(e) => setTransferQty(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" isLoading={submittingTransfer}>
                    Transfer to Shelf
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warehouse Locations Ledger */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Warehouse Rack Locations ({filteredLocations.length})
          </CardTitle>
          <Select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="h-8 w-44 text-xs"
          >
            <option value="ALL">All Zones</option>
            <option value="Zone_A">Zone A (Ambient)</option>
            <option value="Zone_B">Zone B (Beverages)</option>
            <option value="Zone_C">Zone C (Chilled)</option>
            <option value="Zone_D">Zone D (Household)</option>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading warehouse racks…</p>
          ) : filteredLocations.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              No warehouse locations found yet. Open the{" "}
              <Link href="/digital-twin" className="font-semibold text-teal-700 underline">
                3D Digital Twin
              </Link>{" "}
              and click Initialize 3D Store to populate Zones A–D.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location Code</TableHead>
                  <TableHead>Zone / Type</TableHead>
                  <TableHead>Stored Products</TableHead>
                  <TableHead className="text-right">Units / Capacity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-mono text-xs font-semibold text-teal-900">
                      {loc.rackCode}/{loc.levelCode}/{loc.positionCode}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary">{loc.zoneCode}</Badge>
                        <span className="text-xs text-muted capitalize">
                          {loc.locationType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {loc.items.length === 0 ? (
                        <span className="text-xs text-muted">Empty slot</span>
                      ) : (
                        <div className="space-y-0.5">
                          {loc.items.map((item) => (
                            <div key={item.inventoryId} className="text-xs">
                              <span className="font-medium text-foreground">
                                {item.productName}
                              </span>{" "}
                              <span className="text-muted">
                                ({item.quantityOnHand} on hand)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {loc.totalUnits} / {loc.capacity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
