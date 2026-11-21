// Persistent database-backed receipt page (`/receipt/[id]`).
//
// Loads any historical sale directly from PostgreSQL, supports 58mm/80mm
// thermal printing, PNG image download, and WhatsApp sharing.

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";
import { fetchSaleDetail } from "@/lib/api";
import {
  formatBusinessDateTime,
  formatMoney,
  paymentMethodLabel,
  saleStatusTone,
  statusLabel,
} from "@/lib/format";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import type { SaleDetail } from "@/types/api";
import type { StoreSettings } from "@/lib/store-settings";

function downloadReceiptPng(sale: SaleDetail, settings: StoreSettings) {
  const width = 420;
  const padding = 28;
  const lineHeight = 20;
  const height =
    padding * 2 +
    96 +
    sale.items.length * lineHeight +
    120 +
    (sale.discount > 0 ? lineHeight : 0);

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
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(settings.storeName, padding, y + 16);
  y += 24;

  ctx.fillStyle = "#5b7365";
  ctx.font = "11px sans-serif";
  if (settings.storeAddress) {
    ctx.fillText(settings.storeAddress.slice(0, 52), padding, y + 12);
    y += 16;
  }
  ctx.fillText(formatBusinessDateTime(sale.createdAt), padding, y + 12);
  y += 16;
  ctx.fillText(
    `Sale #${sale.id}${sale.payment?.controlNumber ? ` · Control: ${sale.payment.controlNumber}` : ""}`,
    padding,
    y + 12,
  );
  y += 22;

  const drawDash = () => {
    ctx.strokeStyle = "#d7e3da";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 14;
  };

  drawDash();

  ctx.fillStyle = "#1f3a2b";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("Item", padding, y + 12);
  ctx.textAlign = "right";
  ctx.fillText("Qty", width - padding - 80, y + 12);
  ctx.fillText("Total", width - padding, y + 12);
  ctx.textAlign = "left";
  y += 20;

  ctx.font = "12px sans-serif";
  for (const item of sale.items) {
    ctx.fillStyle = "#1f3a2b";
    ctx.fillText(item.productName.slice(0, 26), padding, y + 12);
    ctx.textAlign = "right";
    ctx.fillText(String(item.quantity), width - padding - 80, y + 12);
    ctx.fillText(formatMoney(item.lineTotal), width - padding, y + 12);
    ctx.textAlign = "left";
    y += lineHeight;
  }

  y += 6;
  drawDash();

  const row = (label: string, value: string, bold = false) => {
    ctx.fillStyle = "#1f3a2b";
    ctx.font = bold ? "bold 14px sans-serif" : "12px sans-serif";
    ctx.fillText(label, padding, y + 12);
    ctx.textAlign = "right";
    ctx.fillText(value, width - padding, y + 12);
    ctx.textAlign = "left";
    y += lineHeight;
  };

  row("Subtotal", formatMoney(sale.subtotal));
  if (sale.discount > 0) row("Discount", `−${formatMoney(sale.discount)}`);
  row("Tax", formatMoney(sale.taxAmount));
  row("Total", formatMoney(sale.grandTotal), true);
  y += 8;

  ctx.fillStyle = "#5b7365";
  ctx.font = "italic 11px sans-serif";
  ctx.fillText(
    `Paid via ${paymentMethodLabel(sale.paymentMethod)} · ${settings.receiptFooter.slice(0, 46)}`,
    padding,
    y + 12,
  );

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${sale.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

export default function SaleReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { settings } = useStoreSettings();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const detail = await fetchSaleDetail(id);
        if (!cancelled) setSale(detail);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load receipt.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[680px] space-y-6">
        <SkeletonText lines={2} className="w-1/2" />
        <div className="mx-auto max-w-[400px] rounded-lg border border-border p-6">
          <SkeletonText lines={8} />
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="mx-auto max-w-[680px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Receipt #{id}</h1>
        <EmptyState
          title="Receipt not found"
          description={error ?? "This sale could not be loaded."}
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

  const widthClass =
    settings.receiptWidth === "58mm" ? "max-w-[300px]" : "max-w-[420px]";

  const whatsappText = encodeURIComponent(
    `${settings.storeName} Receipt #${sale.id}\n` +
      `Date: ${formatBusinessDateTime(sale.createdAt)}\n` +
      (sale.payment?.controlNumber
        ? `Control: ${sale.payment.controlNumber}\n`
        : "") +
      sale.items
        .map((i) => `• ${i.quantity}× ${i.productName}: ${formatMoney(i.lineTotal)}`)
        .join("\n") +
      `\nTotal: ${formatMoney(sale.grandTotal)}\n${settings.receiptFooter}`,
  );

  return (
    <div className="mx-auto max-w-[780px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Receipt #{sale.id}
            </h1>
            <Badge variant={saleStatusTone(sale.status)}>
              {statusLabel(sale.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted">
            Database-backed receipt · Thermal width: {settings.receiptWidth}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="default" onClick={() => window.print()}>
            Print Receipt
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadReceiptPng(sale, settings)}
          >
            Download PNG
          </Button>
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded border border-border bg-background px-3.5 text-sm font-medium text-foreground hover:bg-accent/5"
          >
            WhatsApp
          </a>
          <Link
            href={`/sales/${sale.id}`}
            className="inline-flex h-10 items-center justify-center rounded border border-border bg-background px-3.5 text-sm font-medium text-foreground hover:bg-accent/5"
          >
            Sale Detail
          </Link>
          <Link
            href="/pos"
            className="inline-flex h-10 items-center justify-center rounded bg-success px-3.5 text-sm font-medium text-white hover:bg-success/90"
          >
            New Sale
          </Link>
        </div>
      </div>

      <article
        className={`mx-auto w-full ${widthClass} rounded-lg border border-border bg-background shadow-lg overflow-hidden print:max-w-none print:rounded-none print:border-0 print:shadow-none`}
      >
        <div className="border-b border-dashed border-border px-6 py-5 text-center">
          <p className="font-display text-lg font-bold text-foreground">
            {settings.storeName}
          </p>
          {settings.storeTagline && (
            <p className="text-xs text-muted">{settings.storeTagline}</p>
          )}
          {settings.storeAddress && (
            <p className="mt-1 text-xs text-muted">{settings.storeAddress}</p>
          )}
          {settings.storePhone && (
            <p className="text-xs text-muted">Tel: {settings.storePhone}</p>
          )}
          {settings.taxNumber && (
            <p className="text-xs text-muted">TIN: {settings.taxNumber}</p>
          )}
          <div className="mt-3 space-y-0.5 text-xs text-muted">
            <p>{formatBusinessDateTime(sale.createdAt)}</p>
            <p className="font-mono text-foreground">
              Sale #{sale.id}
              {sale.payment?.controlNumber
                ? ` · ${sale.payment.controlNumber}`
                : ""}
            </p>
            <p>Customer: {sale.customerFullName}</p>
          </div>
        </div>

        <div className="space-y-2 px-6 py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_44px_88px] text-xs font-semibold text-muted">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Total</span>
          </div>
          {sale.items.map((item, index) => (
            <div
              key={item.id ?? `${item.productId}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_44px_88px] items-baseline gap-1 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {item.productName}
                </p>
                <p className="text-[11px] text-muted">
                  @ {formatMoney(item.price)}
                </p>
              </div>
              <span className="text-right tabular-nums">{item.quantity}</span>
              <span className="text-right font-medium tabular-nums">
                {formatMoney(item.lineTotal)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 border-t border-dashed border-border px-6 py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="tabular-nums">{formatMoney(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span className="tabular-nums">−{formatMoney(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">Tax</span>
            <span className="tabular-nums">{formatMoney(sale.taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
            <span>Grand Total</span>
            <span className="tabular-nums">{formatMoney(sale.grandTotal)}</span>
          </div>
          <div className="flex justify-between pt-1 text-xs text-muted">
            <span>Payment</span>
            <span>
              {paymentMethodLabel(sale.paymentMethod)} (
              {statusLabel(sale.payment?.status ?? "confirmed")})
            </span>
          </div>
        </div>

        {sale.payment?.controlNumber && (
          <div className="border-t border-dashed border-border px-6 py-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/barcodes/label?value=${encodeURIComponent(sale.payment.controlNumber)}&format=svg&height=10&scale=2`}
              alt={`Control barcode ${sale.payment.controlNumber}`}
              className="mx-auto max-h-14 w-auto"
            />
          </div>
        )}

        <div className="border-t border-dashed border-border bg-surface-subtle/60 px-6 py-3 text-center">
          <p className="text-xs italic text-muted">{settings.receiptFooter}</p>
        </div>
      </article>
    </div>
  );
}
