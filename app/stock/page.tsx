// Stock page.
//
// Inventory levels with low-stock and reorder alerts, powered by the typed API client.

"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStock } from "@/hooks/useStock";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function StockPage() {
  const { data, loading, error } = useStock();

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Inventory Stock Levels</h1>
        <div className="bg-background rounded-lg border border-border shadow-sm h-80">
          <SkeletonText lines={6} className="p-6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Inventory Stock Levels</h1>
        <EmptyState
          title="Unable to load stock"
          description={error.message}
          action={
            <button onClick={() => window.location.reload()} className="btn-try">
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const stock = data?.stock ?? [];

  if (stock.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Inventory Stock Levels</h1>
            <p className="text-muted">List products with current stock levels and inventory alerts.</p>
          </div>
        </div>
        <EmptyState title="No stock items" description="Inventory levels will appear here." />
      </div>
    );
  }

  const lowCount = stock.filter((s) => s.quantity <= s.lowStockThreshold).length;
  const criticalCount = stock.filter((s) => s.quantity <= s.reorderLevel).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Inventory Stock Levels</h1>
          <p className="text-muted">List products with current stock levels and inventory alerts.</p>
        </div>
        <div className="flex gap-3">
          <Badge variant={criticalCount ? "danger" : "success"}>
            {criticalCount} critical
          </Badge>
          <Badge variant={lowCount ? "warning" : "success"}>
            {lowCount} low stock
          </Badge>
        </div>
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[26%]">Product</TableHead>
              <TableHead className="w-[16%]">Category</TableHead>
              <TableHead className="w-[14%] text-right">Quantity</TableHead>
              <TableHead className="w-[14%] text-right">Low Stock</TableHead>
              <TableHead className="w-[16%] text-right">Reorder</TableHead>
              <TableHead className="w-[14%] text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.map((s) => {
              const isCritical = s.quantity <= s.reorderLevel;
              const isLow = s.quantity <= s.lowStockThreshold;
              return (
                <TableRow key={s.productId}>
                  <TableCell className="font-medium">{s.productName}</TableCell>
                  <TableCell className="text-sm text-muted">
                    {s.category?.name ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm font-medium text-right",
                      isCritical
                        ? "text-danger"
                        : isLow
                        ? "text-warning"
                        : "text-success",
                    )}
                  >
                    {s.quantity}
                  </TableCell>
                  <TableCell className="text-sm text-right text-muted">
                    {s.lowStockThreshold}
                  </TableCell>
                  <TableCell className="text-sm text-right text-muted">
                    {s.reorderLevel}
                  </TableCell>
                  <TableCell className="text-sm text-right text-muted">
                    {formatDate(s.updatedAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
