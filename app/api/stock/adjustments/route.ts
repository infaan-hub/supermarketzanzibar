// POST /api/stock/adjustments — Transactional stock counts, damaged/lost
// write-offs, and shelf/warehouse stock adjustments (Phase 8).
// Never allows negative inventory.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireInventory } from "@/lib/auth/request";
import {
  badRequest,
  conflict,
  json,
  notFound,
  serverError,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import { syncTwinDeductionInTx } from "@/services/digital-twin.service";

const adjustmentSchema = z.object({
  productId: z.string().trim().regex(/^\d+$/, "Select a valid product."),
  reason: z.enum(["DAMAGED", "LOST", "EXPIRED", "COUNT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
  quantity: z.coerce.number().int().min(0).max(500_000),
  notes: z.string().trim().max(400).optional(),
});

class AdjustmentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdjustmentConflictError";
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("A valid JSON body is required.");
  }

  const parsed = adjustmentSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const { productId: pidStr, reason, quantity, notes } = parsed.data;
  const productId = BigInt(pidStr);

  if (reason !== "COUNT" && quantity <= 0) {
    return validationError({
      quantity: ["Quantity must be at least 1 for this adjustment type."],
    });
  }

  try {
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, quantity: true },
    });
    if (!existing) return notFound("Product not found.");

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { id: true, name: true, quantity: true },
      });

      let delta = 0;
      let movementType = "ADJUSTMENT";

      if (reason === "COUNT") {
        delta = quantity - current.quantity;
        movementType = "COUNT";
      } else if (reason === "ADJUSTMENT_IN") {
        delta = quantity;
        movementType = "IN";
      } else {
        delta = -quantity;
        movementType = reason === "ADJUSTMENT_OUT" ? "OUT" : reason;
      }

      if (delta < 0) {
        const dec = Math.abs(delta);
        const updated = await tx.product.updateMany({
          where: { id: productId, quantity: { gte: dec } },
          data: { quantity: { decrement: dec } },
        });
        if (updated.count === 0) {
          throw new AdjustmentConflictError(
            `Cannot reduce "${current.name}" by ${dec}. Current stock is ${current.quantity}.`,
          );
        }
        await syncTwinDeductionInTx(tx, productId, dec);
      } else if (delta > 0) {
        await tx.product.update({
          where: { id: productId },
          data: { quantity: { increment: delta } },
        });
      }

      const finalProduct = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { id: true, name: true, quantity: true },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          quantity: Math.abs(delta),
          movementType,
          performedById: guard.user.id,
          reference: reason,
          notes:
            notes ||
            (reason === "COUNT"
              ? `Physical stock count set to ${quantity} (delta ${delta >= 0 ? "+" : ""}${delta})`
              : `${reason} stock adjustment`),
        },
      });

      return { finalProduct, movement, delta, movementType };
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: `STOCK_${reason}`,
      entityType: "PRODUCT",
      entityId: productId.toString(),
      summary: `${reason} adjustment on ${result.finalProduct.name}: delta ${result.delta >= 0 ? "+" : ""}${result.delta}, new stock ${result.finalProduct.quantity}.`,
    });

    publishInventoryEvent({
      type: "stock_adjusted",
      productId: productId.toString(),
      delta: result.delta,
      summary: `${reason}: ${result.finalProduct.name} (${result.delta >= 0 ? "+" : ""}${result.delta})`,
    });

    return json({
      product: {
        id: result.finalProduct.id.toString(),
        name: result.finalProduct.name,
        quantity: result.finalProduct.quantity,
      },
      movementId: result.movement.id.toString(),
      delta: result.delta,
      reason,
    });
  } catch (error) {
    if (error instanceof AdjustmentConflictError) {
      return conflict(error.message);
    }
    console.error("Stock adjustment failed:", error);
    return serverError("Unable to complete stock adjustment.");
  }
}
