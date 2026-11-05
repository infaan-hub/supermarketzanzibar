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
    .pass {
      width: min(760px, 100%);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: 0 24px 60px rgba(31, 58, 43, 0.10);
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .pass-left {
      padding: 28px 30px 26px;
      position: relative;
    }
    .pass-right {
      padding: 24px 26px 24px 18px;
      background: var(--accent-soft);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      position: relative;
    }
    .pass-right::before {
      content: "";
      position: absolute;
      left: -11px;
      top: 18px;
      bottom: 18px;
      width: 0;
      border-left: 2px dashed var(--border);
    }
    .notch {
      position: absolute;
      left: -11px;
      top: 50%;
      width: 22px;
      height: 22px;
      margin-top: -11px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f4faf6 0%, #ffffff 100%);
      border: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .brand-mark {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      background: var(--accent);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
    }
    .title {
      margin: 14px 0 2px;
      font-size: 24px;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.01em;
    }
    .subtitle {
      font-size: 13px;
      color: var(--muted);
    }
    .meta {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 20px;
    }
    .meta dt {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0;
    }
    .meta dd {
      margin: 2px 0 0;
      font-size: 14px;
      font-weight: 500;
    }
    .meta dd.mono {
      font-family: "DM Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
      letter-spacing: 0.04em;
    }
    .barcode-wrap {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .barcode-wrap svg {
      width: 100%;
      height: auto;
      max-width: 260px;
    }
    .value {
      font-family: "DM Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 12px;
      letter-spacing: 0.12em;
      color: var(--ink);
      text-align: center;
      word-break: break-all;
    }
    .footer {
      grid-column: 1 / -1;
      padding: 12px 30px;
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
      .pass { box-shadow: none; border: 1px solid #999; }
      .print-btn { display: none; }
      .footer { background: #fff; }
    }
    @media (max-width: 640px) {
      .pass { grid-template-columns: 1fr; }
      .pass-right { border-top: 1px dashed var(--border); }
      .pass-right::before { display: none; }
      .notch { display: none; }
      .meta { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <article class="pass" aria-label="Product label">
    <div class="pass-left">
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
    </div>

    <div class="pass-right">
      <div class="notch" aria-hidden="true"></div>
      <div class="barcode-wrap">${svg}</div>
      <p class="value">${escapeHtml(value)}</p>
    </div>

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
