// PATCH /api/shelves/positions/[id] — Assign/unassign product, update slot
// capacity / reorder threshold, and synchronize persistent 3D mapping.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireInventory } from "@/lib/auth/request";
import {
  badRequest,
  json,
  notFound,
  serverError,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import { resolveProductAsset } from "@/lib/digital-twin/asset-manifest";
import {
  findFixtureByCode,
  shelfSlotWorldPosition,
} from "@/lib/digital-twin/spatial-plan";

const patchPositionSchema = z.object({
  productId: z.string().trim().nullable().optional(),
  maximumCapacity: z.coerce.number().int().min(1).max(1000).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(500).optional(),
  reservedQuantity: z.coerce.number().int().min(0).max(1000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("A valid JSON body is required.");
  }

  const parsed = patchPositionSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const existing = await prisma.shelfPosition.findUnique({
      where: { id },
      include: { shelf: true },
    });
    if (!existing) return notFound("Shelf position not found.");

    let nextProductId: bigint | null | undefined = undefined;
    let productMeta: { id: bigint; name: string; categoryName: string | null } | null =
      null;

    if (parsed.data.productId !== undefined) {
      if (parsed.data.productId === null || parsed.data.productId === "") {
        nextProductId = null;
      } else if (/^\d+$/.test(parsed.data.productId)) {
        const prod = await prisma.product.findUnique({
          where: { id: BigInt(parsed.data.productId) },
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
          },
        });
        if (!prod) return notFound("Selected product was not found.");
        nextProductId = prod.id;
        productMeta = {
          id: prod.id,
          name: prod.name,
          categoryName: prod.category?.name ?? null,
        };
      } else {
        return badRequest("Invalid productId.");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const pos = await tx.shelfPosition.update({
        where: { id },
        data: {
          ...(nextProductId !== undefined ? { productId: nextProductId } : {}),
          ...(nextProductId === null ? { quantity: 0 } : {}),
          ...(parsed.data.maximumCapacity !== undefined
            ? { maximumCapacity: parsed.data.maximumCapacity }
            : {}),
          ...(parsed.data.reorderLevel !== undefined
            ? { reorderLevel: parsed.data.reorderLevel }
            : {}),
          ...(parsed.data.reservedQuantity !== undefined
            ? { reservedQuantity: parsed.data.reservedQuantity }
            : {}),
        },
        include: {
          shelf: true,
          product: { select: { id: true, name: true, barcode: true } },
        },
      });

      const objName = `${pos.shelf.shelfCode}_${pos.positionCode}`;
      if (productMeta) {
        const assetEntry = resolveProductAsset(
          productMeta.name,
          productMeta.categoryName,
        );
        const asset = await tx.threeDAsset.findUnique({
          where: { assetKey: assetEntry.key },
          select: { id: true },
        });
        const fixture = findFixtureByCode(pos.shelf.shelfCode);
        const coords = fixture
          ? shelfSlotWorldPosition(fixture, pos.slotIndex)
          : ([0, 1, 0] as [number, number, number]);

        await tx.threeDObjectMapping.upsert({
          where: { objectName: objName },
          update: {
            linkedEntityType: "PRODUCT",
            linkedEntityId: productMeta.id.toString(),
            assetId: asset?.id ?? null,
            posX: coords[0],
            posY: coords[1],
            posZ: coords[2],
          },
          create: {
            objectName: objName,
            objectType: "PRODUCT_POSITION",
            linkedEntityType: "PRODUCT",
            linkedEntityId: productMeta.id.toString(),
            assetId: asset?.id ?? null,
            posX: coords[0],
            posY: coords[1],
            posZ: coords[2],
          },
        });
      }

      return pos;
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "SHELF_POSITION_UPDATED",
      entityType: "SHELF_POSITION",
      entityId: updated.id,
      summary: `Updated ${updated.shelf.shelfCode}/${updated.positionCode} (${updated.product?.name ?? "empty slot"}).`,
    });

    publishInventoryEvent({
      type: "shelf_updated",
      shelfId: updated.shelfId,
      shelfCode: updated.shelf.shelfCode,
      positionId: updated.id,
      productId: updated.productId?.toString(),
      quantity: updated.quantity,
      updates: updated.productId
        ? [
            {
              productId: updated.productId.toString(),
              shelfCode: updated.shelf.shelfCode,
              positionId: updated.id,
              quantity: updated.quantity,
            },
          ]
        : undefined,
      summary: `Updated shelf position ${updated.shelf.shelfCode}/${updated.positionCode}`,
    });

    return json({
      position: {
        id: updated.id,
        shelfCode: updated.shelf.shelfCode,
        positionCode: updated.positionCode,
        quantity: updated.quantity,
        maximumCapacity: updated.maximumCapacity,
        reorderLevel: updated.reorderLevel,
        reservedQuantity: updated.reservedQuantity,
        product: updated.product
          ? {
              id: updated.product.id.toString(),
              name: updated.product.name,
              barcode: updated.product.barcode,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Update shelf position failed:", error);
    return serverError("Unable to update shelf position.");
  }
}
