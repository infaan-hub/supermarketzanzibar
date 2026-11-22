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
import { portalHref } from "@/lib/auth/roles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createGoodsReceipt,
  fetchGoodsReceipts,
  fetchProducts,
  fetchPurchaseOrders,
  fetchWarehouse,
} from "@/lib/api";
import type {
  GoodsReceiptRecord,
  Product,
  PurchaseOrderRecord,
  WarehouseLocationRecord,
} from "@/types/api";

interface ReceiveLine {
  productId: string;
  quantity: string;
  batchNumber: string;
  expiryDate: string;
}

function GoodsReceivedInner() {
  const params = useSearchParams();
  const initialPoId = params.get("po") ?? "";
  const { user } = useAuth();
  const href = (path: string) => portalHref(user?.role, path);

  const [receipts, setReceipts] = React.useState<GoodsReceiptRecord[]>([]);
  const [orders, setOrders] = React.useState<PurchaseOrderRecord[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [locations, setLocations] = React.useState<WarehouseLocationRecord[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const [selectedPoId, setSelectedPoId] = React.useState(initialPoId);
  const [warehouseLocationId, setWarehouseLocationId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<ReceiveLine[]>([
    { productId: "", quantity: "12", batchNumber: "", expiryDate: "" },
  ]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [grnRes, poRes, prodRes, whRes] = await Promise.all([
        fetchGoodsReceipts(),
        fetchPurchaseOrders(),
        fetchProducts({ take: 200 }),
        fetchWarehouse(),
      ]);
      setReceipts(grnRes.receipts);
      setOrders(
        poRes.purchaseOrders.filter(
          (po) => po.status !== "received" && po.status !== "cancelled",
        ),
      );
      setProducts(prodRes.products);
      setLocations(whRes.locations);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load goods receipts.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Auto-populate remaining PO quantities when a PO is selected.
  React.useEffect(() => {
    if (!selectedPoId) return;
    const po = orders.find((o) => o.id === selectedPoId);
    if (!po) return;
    const pendingLines = po.items
      .filter((i) => i.remainingQuantity > 0)
      .map((i) => ({
        productId: i.productId,
        quantity: String(i.remainingQuantity),
        batchNumber: "",
        expiryDate: "",
      }));
    if (pendingLines.length > 0) {
      setLines(pendingLines);
    }
  }, [selectedPoId, orders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        batchNumber: l.batchNumber.trim() || undefined,
        expiryDate: l.expiryDate || undefined,
      }));

    if (validItems.length === 0) {
      setError("Add at least one received product line.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const res = (await createGoodsReceipt({
        purchaseOrderId: selectedPoId || null,
        warehouseLocationId: warehouseLocationId || null,
        notes: notes.trim() || undefined,
        items: validItems,
      })) as { receipt?: { receiptNumber: string; totalUnits: number } };

      setSelectedPoId("");
      setNotes("");
      setLines([
        { productId: "", quantity: "12", batchNumber: "", expiryDate: "" },
      ]);
      setFeedback(
        `Recorded ${res.receipt?.receiptNumber ?? "GRN"} (+${res.receipt?.totalUnits ?? 0} units) into warehouse & 3D Digital Twin.`,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record goods receipt.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeader
        title="Goods Received (GRN)"
        description="Receive supplier shipments against purchase orders, assign warehouse rack locations, and log expiry batches."
        actions={
          <>
            <Link href={href("/purchase-orders")}>
              <Button size="sm" variant="secondary">
                Purchase Orders
              </Button>
            </Link>
            <Link href={href("/warehouse")}>
              <Button size="sm">3D Warehouse</Button>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record Goods Receipt Note</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Purchase Order (Optional)
                </label>
                <Select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                >
                  <option value="">Direct delivery (no PO)</option>
                  {orders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.orderNumber} — {po.supplierName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Destination Warehouse Rack
                </label>
                <Select
                  value={warehouseLocationId}
                  onChange={(e) => setWarehouseLocationId(e.target.value)}
                >
                  <option value="">Default Receiving Rack</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.zoneCode} · {loc.rackCode}/{loc.levelCode}/
                      {loc.positionCode}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Delivery Notes / Invoice #
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Waybill or supplier delivery note"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  Received Items & Batches
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      {
                        productId: "",
                        quantity: "12",
                        batchNumber: "",
                        expiryDate: "",
                      },
                    ])
                  }
                >
                  + Add Item
                </Button>
              </div>

              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid items-center gap-2 sm:grid-cols-[1.4fr_90px_140px_145px_auto]"
                >
                  <Select
                    value={line.productId}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, productId: e.target.value } : l,
                        ),
                      )
                    }
                    required
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, quantity: e.target.value } : l,
                        ),
                      )
                    }
                    placeholder="Qty"
                    required
                  />
                  <Input
                    value={line.batchNumber}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, batchNumber: e.target.value } : l,
                        ),
                      )
                    }
                    placeholder="Batch #"
                  />
                  <Input
                    type="date"
                    value={line.expiryDate}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, expiryDate: e.target.value } : l,
                        ),
                      )
                    }
                    aria-label="Expiry date"
                  />
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <Button type="submit" isLoading={saving}>
                Confirm Goods Receipt & Update Stock
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent Goods Receipts ({receipts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading receipts…</p>
          ) : receipts.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              No goods receipts recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Purchase Order</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Warehouse Rack</TableHead>
                  <TableHead>Received By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-bold text-teal-900">
                      {r.receiptNumber}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.orderNumber ? (
                        <Badge variant="secondary">{r.orderNumber}</Badge>
                      ) : (
                        <span className="text-muted">Direct</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{r.supplierName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted">
                      {r.warehouseLocation ?? "General Warehouse"}
                    </TableCell>
                    <TableCell className="text-xs">{r.receivedBy}</TableCell>
                    <TableCell className="text-xs text-muted">
                      {new Date(r.receivedAt).toLocaleString()}
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

export default function GoodsReceivedPage() {
  return (
    <React.Suspense
      fallback={<p className="text-sm text-muted">Loading goods receiving…</p>}
    >
      <GoodsReceivedInner />
    </React.Suspense>
  );
}
