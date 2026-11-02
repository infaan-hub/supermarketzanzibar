// Media helpers: convert stored bytes into data URLs and generate the
// Code128 payment barcode that the original serializer produced.

import bwipjs from "bwip-js/node";
import { isValidCode128 } from "@/lib/barcodes";

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

export interface Code128SvgOptions {
  /** Bar module width multiplier (1-10). */
  scale?: number;
  /** Bar height in millimetres (4-40). */
  height?: number;
  /** Print the human-readable value under the bars. */
  includeText?: boolean;
  /** Human-readable text size in points. */
  textSize?: number;
}

/**
 * Generate a Code 128 SVG for product/shelf labels. Unlike payment barcodes,
 * the raw value is encoded: Code 128 supports letters, digits and symbols.
 */
export function code128Svg(value: string, options: Code128SvgOptions = {}): string {
  const text = (value ?? "").trim();
  if (!isValidCode128(text)) {
    throw new Error(
      `Code 128 labels require 1-80 printable ASCII characters (received ${text.length}).`,
    );
  }

  const scale = Math.min(Math.max(Math.floor(options.scale ?? 3), 1), 10);
  const height = Math.min(Math.max(options.height ?? 12, 4), 40);
  const textSize = Math.min(Math.max(options.textSize ?? 8, 4), 24);

  return bwipjs.toSVG({
    bcid: "code128",
    text,
    scale,
    height,
    includetext: options.includeText ?? true,
    textxalign: "center",
    textsize: textSize,
    paddingwidth: 2,
    paddingheight: 2,
  });
}

/** Inline data URL for embedding a Code 128 label in HTML/print views. */
export function code128DataUrl(
  value: string,
  options: Code128SvgOptions = {},
): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(code128Svg(value, options))}`;
}
