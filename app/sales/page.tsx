// Sales page.
//
// Browse orders with status filtering, powered by the typed API client.

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "@/components/ui/link";
import { useSales } from "@/hooks/useSales";
import { formatMoney, formatDate } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

export default function SalesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, loading, error } = useSales({ status: statusFilter });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-[40%]" />
        </div>
        <div className="bg-background rounded-lg border border-border shadow-sm h-80">
          <SkeletonText lines={5} className="p-6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Sales</h1>
        <EmptyState
          title="Unable to load sales"
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

  const sales = data?.sales ?? [];

  if (sales.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Sales</h1>
            <p className="text-muted">Order records for the POS dashboard.</p>
          </div>
          <Link href="/pos" className="inline-flex h-10 items-center justify-center rounded bg-primary px-4 text-sm font-medium text-white shadow-sm hover:bg-primary/90">
            New Sale
          </Link>
        </div>
        <EmptyState title="No sales" description="No orders match your filters." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Sales</h1>
          <p className="text-muted">Order records for the POS dashboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-56"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Link href="/pos" className="inline-flex h-10 items-center justify-center rounded bg-primary px-4 text-sm font-medium text-white shadow-sm hover:bg-primary/90">
            New Sale
          </Link>
        </div>
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%] font-mono text-sm">Order</TableHead>
              <TableHead className="w-[20%]">Customer</TableHead>
              <TableHead className="w-[14%] text-right">Total</TableHead>
              <TableHead className="w-[14%]">Payment</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="w-[22%] text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">#{s.id}</TableCell>
                <TableCell className="text-sm">{s.customer?.name ?? "Walk-in"}</TableCell>
                <TableCell className="text-sm font-medium text-right">
                  {formatMoney(s.grandTotal)}
                </TableCell>
                <TableCell className="text-sm text-muted capitalize">
                  {s.paymentMethod}
                </TableCell>
                <TableCell className="text-sm">
                  <Badge
                    variant={
                      s.status === "completed"
                        ? "success"
                        : s.status === "pending"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted text-right">
                  {formatDate(s.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
