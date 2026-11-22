// Latest receipt page.
//
// Shows the most recently completed sale from localStorage and redirects to or
// links with the database-backed `/receipt/[id]` page for permanent reprints.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatMoney, paymentMethodLabel } from "@/lib/format";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import type { Receipt as ReceiptType } from "@/hooks/usePosCart";

const RECEIPT_KEY = "ss_receipt";

function readReceipt(): ReceiptType | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RECEIPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReceiptType;
  } catch {
    return null;
  }
}

export default function ReceiptPage() {
  const router = useRouter();
  const { settings } = useStoreSettings();
  const [receipt, setReceipt] = useState<ReceiptType | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const latest = readReceipt();
    if (latest?.saleId) {
      router.replace(`/receipt/${encodeURIComponent(latest.saleId)}`);
      return;
    }
    setReceipt(latest);
    setLoaded(true);
  }, [router]);

  if (!loaded) return null;

  if (!receipt) {
    return (
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Receipt
        </h1>
        <EmptyState
          title="No recent receipt"
          description="Complete a sale at the POS terminal or open any past order from Sales to reprint its receipt."
          action={
            <div className="flex gap-3">
              <Link
                href="/pos"
                className="inline-flex h-10 items-center rounded bg-primary-hover px-4 text-sm font-medium text-white"
              >
                Open POS
              </Link>
              <Link
                href="/sales"
                className="inline-flex h-10 items-center rounded border border-border px-4 text-sm font-medium text-foreground"
              >
                Browse Sales
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[780px] space-y-6">
      <PageHeader
        eyebrow="Digital & Thermal Receipt"
        title="Receipt"
        description="Latest completed transaction ready for 58mm/80mm thermal printing."
        className="print:hidden"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            <Link href="/pos">
              <Button size="sm">New Sale</Button>
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-[390px] rounded-2xl border border-border bg-white p-6 shadow-soft print:border-0 print:shadow-none">
        <div className="border-b border-dashed border-border pb-4 text-center">
          <p className="font-display text-lg font-bold">{settings.storeName}</p>
          <p className="text-xs text-muted">{settings.storeAddress}</p>
          <p className="mt-1 text-xs text-muted">
            {formatDate(receipt.createdAt)} · Control: {receipt.controlNumber}
          </p>
        </div>
        <div className="space-y-1.5 py-4 text-sm">
          {receipt.items.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-2">
              <span className="truncate">
                {item.quantity}× {item.productName}
              </span>
              <span className="font-medium tabular-nums">
                {formatMoney(item.total)}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t border-dashed border-border pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatMoney(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">
              Tax ({receipt.taxRatePercent ?? settings.taxRatePercent}%)
            </span>
            <span>{formatMoney(receipt.taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(receipt.grandTotal)}</span>
          </div>
          <p className="pt-2 text-center text-xs text-muted italic">
            {paymentMethodLabel(receipt.paymentMethod)} · {settings.receiptFooter}
          </p>
        </div>
      </div>
    </div>
  );
}
