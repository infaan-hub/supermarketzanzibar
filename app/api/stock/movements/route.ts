// POST /api/stock/movements - Receive (IN) or issue (OUT) stock by barcode.
//
// The stock page uses this endpoint for scanning. A scanned pack label applies
// its quantity multiplier, the product's quantity is updated atomically, and a
// StockMovement row records the change for the audit trail.

import { badRequest, conflict, json, notFound, serverError, validationError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { isValidCode128, normalizeBarcode } from "@/lib/barcodes";
import { resolveBarcode } from "@/services/barcode.service";

type MovementType = "IN" | "OUT";

class StockAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockAdjustmentError";
  }
}

export async function POST(request: Request) {
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
      barcode: [
        "Scan or enter 1-80 printable ASCII characters (Code 128 or a retail barcode).",
      ],
    });
  }

  const rawMovementType = input.movementType;
  if (rawMovementType !== "IN" && rawMovementType !== "OUT") {
    return validationError({
      movementType: ['movementType must be "IN" or "OUT".'],
    });
  }
  const movementType = rawMovementType as MovementType;

  const rawQuantity = input.quantity ?? 1;
  if (typeof rawQuantity !== "number" && typeof rawQuantity !== "string") {
    return validationError({
      quantity: ["Quantity must be a whole number of packages."],
    });
  }

  const packages = Number(rawQuantity);
  if (!Number.isInteger(packages) || packages <= 0 || packages > 100_000) {
    return validationError({
      quantity: ["Quantity must be a whole number from 1 to 100,000."],
    });
  }

  try {
    const resolved = await resolveBarcode(barcode);
    if (!resolved) {
      return notFound(`No product matches barcode "${barcode}".`);
    }

    const productId = BigInt(resolved.product.id);
    const multiplier = resolved.packaging.quantityMultiplier;
    const units = packages * multiplier;

    if (!Number.isInteger(units) || units <= 0 || units > 2_000_000) {
      return validationError({
        quantity: [
          "The scanned package does not convert to a whole number of base units.",
        ],
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let product;

      if (movementType === "OUT") {
        const updated = await tx.product.updateMany({
          where: { id: productId, quantity: { gte: units } },
          data: { quantity: { decrement: units } },
        });

        if (updated.count === 0) {
          const current = await tx.product.findUnique({
            where: { id: productId },
            select: { quantity: true, name: true },
          });
          throw new StockAdjustmentError(
            `Not enough stock for "${current?.name ?? resolved.product.name}". Available: ${current?.quantity ?? 0} base units, requested: ${units}.`,
          );
        }

        product = await tx.product.findUniqueOrThrow({
          where: { id: productId },
        });
      } else {
        product = await tx.product.update({
          where: { id: productId },
          data: { quantity: { increment: units } },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          quantity: units,
          movementType,
        },
      });

      return { movement, product };
    });

    return json({
      movement: {
        id: result.movement.id.toString(),
        productId: result.movement.productId.toString(),
        quantity: result.movement.quantity,
        movementType: result.movement.movementType,
        date: result.movement.date,
      },
      product: {
        id: result.product.id.toString(),
        name: result.product.name,
        barcode: result.product.barcode,
        quantity: result.product.quantity,
        unitId: resolved.packaging.unitId,
        quantityMultiplier: multiplier,
      },
      packages,
      units,
    });
  } catch (error) {
    if (error instanceof StockAdjustmentError) {
      return conflict(error.message);
    }

    console.error("Stock movement failed:", error);
    return serverError("Unable to adjust stock for this barcode.");
  }
}
