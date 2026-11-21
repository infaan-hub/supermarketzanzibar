// POST /api/digital-twin/transfer — Atomic Warehouse -> Shelf restock transfer
// (Phases 8, 10 & 13). Emits post-commit SSE so 3D shelves animate the restock.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireInventory } from "@/lib/auth/request";
import { badRequest, json, serverError, validationError } from "@/lib/http";
import {
  DigitalTwinError,
  transferWarehouseToShelf,
} from "@/services/digital-twin.service";

const transferSchema = z.object({
  shelfPositionId: z.string().trim().min(1, "Select a target shelf position."),
  warehouseLocationId: z.string().trim().optional(),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Transfer at least 1 unit.")
    .max(10_000, "Maximum 10,000 units per transfer."),
  notes: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("A valid JSON body is required.");
  }

  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const result = await transferWarehouseToShelf({
      ...parsed.data,
      actorId: guard.user.id,
    });
    return json(result, 201);
  } catch (error) {
    if (error instanceof DigitalTwinError) {
      return json({ detail: error.message }, error.status);
    }
    console.error("Warehouse-to-shelf transfer failed:", error);
    return serverError("Unable to complete transfer.");
  }
}
