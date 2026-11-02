// GET  /api/barcodes/lookup?barcode=...  - resolve a scanned barcode.
// POST /api/barcodes/lookup { barcode }  - same, for scanner clients that POST.
//
// Returns the product, packaging unit, current price and branch stock so the
// POS can add the correct line to the cart.

import { badRequest, json, notFound, serverError } from "@/lib/http";
import { isValidCode128, normalizeBarcode } from "@/lib/barcodes";
import { resolveBarcode } from "@/services/barcode.service";

async function lookup(rawBarcode: string | null | undefined) {
  const barcode = normalizeBarcode(rawBarcode);

  if (!barcode) {
    return badRequest("A barcode is required.");
  }

  if (!isValidCode128(barcode)) {
    return badRequest(
      "Barcode must be 1-80 printable ASCII characters (Code 128).",
    );
  }

  try {
    const result = await resolveBarcode(barcode);

    if (!result) {
      return notFound(`No product matches barcode "${barcode}".`);
    }

    if (!result.product.isActive) {
      return notFound(`Product "${result.product.name}" is not active.`);
    }

    return json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Barcode lookup failed:", error);
    return serverError("Barcode lookup failed.");
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return lookup(searchParams.get("barcode") ?? searchParams.get("code"));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("A JSON body with a barcode is required.");
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as { barcode?: unknown; code?: unknown })
      : {};

  const raw =
    typeof payload.barcode === "string"
      ? payload.barcode
      : typeof payload.code === "string"
        ? payload.code
        : null;

  return lookup(raw);
}
