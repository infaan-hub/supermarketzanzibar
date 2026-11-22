// Sale detail page (`/sales/[id]`).
//
// Displays full line items, customer snapshot, payment reconciliation state,
// receipt reprint link, and manager/admin Cancel & Restock action.

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/components/auth/auth-provider";
import { isManagerRole } from "@/lib/auth/roles";
import {
  fetchSaleDetail,
  updatePaymentStatus,
  updateSaleStatus,
} from "@/lib/api";
import {
  formatBusinessDateTime,
  formatMoney,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  saleStatusTone,
  statusLabel,
} from "@/lib/format";
import type { SaleDetail } from "@/types/api";

export default function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const canManage = isManagerRole(user?.role);

  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const detail = await fetchSaleDetail(id);
      setSale(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sale.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancelAndRestock = async () => {
    if (!sale || actionBusy) return;
    if (
      !window.confirm(
        `Cancel Sale #${sale.id} and restock all ${sale.items.length} line item(s)?`,
      )
    ) {
      return;
    }
    setActionBusy(true);
    setNotice(null);
    try {
      const updated = await updateSaleStatus(sale.id, "cancelled");
      setSale(updated);
      setNotice("Sale cancelled and items have been returned to stock.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel sale.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!sale?.payment || actionBusy) return;
    setActionBusy(true);
    setNotice(null);
    try {
      await updatePaymentStatus(sale.payment.id, "confirmed");
      await load();
      setNotice("Payment confirmed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to confirm payment.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <SkeletonText lines={2} className="w-1/3" />
        <div className="h-72 rounded-lg border border-border p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Sale #{id}</h1>
        <EmptyState
          title="Unable to load sale"
          description={error ?? "Sale not found."}
          action={
            <Link
              href="/sales"
              className="inline-flex h-10 items-center rounded bg-primary-hover px-4 text-sm font-medium text-white"
            >
              Back to Sales
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/sales"
            className="text-xs font-medium text-muted hover:text-foreground hover:underline"
          >
            ← All sales
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Sale #{sale.id}
            </h1>
            <Badge variant={saleStatusTone(sale.status)}>
              {statusLabel(sale.status)}
            </Badge>
            {sale.payment && (
              <Badge variant={paymentStatusTone(sale.payment.status)}>
                Payment: {paymentStatusLabel(sale.payment.status)}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Recorded {formatBusinessDateTime(sale.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/receipt/${sale.id}`}>
            <Button size="sm">Print / Download Receipt</Button>
          </Link>
          {canManage &&
            sale.payment &&
            sale.payment.status === "pending" &&
            sale.status !== "cancelled" && (
              <Button
                variant="success"
                isLoading={actionBusy}
                onClick={() => void handleConfirmPayment()}
              >
                Confirm Payment
              </Button>
            )}
          {canManage && sale.status !== "cancelled" && (
            <Button
              variant="danger"
              isLoading={actionBusy}
              onClick={() => void handleCancelAndRestock()}
            >
              Cancel &amp; Restock
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order Items ({sale.items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item, idx) => (
                  <TableRow key={item.id ?? `${item.productId}-${idx}`}>
                    <TableCell>
                      <Link
                        href={`/products/${item.productId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.productName}
                      </Link>
                      {item.barcode && (
                        <p className="font-mono text-[11px] text-muted">
                          {item.barcode}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatMoney(item.price)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatMoney(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-1.5 border-t border-border p-6 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="tabular-nums">{formatMoney(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    −{formatMoney(sale.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Tax</span>
                <span className="tabular-nums">
                  {formatMoney(sale.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Grand Total</span>
                <span className="tabular-nums">
                  {formatMoney(sale.grandTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted">Name</span>
                {sale.customerId ? (
                  <Link
                    href={`/customers/${sale.customerId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {sale.customerFullName}
                  </Link>
                ) : (
                  <span className="font-medium">{sale.customerFullName}</span>
                )}
              </div>
              {sale.customerPhone && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Phone</span>
                  <span>{sale.customerPhone}</span>
                </div>
              )}
              {sale.customerEmail && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Email</span>
                  <span className="truncate">{sale.customerEmail}</span>
                </div>
              )}
              {sale.customerAddress && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Address</span>
                  <span className="text-right">{sale.customerAddress}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted">Method</span>
                <span className="font-medium">
                  {paymentMethodLabel(sale.paymentMethod)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted">Control #</span>
                <span className="font-mono text-xs">
                  {sale.payment?.controlNumber ?? "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted">Status</span>
                <Badge variant={paymentStatusTone(sale.payment?.status)}>
                  {paymentStatusLabel(sale.payment?.status)}
                </Badge>
              </div>
              {sale.payment?.confirmedBy && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Confirmed By</span>
                  <span>{sale.payment.confirmedBy}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
