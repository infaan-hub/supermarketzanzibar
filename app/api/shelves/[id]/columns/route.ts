// POST /api/shelves/[id]/columns — Add a new 4-row vertical product column to
// an existing retail shelf. When an existing column's 4 rows are full, staff can
// add a new column for the SAME product (overflow) or an empty column — never
// mixing different products in the same column.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireInventory } from "@/lib/auth/request";
import {
  badRequest,
  created,
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

const MAX_COLUMNS_PER_SHELF = 12;

const addColumnSchema = z.object({
  productId: z.string().trim().nullable().optional(),
  sourcePositionId: z.string().trim().optional(),
  maximumCapacity: z.coerce.number().int().min(4).max(200).optional().default(24),
  reorderLevel: z.coerce.number().int().min(0).max(100).optional().default(6),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  const { id: shelfId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }

  const parsed = addColumnSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const shelf = await prisma.shelf.findUnique({
      where: { id: shelfId },
      include: {
        positions: {
          orderBy: { slotIndex: "asc" },
          select: { id: true, slotIndex: true, positionCode: true, productId: true },
        },
      },
    });
    if (!shelf) return notFound("Shelf not found.");

    if (shelf.positions.length >= MAX_COLUMNS_PER_SHELF) {
      return badRequest(
        `Shelf ${shelf.shelfCode} already has the maximum ${MAX_COLUMNS_PER_SHELF} columns.`,
      );
    }

    // Resolve optional product assignment (either from sourcePositionId or explicit productId)
    let resolvedProductId: bigint | null = null;
    let productMeta: {
      id: bigint;
      name: string;
      barcode: string;
      categoryName: string | null;
    } | null = null;

    if (parsed.data.sourcePositionId) {
      const source = shelf.positions.find(
        (p) => p.id === parsed.data.sourcePositionId,
      );
      if (!source) {
        return notFound("Source shelf column was not found on this shelf.");
      }
      if (!source.productId) {
        return badRequest(
          "Source column has no product assigned. Assign a product first.",
        );
      }
      resolvedProductId = source.productId;
    } else if (parsed.data.productId && /^\d+$/.test(parsed.data.productId)) {
      resolvedProductId = BigInt(parsed.data.productId);
    } else if (parsed.data.productId) {
      return badRequest("Invalid productId.");
    }

    if (resolvedProductId !== null) {
      const prod = await prisma.product.findUnique({
        where: { id: resolvedProductId },
        select: {
          id: true,
          name: true,
          barcode: true,
          category: { select: { name: true } },
        },
      });
      if (!prod) return notFound("Selected product was not found.");
      productMeta = {
        id: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        categoryName: prod.category?.name ?? null,
      };
    }

    const nextSlotIndex =
      shelf.positions.length > 0
        ? Math.max(...shelf.positions.map((p) => p.slotIndex)) + 1
        : 0;
    const existingCodes = new Set(shelf.positions.map((p) => p.positionCode));
    let codeNum = nextSlotIndex + 1;
    let positionCode = `COL_${String(codeNum).padStart(2, "0")}`;
    while (existingCodes.has(positionCode)) {
      codeNum += 1;
      positionCode = `COL_${String(codeNum).padStart(2, "0")}`;
    }

    const newTotalColumns = shelf.positions.length + 1;

    const createdPosition = await prisma.$transaction(async (tx) => {
      const pos = await tx.shelfPosition.create({
        data: {
          shelfId: shelf.id,
          productId: resolvedProductId,
          positionCode,
          slotIndex: nextSlotIndex,
          quantity: 0,
          maximumCapacity: parsed.data.maximumCapacity,
          reorderLevel: parsed.data.reorderLevel,
        },
      });

      await tx.shelf.update({
        where: { id: shelf.id },
        data: { capacity: { increment: parsed.data.maximumCapacity } },
      });

      if (productMeta) {
        const assetEntry = resolveProductAsset(
          productMeta.name,
          productMeta.categoryName,
        );
        const asset = await tx.threeDAsset.findUnique({
          where: { assetKey: assetEntry.key },
          select: { id: true },
        });
        const fixture = findFixtureByCode(shelf.shelfCode);
        const coords = fixture
          ? shelfSlotWorldPosition(fixture, nextSlotIndex, newTotalColumns)
          : ([0, 1, 0] as [number, number, number]);

        await tx.threeDObjectMapping.upsert({
          where: { objectName: `${shelf.shelfCode}_${positionCode}` },
          update: {
            linkedEntityType: "PRODUCT",
            linkedEntityId: productMeta.id.toString(),
            assetId: asset?.id ?? null,
            posX: coords[0],
            posY: coords[1],
            posZ: coords[2],
          },
          create: {
            objectName: `${shelf.shelfCode}_${positionCode}`,
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
      action: "SHELF_COLUMN_ADDED",
      entityType: "SHELF_POSITION",
      entityId: createdPosition.id,
      summary: productMeta
        ? `Added 4-row column ${shelf.shelfCode}/${positionCode} for ${productMeta.name} (no product mixing).`
        : `Added empty 4-row column ${shelf.shelfCode}/${positionCode}.`,
    });

    publishInventoryEvent({
      type: "shelf_updated",
      shelfId: shelf.id,
      shelfCode: shelf.shelfCode,
      positionId: createdPosition.id,
      productId: productMeta?.id.toString(),
      quantity: 0,
      summary: productMeta
        ? `Added column ${positionCode} for ${productMeta.name} on ${shelf.shelfCode}`
        : `Added empty column ${positionCode} on ${shelf.shelfCode}`,
    });

    return created({
      column: {
        id: createdPosition.id,
        shelfId: shelf.id,
        shelfCode: shelf.shelfCode,
        positionCode: createdPosition.positionCode,
        slotIndex: createdPosition.slotIndex,
        quantity: createdPosition.quantity,
        maximumCapacity: createdPosition.maximumCapacity,
        reorderLevel: createdPosition.reorderLevel,
        product: productMeta
          ? {
              id: productMeta.id.toString(),
              name: productMeta.name,
              barcode: productMeta.barcode,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Add shelf column failed:", error);
    return serverError("Unable to add shelf column.");
  }
}
