// GET  /api/barcodes?productId=...  - List labels for one product (or all active labels when omitted).
// POST /api/barcodes                - Attach a pack/shelf label (manager/admin).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireManager, requireStaff } from "@/lib/auth/request";
import {
  badRequest,
  conflict,
  created,
  json,
  notFound,
  serverError,
  serviceUnavailable,
  validationError,
} from "@/lib/http";
import { isValidCode128, normalizeBarcode } from "@/lib/barcodes";
import {
  BarcodeError,
  createProductBarcode,
  listAllBarcodes,
  listProductBarcodes,
} from "@/services/barcode.service";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const productIdParam = searchParams.get("productId");

  try {
    if (!productIdParam) {
      const barcodes = await listAllBarcodes();
      return json({ barcodes });
    }

    let productId: bigint;
    try {
      productId = BigInt(productIdParam);
    } catch {
      return badRequest("productId must be a numeric product id.");
    }

    const barcodes = await listProductBarcodes(productId);
    return json({
      barcodes: barcodes.map((b) => ({
        id: b.id,
        barcode: b.barcode,
        barcodeType: b.barcodeType,
        unitId: b.unitId,
        quantityMultiplier: b.quantityMultiplier.toFixed(3),
        isPrimary: b.isPrimary,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error("List product barcodes failed:", error);
    return serverError("Unable to list barcodes.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("A JSON body is required.");
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("A JSON body is required.");
  }

  const input = body as Record<string, unknown>;
  const barcode = normalizeBarcode(
    typeof input.barcode === "string" ? input.barcode : "",
  );

  if (!isValidCode128(barcode)) {
    return validationError({
      barcode: ["Enter 1-80 printable ASCII characters (Code 128)."],
    });
  }

  let productId: bigint;
  try {
    productId = BigInt(
      typeof input.productId === "string" || typeof input.productId === "number"
        ? input.productId
        : "",
    );
  } catch {
    return validationError({
      productId: ["A numeric productId is required."],
    });
  }

  let quantityMultiplier: Prisma.Decimal;
  try {
    quantityMultiplier = new Prisma.Decimal(
      input.quantityMultiplier === undefined ? 1 : String(input.quantityMultiplier),
    );
  } catch {
    return validationError({
      quantityMultiplier: ["quantityMultiplier must be a number."],
    });
  }

  if (!quantityMultiplier.gt(0) || quantityMultiplier.gt(100_000)) {
    return validationError({
      quantityMultiplier: ["quantityMultiplier must be greater than 0."],
    });
  }

  if (!quantityMultiplier.isInteger()) {
    return validationError({
      quantityMultiplier: ["quantityMultiplier must be a whole number."],
    });
  }

  const barcodeType =
    typeof input.barcodeType === "string"
      ? input.barcodeType.trim().toLowerCase()
      : "code128";

  if (barcodeType !== "code128") {
    return validationError({
      barcodeType: ['Only "code128" labels are supported.'],
    });
  }

  const unitId = typeof input.unitId === "string" ? input.unitId.trim() : null;
  if (unitId && unitId.length > 50) {
    return validationError({
      unitId: ["unitId must be 50 characters or fewer."],
    });
  }

  try {
    const barcodeRecord = await createProductBarcode({
      productId,
      barcode,
      barcodeType,
      unitId,
      quantityMultiplier,
      isPrimary: input.isPrimary === true,
    });

    return created({
      id: barcodeRecord.id,
      barcode: barcodeRecord.barcode,
      barcodeType: barcodeRecord.barcodeType,
      unitId: barcodeRecord.unitId,
      quantityMultiplier: barcodeRecord.quantityMultiplier.toFixed(3),
      isPrimary: barcodeRecord.isPrimary,
      createdAt: barcodeRecord.createdAt,
    });
  } catch (error) {
    if (error instanceof BarcodeError) {
      if (error.code === "not_found") return notFound(error.message);
      if (error.code === "conflict") return conflict(error.message);
      if (error.code === "unavailable") return serviceUnavailable(error.message);
      return badRequest(error.message);
    }

    console.error("Create product barcode failed:", error);
    return serverError("Unable to create this barcode.");
  }
}
