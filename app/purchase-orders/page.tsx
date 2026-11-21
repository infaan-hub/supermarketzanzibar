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
import {
  createPurchaseOrder,
  fetchProducts,
  fetchPurchaseOrders,
  fetchSuppliers,
  updatePurchaseOrderStatus,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Product, PurchaseOrderRecord, Supplier } from "@/types/api";

interface DraftLine {
  productId: string;
  orderedQuantity: string;
  unitCost: string;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = React.useState<PurchaseOrderRecord[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const [supplierId, setSupplierId] = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>([
    { productId: "", orderedQuantity: "24", unitCost: "" },
  ]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [poRes, supRes, prodRes] = await Promise.all([
        fetchPurchaseOrders(),
        fetchSuppliers({ take: 100 }),
        fetchProducts({ take: 200 }),
      ]);
      setOrders(poRes.purchaseOrders);
      setSuppliers(supRes.suppliers);
      setProducts(prodRes.products);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load purchase orders.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleProductPick = (idx: number, pid: string) => {
    const prod = products.find((p) => p.id === pid);
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId: pid,
              unitCost: prod?.costPrice
                ? String(Number(prod.costPrice))
                : l.unitCost || "0",
            }
          : l,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines
      .filter((l) => l.productId && Number(l.orderedQuantity) > 0)
      .map((l) => ({
        productId: l.productId,
        orderedQuantity: Number(l.orderedQuantity),
        unitCost: Number(l.unitCost || 0),
      }));

    if (!supplierId || validLines.length === 0) {
      setError("Select a supplier and at least one product line.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await createPurchaseOrder({
        supplierId,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        items: validLines,
      });
      setSupplierId("");
      setExpectedDate("");
      setNotes("");
      setLines([{ productId: "", orderedQuantity: "24", unitCost: "" }]);
      setFeedback("Purchase order created and recorded in PostgreSQL.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create purchase order.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    setError(null);
    try {
      await updatePurchaseOrderStatus(id, "cancelled");
      setFeedback("Purchase order marked cancelled.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update PO status.",
      );
    }
  };

  const draftTotal = lines.reduce(
    (sum, l) => sum + (Number(l.orderedQuantity) || 0) * (Number(l.unitCost) || 0),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Procurement & Replenishment
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Purchase Orders
          </h1>
          <p className="text-sm text-muted">
            Order replenishment stock from suppliers and receive deliveries
            directly into 3D warehouse racks.
          </p>
        </div>
        <Link href="/goods-received">
          <Button size="sm">Receive Goods (GRN)</Button>
        </Link>
      </div>

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

      {/* Create PO Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Supplier Purchase Order</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Supplier
                </label>
                <Select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Expected Delivery Date
                </label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Notes
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery gate or invoice reference"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  Order Line Items
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      { productId: "", orderedQuantity: "12", unitCost: "" },
                    ])
                  }
                >
                  + Add Line
                </Button>
              </div>

              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid items-center gap-2 sm:grid-cols-[1fr_110px_130px_auto]"
                >
                  <Select
                    value={line.productId}
                    onChange={(e) => handleProductPick(idx, e.target.value)}
                    required
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.quantity})
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={line.orderedQuantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx
                            ? { ...l, orderedQuantity: e.target.value }
                            : l,
                        ),
                      )
                    }
                    placeholder="Qty"
                    required
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, unitCost: e.target.value } : l,
                        ),
                      )
                    }
                    placeholder="Unit cost"
                    required
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-sm font-semibold text-foreground">
                Estimated PO Total:{" "}
                <span className="font-mono text-teal-800">
                  {formatMoney(draftTotal)}
                </span>
              </p>
              <Button type="submit" isLoading={saving}>
                Create Purchase Order
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* PO History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Purchase Orders ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading purchase orders…</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              No purchase orders recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Lines & Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-bold text-teal-900">
                      {po.orderNumber}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {po.supplierName}
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {po.items.map((i) => (
                        <div key={i.id}>
                          {i.productName}:{" "}
                          <strong className="text-foreground">
                            {i.receivedQuantity}/{i.orderedQuantity}
                          </strong>
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          po.status === "received"
                            ? "success"
                            : po.status === "cancelled"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {po.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatMoney(po.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {po.status !== "received" &&
                          po.status !== "cancelled" && (
                            <>
                              <Link
                                href={`/goods-received?po=${encodeURIComponent(po.id)}`}
                              >
                                <Button size="sm">Receive</Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleCancel(po.id)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                      </div>
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
