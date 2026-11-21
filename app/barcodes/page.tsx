// Bulk Barcode Label Print Studio (`/barcodes`).
//
// Select multiple product or carton barcodes, set label quantities, preview
// Code 128 shelf stickers, and print an entire batch cleanly in one click.

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";
import { fetchAllBarcodes } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import type { BulkBarcodeItem } from "@/types/api";

export default function BarcodesStudioPage() {
  const { settings } = useStoreSettings();
  const [items, setItems] = useState<BulkBarcodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"compact" | "shelf">("compact");
  const [copiesByBarcode, setCopiesByBarcode] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetchAllBarcodes();
        if (!cancelled) setItems(res.barcodes);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load barcodes.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.productName.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q) ||
        (i.categoryName ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const setCopies = (barcode: string, qty: number) => {
    setCopiesByBarcode((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[barcode];
      else next[barcode] = Math.min(qty, 60);
      return next;
    });
  };

  const printQueue = useMemo(() => {
    const stickers: Array<{ key: string; item: BulkBarcodeItem }> = [];
    for (const item of items) {
      const count = copiesByBarcode[item.barcode] ?? 0;
      for (let i = 0; i < count; i += 1) {
        stickers.push({ key: `${item.barcode}-${i}`, item });
      }
    }
    return stickers;
  }, [items, copiesByBarcode]);

  const selectAllVisible = () => {
    const next: Record<string, number> = { ...copiesByBarcode };
    for (const item of filtered) {
      next[item.barcode] = next[item.barcode] || 1;
    }
    setCopiesByBarcode(next);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-1/3" />
        <div className="h-72 rounded-lg border border-border p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Bulk Label Printing</h1>
        <EmptyState title="Unable to load barcodes" description={error} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Bulk Barcode Label Studio
          </h1>
          <p className="text-sm text-muted">
            Select products and pack labels, set copy counts, and print an A4 or
            thermal label sheet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={layout}
            onChange={(e) => setLayout(e.target.value as "compact" | "shelf")}
            className="w-44"
          >
            <option value="compact">Compact Stickers (3-col)</option>
            <option value="shelf">Shelf Price Cards (2-col)</option>
          </Select>
          <Button
            variant="default"
            disabled={printQueue.length === 0}
            onClick={() => window.print()}
          >
            Print Sheet ({printQueue.length})
          </Button>
        </div>
      </div>

      {/* Selector panel — hidden when printing */}
      <Card className="print:hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Choose Labels ({items.length} available)</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search products or barcodes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Button variant="secondary" size="sm" onClick={selectAllVisible}>
              +1 All Visible
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCopiesByBarcode({})}
              disabled={printQueue.length === 0}
            >
              Clear Queue
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              title="No barcodes found"
              description="Register products on the Stock page to generate Code 128 labels."
            />
          ) : (
            <div className="grid max-h-[340px] grid-cols-1 gap-2.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => {
                const count = copiesByBarcode[item.barcode] ?? 0;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      count > 0
                        ? "border-primary/40 bg-surface-subtle"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {item.productName}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="font-mono">{item.barcode}</span>
                        {item.quantityMultiplier > 1 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.unitId} × {item.quantityMultiplier}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 p-0"
                        onClick={() => setCopies(item.barcode, count - 1)}
                      >
                        −
                      </Button>
                      <span className="w-7 text-center text-xs font-bold tabular-nums">
                        {count}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 p-0"
                        onClick={() => setCopies(item.barcode, count + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Printable Preview Sheet */}
      {printQueue.length === 0 ? (
        <div className="print:hidden">
          <EmptyState
            title="Print queue is empty"
            description="Increment the copy count on one or more products above to preview your printable Code 128 label sheet."
          />
        </div>
      ) : (
        <section aria-label="Printable barcode sheet">
          <div
            className={`grid gap-3 ${
              layout === "compact"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 print:grid-cols-2"
            }`}
          >
            {printQueue.map(({ key, item }) => (
              <div
                key={key}
                className="break-inside-avoid rounded-lg border border-border bg-background p-3.5 text-center shadow-sm print:border-foreground/30 print:shadow-none"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-hover">
                  {settings.storeName}
                </p>
                <p className="mt-0.5 truncate font-display text-sm font-bold text-foreground">
                  {item.productName}
                </p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="font-display text-base font-bold text-foreground tabular-nums">
                    {formatMoney(item.price)}
                  </span>
                  {item.quantityMultiplier > 1 && (
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-primary-hover">
                      {item.unitId} ({item.quantityMultiplier})
                    </span>
                  )}
                </div>
                <div className="mt-2 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/barcodes/label?value=${encodeURIComponent(item.barcode)}&format=svg&height=11&scale=2`}
                    alt={`Barcode ${item.barcode}`}
                    className="max-h-14 w-auto"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
