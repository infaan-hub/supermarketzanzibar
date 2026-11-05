// GET /api/barcodes/label?value=... - render a printable product label.
//
// By default this returns a boarding-pass style HTML card with the product
// details and an embedded Code 128 barcode, suitable for opening in a new
// tab or printing. Add `?format=svg` (or `?raw=1`) to receive only the
// barcode SVG, which is useful when embedding the label in another view.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidCode128, normalizeBarcode } from "@/lib/barcodes";
import { badRequest } from "@/lib/http";
import { code128Svg } from "@/lib/media";

function numberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const value = normalizeBarcode(
    searchParams.get("value") ??
      searchParams.get("barcode") ??
      searchParams.get("code"),
  );

  if (!isValidCode128(value)) {
    return badRequest(
      "A label value of 1-80 printable ASCII characters is required.",
    );
  }

  const scale = numberParam(searchParams.get("scale"));
  const height = numberParam(searchParams.get("height"));
  const textSize = numberParam(searchParams.get("textSize"));
  const includeText = searchParams.get("text") !== "0";

  let svg: string;
  try {
    svg = code128Svg(value, { scale, height, textSize, includeText });
  } catch (error) {
    console.error("Barcode label generation failed:", error);
    return badRequest("Unable to generate this Code 128 label.");
  }

  // Raw SVG mode, for embedding the label in another document or image view.
  if (
    searchParams.get("format") === "svg" ||
    searchParams.get("raw") === "1"
  ) {
    const filename =
      value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 40) || "barcode";
    const disposition =
      searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `${disposition}; filename="${filename}.svg"`,
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  }

  // Look up the product so the card can carry its details. A pack/shelf
  // label may resolve to a product through the ProductBarcode table.
  let productName: string | null = null;
  let categoryName: string | null = null;
  let price: number | null = null;
  let quantity: number | null = null;
  let packLabel: string | null = null;

  try {
    const product = await prisma.product.findUnique({
      where: { barcode: value },
      include: { category: true },
    });

    if (product) {
      productName = product.name;
      categoryName = product.category?.name ?? null;
      price = Number(product.price);
      quantity = product.quantity;
    } else {
      const pack = await prisma.productBarcode.findUnique({
        where: { barcode: value },
        include: {
          product: { include: { category: true } },
        },
      });
      if (pack) {
        productName = pack.product.name;
        categoryName = pack.product.category?.name ?? null;
        price = Number(pack.product.price);
        quantity = pack.product.quantity;
        packLabel =
          pack.unitId && pack.unitId !== "each"
            ? `${pack.unitId} · ${Number(pack.quantityMultiplier)} units`
            : `${Number(pack.quantityMultiplier)} units`;
      }
    }
  } catch (error) {
    console.error("Barcode label product lookup failed:", error);
  }

  const displayName = productName ?? "Unregistered label";
  const subtitle = packLabel
    ? `Pack label · ${packLabel}`
    : categoryName
      ? categoryName
      : "Primary product label";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(displayName)} · Label ${escapeHtml(value)}</title>
  <style>
    :root {
      --ink: #1f3a2b;
      --muted: #5b7365;
      --border: #d7e3da;
      --surface: #ffffff;
      --accent: #1f8f3a;
      --accent-soft: #eef7f1;
      --danger: #c4242a;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--ink);
      background: linear-gradient(135deg, #f4faf6 0%, #ffffff 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .ticket {
      width: min(780px, 100%);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(31, 58, 43, 0.10);
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 112px;
    }
    .ticket-main {
      padding: 26px 30px 22px;
      position: relative;
    }
    .ticket-stub {
      position: relative;
      padding: 22px 14px;
      background: var(--accent-soft);
      border-left: 2px dashed var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .ticket-stub::before,
    .ticket-stub::after {
      content: "";
      position: absolute;
      left: -12px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f4faf6 0%, #ffffff 100%);
      border: 1px solid var(--border);
    }
    .ticket-stub::before { top: -11px; }
    .ticket-stub::after { bottom: -11px; }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .brand-mark {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: var(--accent);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 11px;
    }
    .title {
      margin: 12px 0 2px;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.01em;
    }
    .subtitle {
      font-size: 12px;
      color: var(--muted);
    }
    .meta {
      margin-top: 16px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 18px;
    }
    .meta dt {
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0;
    }
    .meta dd {
      margin: 2px 0 0;
      font-size: 13px;
      font-weight: 500;
    }
    .meta dd.mono {
      font-family: "DM Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 12px;
      letter-spacing: 0.04em;
    }
    .barcode-block {
      margin-top: 18px;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .barcode-block svg {
      width: 100%;
      height: auto;
      max-width: 420px;
    }
    .barcode-value {
      font-family: "DM Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 11px;
      letter-spacing: 0.14em;
      color: var(--ink);
      text-align: center;
      word-break: break-all;
    }
    .stub-mark {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--accent);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
    }
    .stub-label {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-family: "DM Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 10px;
      letter-spacing: 0.16em;
      color: var(--ink);
      text-align: center;
      word-break: break-all;
      max-height: 150px;
      overflow: hidden;
    }
    .stub-note {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .footer {
      grid-column: 1 / -1;
      padding: 11px 30px;
      border-top: 1px dashed var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 11px;
      color: var(--muted);
      background: var(--accent-soft);
    }
    .footer strong { color: var(--ink); font-weight: 600; }
    .print-btn {
      border: 0;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
    }
    .print-btn:hover { filter: brightness(0.95); }
    @media print {
      body { background: #fff; padding: 0; }
      .ticket { box-shadow: none; border: 1px solid #999; }
      .print-btn { display: none; }
      .footer { background: #fff; }
    }
    @media (max-width: 640px) {
      .ticket { grid-template-columns: 1fr; }
      .ticket-stub {
        flex-direction: row;
        border-left: 0;
        border-top: 2px dashed var(--border);
        padding: 14px 22px;
      }
      .ticket-stub::before,
      .ticket-stub::after { display: none; }
      .stub-label,
      .stub-note { writing-mode: horizontal-tb; transform: none; max-height: none; }
    }
  </style>
</head>
<body>
  <article class="ticket" aria-label="Product label">
    <div class="ticket-main">
      <div class="brand">
        <span class="brand-mark">SZ</span>
        <span>Supermarket Zanzibar · Product label</span>
      </div>
      <h1 class="title">${escapeHtml(displayName)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>

      <dl class="meta">
        <div>
          <dt>Barcode</dt>
          <dd class="mono">${escapeHtml(value)}</dd>
        </div>
        ${
          price !== null
            ? `<div>
          <dt>Price</dt>
          <dd>${escapeHtml(formatMoney(price))}</dd>
        </div>`
            : ""
        }
        ${
          quantity !== null
            ? `<div>
          <dt>Stock</dt>
          <dd>${escapeHtml(String(quantity))} units</dd>
        </div>`
            : ""
        }
        ${
          categoryName
            ? `<div>
          <dt>Category</dt>
          <dd>${escapeHtml(categoryName)}</dd>
        </div>`
            : ""
        }
      </dl>

      <div class="barcode-block">
        ${svg}
        <p class="barcode-value">${escapeHtml(value)}</p>
      </div>
    </div>

    <aside class="ticket-stub" aria-label="Label stub">
      <span class="stub-mark">SZ</span>
      <p class="stub-label">${escapeHtml(value)}</p>
      <p class="stub-note">Scan at POS</p>
    </aside>

    <footer class="footer">
      <span><strong>Scan at POS</strong> · Keep this label visible for stock and sales.</span>
      <button class="print-btn" type="button" onclick="window.print()">Print label</button>
    </footer>
  </article>
</body>
</html>`;

  const filename =
    value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 40) || "barcode";

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": `inline; filename="${filename}.html"`,
    },
  });
}
