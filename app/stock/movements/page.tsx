// Stock Movement Audit Ledger (`/stock/movements`).
//
// Filterable history of every IN and OUT inventory movement with CSV export.

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchStockMovements } from "@/lib/api";
import { formatBusinessDateTime } from "@/lib/format";
import type { StockMovementRow, StockMovementsResponse } from "@/types/api";

function exportCsv(rows: StockMovementRow[]) {
  const header = ["ID", "Date", "Type", "Product", "Barcode", "Category", "Quantity", "Sale ID"];
  const lines = rows.map((r) =>
    [
      r.id,
      r.date,
      r.movementType,
      `"${r.productName.replace(/"/g, '""')}"`,
      r.barcode,
      `"${(r.category ?? "").replace(/"/g, '""')}"`,
      r.quantity,
      r.saleId ?? "",
    ].join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StockMovementsContent() {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productId") ?? "";

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [productId, setProductId] = useState(initialProductId);

  const [data, setData] = useState<StockMovementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchStockMovements({
        search: search.trim() || undefined,
        type: type || undefined,
        productId: productId || undefined,
        start: start || undefined,
        end: end || undefined,
        take: 100,
      });
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load stock history.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, type, productId, start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const movements = data?.movements ?? [];
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/stock"
            className="text-xs font-medium text-primary hover:underline"
          >
            ← Back to Stock &amp; Counting
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
            Stock Movement Ledger
          </h1>
          <p className="text-sm text-muted">
            Full audit trail of every stock receipt, manual adjustment, and POS
            sale deduction.
          </p>
        </div>
        <div className="flex gap-2">
          {productId && (
            <Button variant="secondary" onClick={() => setProductId("")}>
              Clear Product Filter
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={movements.length === 0}
            onClick={() => exportCsv(movements)}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted">Total Received (IN)</p>
              <p className="mt-1 font-display text-2xl font-bold text-success tabular-nums">
                +{summary.totalIn} units
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted">Total Issued (OUT)</p>
              <p className="mt-1 font-display text-2xl font-bold text-warning tabular-nums">
                −{summary.totalOut} units
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted">Net Change</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                {summary.netChange >= 0 ? "+" : ""}
                {summary.netChange} units
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search product or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Movement Types</option>
          <option value="IN">Stock IN only</option>
          <option value="OUT">Stock OUT only</option>
        </Select>
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Start date"
        />
        <Input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          aria-label="End date"
        />
      </div>

      {loading && !data ? (
        <div className="h-72 rounded-lg border border-border p-6">
          <SkeletonText lines={6} />
        </div>
      ) : error ? (
        <EmptyState
          title="Unable to load movements"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : movements.length === 0 ? (
        <EmptyState
          title="No movements found"
          description="No stock movements match your filters."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      href={`/products/${m.productId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {m.productName}
                    </Link>
                    {m.category && (
                      <p className="text-xs text-muted">{m.category}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted">
                    {m.barcode}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={m.movementType === "IN" ? "success" : "warning"}
                    >
                      {m.movementType === "IN" ? "IN" : "OUT"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {m.movementType === "IN" ? "+" : "−"}
                    {m.quantity}
                  </TableCell>
                  <TableCell className="text-sm text-muted">
                    {m.saleId ? (
                      <Link
                        href={`/sales/${m.saleId}`}
                        className="text-primary hover:underline"
                      >
                        Sale #{m.saleId}
                      </Link>
                    ) : (
                      "Stock terminal"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted">
                    {formatBusinessDateTime(m.date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function StockMovementsPage() {
  return (
    <Suspense fallback={null}>
      <StockMovementsContent />
    </Suspense>
  );
}
