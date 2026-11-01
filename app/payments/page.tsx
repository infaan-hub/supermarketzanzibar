// Payments page.

"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayments } from "@/hooks/usePayments";
import { formatMoney, formatDate } from "@/lib/format";

export default function PaymentsPage() {
  const { data, loading, error } = usePayments();

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Payments</h1>
        <div className="bg-background rounded-lg border border-border shadow-sm h-80">
          <SkeletonText lines={6} className="p-6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Payments</h1>
        <EmptyState
          title="Unable to load payments"
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

  const payments = data?.payments ?? [];

  if (payments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Payments</h1>
            <p className="text-muted">Processed payments (cash, mobile money, card).</p>
          </div>
        </div>
        <EmptyState title="No payments" description="Payments will appear here as sales are completed." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-muted">Processed payments (cash, mobile money, card).</p>
        </div>
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%] font-mono text-sm">ID</TableHead>
              <TableHead className="w-[14%] font-mono text-sm">Sale</TableHead>
              <TableHead className="w-[16%] text-right">Amount</TableHead>
              <TableHead className="w-[16%]">Method</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="w-[14%] text-right">Reference</TableHead>
              <TableHead className="w-[16%] text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">#{p.id}</TableCell>
                <TableCell className="font-mono text-sm">{p.saleId}</TableCell>
                <TableCell className="text-sm font-medium text-right">{formatMoney(p.amount)}</TableCell>
                <TableCell className="text-sm text-muted capitalize">{p.paymentMethod}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant={p.status === "completed" ? "success" : "secondary"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted text-right font-mono">{p.referenceNumber}</TableCell>
                <TableCell className="text-sm text-muted text-right">{formatDate(p.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
