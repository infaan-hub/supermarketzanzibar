// GET /api/barcodes/label?value=... - render a printable Code 128 label.
//
// Code 128 supports letters, digits and symbols, so this endpoint can print
// internal product/shelf/carton labels as well as supplier barcodes.

import { NextResponse } from "next/server";
import { isValidCode128, normalizeBarcode } from "@/lib/barcodes";
import { badRequest } from "@/lib/http";
import { code128Svg } from "@/lib/media";

function numberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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

  try {
    const svg = code128Svg(value, {
      scale: numberParam(searchParams.get("scale")),
      height: numberParam(searchParams.get("height")),
      textSize: numberParam(searchParams.get("textSize")),
      includeText: searchParams.get("text") !== "0",
    });

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
  } catch (error) {
    console.error("Barcode label generation failed:", error);
    return badRequest("Unable to generate this Code 128 label.");
  }
}
