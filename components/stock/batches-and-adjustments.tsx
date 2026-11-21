"use client";

import * as React from "react";
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
  createInventoryBatch,
  fetchInventoryBatches,
  submitStockAdjustment,
} from "@/lib/api";
import type { InventoryBatchRecord, StockItem } from "@/types/api";

export function BatchesAndAdjustments({
  stockItems,
  onInventoryChanged,
}: {
  stockItems: StockItem[];
  onInventoryChanged: () => void;
}) {
  const [batches, setBatches] = React.useState<InventoryBatchRecord[]>([]);
  const [batchFilter, setBatchFilter] = React.useState("all");
  const [loadingBatches, setLoadingBatches] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  // Adjustment Form
  const [adjProductId, setAdjProductId] = React.useState("");
  const [adjReason, setAdjReason] = React.useState<
    "DAMAGED" | "LOST" | "EXPIRED" | "COUNT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT"
  >("DAMAGED");
  const [adjQty, setAdjQty] = React.useState("1");
  const [adjNotes, setAdjNotes] = React.useState("");
  const [submittingAdj, setSubmittingAdj] = React.useState(false);

  // Batch Registration Form
  const [batchProductId, setBatchProductId] = React.useState("");
  const [batchNumber, setBatchNumber] = React.useState("");
  const [batchQty, setBatchQty] = React.useState("12");
  const [batchExpiry, setBatchExpiry] = React.useState("");
  const [submittingBatch, setSubmittingBatch] = React.useState(false);

  const loadBatches = React.useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetchInventoryBatches(
        batchFilter === "all" ? undefined : batchFilter,
      );
      setBatches(res.batches);
    } catch {
      // Migration might not yet be applied; keep section non-blocking.
    } finally {
      setLoadingBatches(false);
    }
  }, [batchFilter]);

  React.useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProductId) return;
    setSubmittingAdj(true);
    setError(null);
    setMessage(null);
    try {
      const res = await submitStockAdjustment({
        productId: adjProductId,
        reason: adjReason,
        quantity: Number(adjQty),
        notes: adjNotes.trim() || undefined,
      });
      setMessage(
        `${res.reason} recorded for ${res.product.name} (new stock: ${res.product.quantity}).`,
      );
      setAdjNotes("");
      onInventoryChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to post stock adjustment.",
      );
    } finally {
      setSubmittingAdj(false);
    }
  };

  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchProductId || !batchNumber.trim()) return;
    setSubmittingBatch(true);
    setError(null);
    setMessage(null);
    try {
      await createInventoryBatch({
        productId: batchProductId,
        batchNumber: batchNumber.trim(),
        quantity: Number(batchQty),
        expiryDate: batchExpiry || null,
      });
      setBatchNumber("");
      setBatchExpiry("");
      setMessage("Expiry batch logged and synchronized to 3D Digital Twin.");
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create batch.");
    } finally {
      setSubmittingBatch(false);
    }
  };

  return (
    <section className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Damaged / Lost / Physical Count Adjustment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Stock Adjustments, Counts & Write-Offs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdjustment} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Product
                </label>
                <Select
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  required
                >
                  <option value="">Select product…</option>
                  {stockItems.map((s) => (
                    <option key={s.productId} value={s.productId}>
                      {s.productName} (Current: {s.quantity})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Adjustment Reason
                  </label>
                  <Select
                    value={adjReason}
                    onChange={(e) =>
                      setAdjReason(
                        e.target.value as typeof adjReason,
                      )
                    }
                  >
                    <option value="DAMAGED">Damaged Goods (−)</option>
                    <option value="LOST">Lost / Shrinkage (−)</option>
                    <option value="EXPIRED">Expired Removal (−)</option>
                    <option value="COUNT">Physical Count (Set Exact Qty)</option>
                    <option value="ADJUSTMENT_IN">Manual Add (+)</option>
                    <option value="ADJUSTMENT_OUT">Manual Deduct (−)</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    {adjReason === "COUNT" ? "Counted Total Units" : "Units"}
                  </label>
                  <Input
                    type="number"
                    min={adjReason === "COUNT" ? 0 : 1}
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Audit Note
                </label>
                <Input
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="Reason or incident details"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                isLoading={submittingAdj}
              >
                Post Stock Adjustment
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Batch & Expiry Tracking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Register Product Batch & Expiry Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBatchCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Product
                </label>
                <Select
                  value={batchProductId}
                  onChange={(e) => setBatchProductId(e.target.value)}
                  required
                >
                  <option value="">Select product…</option>
                  {stockItems.map((s) => (
                    <option key={s.productId} value={s.productId}>
                      {s.productName}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Batch # (LOT-01)"
                  required
                />
                <Input
                  type="number"
                  min={1}
                  value={batchQty}
                  onChange={(e) => setBatchQty(e.target.value)}
                  placeholder="Qty"
                  required
                />
                <Input
                  type="date"
                  value={batchExpiry}
                  onChange={(e) => setBatchExpiry(e.target.value)}
                  aria-label="Batch expiry date"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                isLoading={submittingBatch}
              >
                Save Expiry Batch
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Expiry Batches Ledger */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Tracked Expiry Batches ({batches.length})
          </CardTitle>
          <Select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="h-8 w-44 text-xs"
          >
            <option value="all">All Batches</option>
            <option value="expiring">Expiring Within 14 Days</option>
            <option value="expired">Expired Only</option>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadingBatches ? (
            <p className="p-4 text-xs text-muted">Loading batches…</p>
          ) : batches.length === 0 ? (
            <p className="p-4 text-xs text-muted">
              No expiry batches match this filter yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Warehouse Rack</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-sm font-medium">
                      {b.productName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {b.batchNumber}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted">
                      {b.warehouseLocation ?? "General"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {b.quantity}
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {b.expiryDate
                        ? new Date(b.expiryDate).toLocaleDateString()
                        : "No expiry"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.isExpired
                            ? "danger"
                            : b.isExpiringSoon
                              ? "warning"
                              : "success"
                        }
                      >
                        {b.isExpired
                          ? "Expired"
                          : b.isExpiringSoon
                            ? "Expiring Soon"
                            : b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
