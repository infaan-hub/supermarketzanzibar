// Media helpers: convert stored bytes into data URLs and generate the
// Code128 payment barcode that the original serializer produced.

import bwipjs from "bwip-js/node";

// Reproduce the original `binary_file_data_url` behavior: a base64 data URL.
export function binaryDataUrl(payload: Uint8Array | null | undefined, contentType: string | null): string | null {
  if (!payload || payload.length === 0) return null;
  const base64 = Buffer.from(payload).toString("base64");
  const mime = contentType || "application/octet-stream";
  return `data:${mime};base64,${base64}`;
}

// Reproduce the original ticket id derivation from the control number.
export function paymentTicketId(controlNumber: string | null | undefined): string {
  const control = (controlNumber || "").trim();
  const digits = control.replace(/\D/g, "");
  if (digits) return digits;
  return control || "000000000001";
}

// Generate a Code128 barcode as an inline SVG data URL. Returns null on error.
export function barcodeDataUrl(value: string | null | undefined): string | null {
  const text = paymentTicketId(value);
  try {
    const svg = bwipjs.toSVG({
      bcid: "code128",
      text,
      height: 6, // ~28px at 96dpi approximating original barHeight=28
      includetext: false,
      scale: 3,
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}
