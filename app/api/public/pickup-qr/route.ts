// GET /api/public/pickup-qr?code=SZPICK1:... — Render a scannable Express POS
// Pickup QR code SVG for a customer's 3D-picked shopping basket.

import { NextResponse } from "next/server";
import { badRequest } from "@/lib/http";
import { qrCodeSvg } from "@/lib/media";
import { decodePickupCode, isPickupCode } from "@/lib/storefront/pickup-code";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim();

  if (!isPickupCode(code) || decodePickupCode(code).length === 0) {
    return badRequest("A valid pickup basket code (SZPICK1:...) is required.");
  }

  try {
    const svg = qrCodeSvg(code, 5);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    console.error("Pickup QR generation failed:", error);
    return badRequest("Unable to generate pickup QR code.");
  }
}
