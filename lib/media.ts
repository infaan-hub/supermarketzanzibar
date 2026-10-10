// Media helpers: convert stored bytes into data URLs and generate the
// Code128 payment barcode that the original serializer produced.

import bwipjs from "bwip-js";

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

// Generate a Code128 barcode as a base64 PNG data URL (SVG fallback handled
// internally by bwip-js when a raw buffer is requested). Returns null on error.
export function barcodeDataUrl(value: string | null | undefined): string | null {
  const text = paymentTicketId(value);
  try {
    const png = bwipjs.toBuffer({
      bcid: "code128",
      text,
      barheight: 6, // ~28px at 96dpi approximating original barHeight=28
      includetext: false,
      scale: 3,
    });
    return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  } catch {
    return null;
  }
}
