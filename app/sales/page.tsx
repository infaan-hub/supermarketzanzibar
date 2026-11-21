// Sales page.
//
// Searchable, filterable order history with direct links to Sale Detail and
// database-backed Receipt Reprints.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSales } from "@/hooks/useSales";
import {
  formatBusinessDateTime,
  formatMoney,
  paymentMethodLabel,
  saleStatusTone,
  statusLabel,
} from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "payment_confirmed", label: "Payment Confirmed" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "processing", label: "Processing" },
  { value: "cancelled", label: "Cancelled" },
];

const METHOD_OPTIONS = [
  { value: "", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const { data, loading, error, refresh } = useSales({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    method: methodFilter || undefined,
  });

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-[40%]" />
        <div className="h-80 rounded-lg border border-border bg-background p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Sales
        </h1>
        <EmptyState
          title="Unable to load sales"
          description={error.message}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const sales = data?.sales ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Sales
          </h1>
          <p className="text-sm text-muted">
            Completed and pending POS orders. Select any order to inspect items
            or reprint its receipt.
          </p>
        </div>
        <Link
          href="/pos"
          className="inline-flex h-10 items-center justify-center rounded bg-primary-hover px-4 text-sm font-medium text-white shadow-sm hover:bg-[#0f5c23]"
        >
          + New Sale
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by order #, control #, or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="sm:w-44"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title="No matching sales"
          description="No orders match your current filters."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Control #</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono font-semibold">
                    <Link
                      href={`/sales/${s.id}`}
                      className="text-primary hover:underline"
                    >
                      #{s.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.customerFullName || s.customer?.name || "Walk-in Customer"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted">
                    {s.controlNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {formatMoney(s.grandTotal)}
                  </TableCell>
                  <TableCell className="text-sm text-muted">
                    {paymentMethodLabel(s.paymentMethod)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={saleStatusTone(s.status)}>
                      {statusLabel(s.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted">
                    {formatBusinessDateTime(s.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/sales/${s.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Details
                      </Link>
                      <Link
                        href={`/receipt/${s.id}`}
                        className="text-xs font-medium text-foreground hover:underline"
                      >
                        Receipt
                      </Link>
                    </div>
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
