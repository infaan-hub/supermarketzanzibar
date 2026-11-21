// GET  /api/warehouse — Warehouse zones, racks, storage locations & live stock.
// POST /api/warehouse — Receive or allocate stock directly into a warehouse rack
//                       cell with optional expiry batch tracking (Phases 8 & 10).

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireExplorer, requireInventory } from "@/lib/auth/request";
import {
  badRequest,
  created,
  json,
  notFound,
  serverError,
  serviceUnavailable,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { isMissingTwinTables } from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

const allocateSchema = z.object({
  productId: z.string().trim().regex(/^\d+$/, "Select a valid product."),
  warehouseLocationId: z
    .string()
    .trim()
    .min(1, "Select a warehouse rack location."),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity must be at least 1.")
    .max(500_000),
  batchNumber: z.string().trim().max(80).optional(),
  expiryDate: z.string().trim().optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const zone = searchParams.get("zone")?.trim();
  const rack = searchParams.get("rack")?.trim();

  try {
    const locations = await prisma.warehouseLocation.findMany({
      where: {
        ...(zone ? { zoneCode: zone } : {}),
        ...(rack ? { rackCode: rack } : {}),
      },
      include: {
        inventoryRecords: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                price: true,
                quantity: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { zoneCode: "asc" },
        { rackCode: "asc" },
        { levelCode: "asc" },
        { positionCode: "asc" },
      ],
    });

    const zonesMap = new Map<
      string,
      { zoneCode: string; rackCount: Set<string>; totalUnits: number; capacity: number }
    >();

    const rows = locations.map((loc) => {
      const units = loc.inventoryRecords.reduce(
        (sum, i) => sum + i.quantityOnHand,
        0,
      );
      const entry = zonesMap.get(loc.zoneCode) ?? {
        zoneCode: loc.zoneCode,
        rackCount: new Set<string>(),
        totalUnits: 0,
        capacity: 0,
      };
      entry.rackCount.add(loc.rackCode);
      entry.totalUnits += units;
      entry.capacity += loc.capacity;
      zonesMap.set(loc.zoneCode, entry);

      return {
        id: loc.id,
        warehouseCode: loc.warehouseCode,
        zoneCode: loc.zoneCode,
        rackCode: loc.rackCode,
        levelCode: loc.levelCode,
        positionCode: loc.positionCode,
        locationType: loc.locationType,
        capacity: loc.capacity,
        status: loc.status,
        totalUnits: units,
        items: loc.inventoryRecords
          .filter((i) => i.quantityOnHand > 0 || i.reservedQuantity > 0)
          .map((i) => ({
            inventoryId: i.id,
            productId: i.productId.toString(),
            productName: i.product.name,
            sku: i.product.sku,
            barcode: i.product.barcode,
            categoryName: i.product.category?.name ?? null,
            quantityOnHand: i.quantityOnHand,
            reservedQuantity: i.reservedQuantity,
            reorderLevel: i.reorderLevel,
            totalProductStock: i.product.quantity,
          })),
      };
    });

    return json({
      zones: Array.from(zonesMap.values()).map((z) => ({
        zoneCode: z.zoneCode,
        racksCount: z.rackCount.size,
        totalUnits: z.totalUnits,
        capacity: z.capacity,
      })),
      locations: rows,
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return json({ zones: [], locations: [], migrationRequired: true });
    }
    console.error("Load warehouse failed:", error);
    return serverError();
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

  const parsed = allocateSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const { productId: pidStr, warehouseLocationId, quantity, batchNumber, expiryDate, notes } =
    parsed.data;

  let parsedExpiry: Date | null = null;
  if (expiryDate) {
    const dt = new Date(expiryDate);
    if (Number.isNaN(dt.getTime())) {
      return validationError({ expiryDate: ["Enter a valid expiry date."] });
    }
    parsedExpiry = dt;
  }

  try {
    const productId = BigInt(pidStr);
    const [product, location] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.warehouseLocation.findUnique({ where: { id: warehouseLocationId } }),
    ]);

    if (!product) return notFound("Product not found.");
    if (!location) return notFound("Warehouse location not found.");

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { quantity: { increment: quantity } },
      });

      const inv = await tx.inventory.upsert({
        where: {
          productId_storeId_warehouseLocationId: {
            productId,
            storeId: location.storeId,
            warehouseLocationId: location.id,
          },
        },
        update: { quantityOnHand: { increment: quantity } },
        create: {
          productId,
          storeId: location.storeId,
          warehouseLocationId: location.id,
          quantityOnHand: quantity,
          reorderLevel: LOW_STOCK_THRESHOLD,
        },
      });

      if (batchNumber || parsedExpiry) {
        await tx.inventoryBatch.create({
          data: {
            productId,
            storeId: location.storeId,
            warehouseLocationId: location.id,
            batchNumber:
              batchNumber?.trim() ||
              `BATCH-${Date.now().toString(36).toUpperCase()}`,
            quantity,
            expiryDate: parsedExpiry,
            status: "active",
          },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          quantity,
          movementType: "IN",
          destinationLocationId: location.id,
          performedById: guard.user.id,
          reference: `${location.rackCode}/${location.levelCode}/${location.positionCode}`,
          notes: notes ?? "Direct warehouse stock intake",
        },
      });

      return { updatedProduct, inv, movement };
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "WAREHOUSE_STOCK_IN",
      entityType: "WAREHOUSE_LOCATION",
      entityId: location.id,
      summary: `Received +${quantity}× ${product.name} into ${location.rackCode}/${location.levelCode}/${location.positionCode}.`,
    });

    publishInventoryEvent({
      type: "goods_received",
      productId: product.id.toString(),
      warehouseLocationId: location.id,
      delta: quantity,
      summary: `Received +${quantity} ${product.name} into ${location.rackCode}`,
    });

    return created({
      inventoryId: result.inv.id,
      productId: product.id.toString(),
      newProductStock: result.updatedProduct.quantity,
      newWarehouseQuantity: result.inv.quantityOnHand,
      movementId: result.movement.id.toString(),
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable("Run `npx prisma migrate deploy` first.");
    }
    console.error("Warehouse intake failed:", error);
    return serverError("Unable to store stock in warehouse.");
  }
}
