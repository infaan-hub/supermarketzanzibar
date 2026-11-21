// Payments & Reconciliation page (`/payments`).
//
// Track confirmed and pending payments, filter by method/status/control #, and
// allow managers/admins to confirm pending payments with one click.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
import { usePayments } from "@/hooks/usePayments";
import { useAuth } from "@/components/auth/auth-provider";
import { isManagerRole } from "@/lib/auth/roles";
import { updatePaymentStatus } from "@/lib/api";
import {
  formatBusinessDateTime,
  formatMoney,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/format";

export default function PaymentsPage() {
  const { user } = useAuth();
  const canManage = isManagerRole(user?.role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, loading, error, refresh } = usePayments({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    method: methodFilter || undefined,
  });

  const handleStatusChange = async (
    id: string,
    nextStatus: "confirmed" | "refunded",
  ) => {
    setBusyId(id);
    setFeedback(null);
    try {
      await updatePaymentStatus(id, nextStatus);
      setFeedback(`Payment marked as ${nextStatus}.`);
      refresh();
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Unable to update payment.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-1/3" />
        <div className="h-80 rounded-lg border border-border p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Payments</h1>
        <EmptyState
          title="Unable to load payments"
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

  const payments = data?.payments ?? [];
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Payments &amp; Reconciliation
        </h1>
        <p className="text-sm text-muted">
          Monitor control numbers, confirm pending mobile money or bank
          transfers, and reconcile receipts.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted">Confirmed Volume</p>
              <p className="mt-1 font-display text-2xl font-bold text-success tabular-nums">
                {formatMoney(summary.totalConfirmedAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted">Confirmed Count</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                {summary.confirmedCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted">Pending Amount</p>
              <p className="mt-1 font-display text-2xl font-bold text-warning tabular-nums">
                {formatMoney(summary.pendingAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted">Pending Approval</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
                {summary.pendingCount}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-border bg-surface-subtle px-4 py-2.5 text-sm text-foreground"
        >
          {feedback}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search control #, sale #, or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-44"
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </Select>
        <Select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="sm:w-44"
        >
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="mobile_money">Mobile Money</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
        </Select>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments found"
          description="No payment records match your filters."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Control #</TableHead>
                <TableHead>Sale</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confirmed By</TableHead>
                <TableHead className="text-right">Date</TableHead>
                {canManage && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {p.controlNumber}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/sales/${p.saleId}`}
                      className="font-mono text-sm font-medium text-primary hover:underline"
                    >
                      #{p.saleId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{p.customerName}</TableCell>
                  <TableCell className="text-sm text-muted">
                    {paymentMethodLabel(p.paymentMethod)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {formatMoney(p.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentStatusTone(p.status)}>
                      {paymentStatusLabel(p.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted">
                    {p.confirmedBy ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted">
                    {formatBusinessDateTime(p.createdAt)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {p.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="success"
                          isLoading={busyId === p.id}
                          onClick={() =>
                            void handleStatusChange(p.id, "confirmed")
                          }
                        >
                          Confirm
                        </Button>
                      ) : (
                        <Link
                          href={`/receipt/${p.saleId}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Receipt
                        </Link>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
