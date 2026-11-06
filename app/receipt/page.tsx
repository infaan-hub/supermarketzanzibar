// Receipt page.
//
// Dedicated, printable receipt with a paper-feed animation and a
// downloadable PNG image.

"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/format";
import Link from "@/components/ui/link";
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

function downloadReceiptImage(receipt: ReceiptType) {
  const width = 420;
  const padding = 28;
  const lineHeight = 20;
  const itemLines = receipt.items.length;
  const height =
    padding * 2 +
    30 + // title
    16 + // subtitle
    14 + // divider
    itemLines * lineHeight +
    14 +
    4 * lineHeight +
    30;

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(2, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  let y = padding;
  ctx.fillStyle = "#1f3a2b";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("Supermarket Zanzibar", padding, y + 18);
  y += 30;

  ctx.fillStyle = "#5b7365";
  ctx.font = "12px sans-serif";
  ctx.fillText(formatDate(receipt.createdAt), padding, y + 12);
  y += 16;
  ctx.fillText(`Sale #${receipt.saleId}  ·  Control: ${receipt.controlNumber}`, padding, y + 12);
  y += 22;

  // divider
  ctx.strokeStyle = "#d7e3da";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 14;

  ctx.fillStyle = "#1f3a2b";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("Item", padding, y + 12);
  ctx.textAlign = "right";
  ctx.fillText("Qty", width - padding - 70, y + 12);
  ctx.fillText("Total", width - padding, y + 12);
  ctx.textAlign = "left";
  y += 18;

  ctx.font = "12px sans-serif";
  for (const item of receipt.items) {
    ctx.fillStyle = "#1f3a2b";
    ctx.fillText(item.productName.slice(0, 26), padding, y + 12);
    ctx.textAlign = "right";
    ctx.fillText(String(item.quantity), width - padding - 70, y + 12);
    ctx.fillText(formatMoney(item.total), width - padding, y + 12);
    ctx.textAlign = "left";
    y += lineHeight;
  }

  y += 6;
  ctx.strokeStyle = "#d7e3da";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 14;

  const row = (label: string, value: string, bold = false) => {
    ctx.fillStyle = "#1f3a2b";
    ctx.font = bold ? "bold 14px sans-serif" : "12px sans-serif";
    ctx.fillText(label, padding, y + 12);
    ctx.textAlign = "right";
    ctx.fillText(value, width - padding, y + 12);
    ctx.textAlign = "left";
    y += lineHeight;
  };

  row("Subtotal", formatMoney(receipt.subtotal));
  row("Tax (15%)", formatMoney(receipt.taxAmount));
  row("Total", formatMoney(receipt.grandTotal), true);
  y += 4;

  ctx.fillStyle = "#5b7365";
  ctx.font = "italic 11px sans-serif";
  ctx.fillText(
    `Payment: ${receipt.paymentMethod.replace("_", " ")} · Thank you for shopping!`,
    padding,
    y + 12,
  );

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receipt.saleId || "sale"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

export default function ReceiptPage() {
  const [receipt, setReceipt] = useState<ReceiptType | null>(null);
  const [loaded, setLoaded] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReceipt(readReceipt());
    setLoaded(true);
  }, []);

  if (!loaded) {
    return null;
  }

  if (!receipt) {
    return (
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Receipt</h1>
        <EmptyState
          title="No receipt to print"
          description="Complete a sale in the shopping cart to generate a receipt."
          action={
            <Link href="/shopping-cart" className="text-sm font-medium text-primary hover:underline">
              Go to shopping cart
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6">
      <style>{`
        @keyframes receiptPrint {
          0% { transform: translateY(-120%); opacity: 0; }
          60% { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .receipt-print {
          animation: receiptPrint 1.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .receipt-print { animation: none; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Receipt</h1>
          <p className="text-muted">Printing…</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => downloadReceiptImage(receipt)}>
            Download receipt
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              try {
                window.localStorage.removeItem(RECEIPT_KEY);
              } catch {
                // ignore
              }
              window.location.href = "/pos";
            }}
          >
            New sale
          </Button>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[420px]">
        <div className="mx-auto h-3 w-48 rounded-t-md bg-muted/40" aria-hidden="true" />
        <div
          ref={receiptRef}
          className="receipt-print rounded-b-md border border-border bg-background shadow-lg overflow-hidden"
        >
          <div className="border-b border-dashed border-border px-6 py-4 text-center">
            <p className="font-display text-lg font-bold text-foreground">Supermarket Zanzibar</p>
            <p className="text-xs text-muted">{formatDate(receipt.createdAt)}</p>
            <p className="text-xs text-muted">
              Sale #{receipt.saleId} · Control: {receipt.controlNumber}
            </p>
          </div>

          <div className="px-6 py-4 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-muted">
              <span>Item</span>
              <span>Qty</span>
              <span>Total</span>
            </div>
            {receipt.items.map((item, index) => (
              <div key={`${item.productName}-${index}`} className="flex justify-between text-sm">
                <span className="truncate pr-2">{item.productName}</span>
                <span className="tabular-nums">{item.quantity}</span>
                <span className="tabular-nums font-medium">{formatMoney(item.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-border px-6 py-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatMoney(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Tax (15%)</span>
              <span>{formatMoney(receipt.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-1">
              <span>Total</span>
              <span>{formatMoney(receipt.grandTotal)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border px-6 py-3 text-center">
            <p className="text-xs text-muted italic">
              Payment: {receipt.paymentMethod.replace("_", " ")} · Thank you for shopping!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
