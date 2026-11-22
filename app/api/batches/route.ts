// GET  /api/batches — List product inventory batches with expiry classification.
// POST /api/batches — Record a batch or mark an existing batch expired/damaged.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireInventory } from "@/lib/auth/request";
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
import {
  DEFAULT_STORE_CODE,
  isMissingTwinTables,
} from "@/services/digital-twin.service";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";

export const dynamic = "force-dynamic";

const batchSchema = z.object({
  productId: z.string().trim().regex(/^\d+$/, "Select a valid product."),
  batchNumber: z.string().trim().min(2).max(80),
  quantity: z.coerce.number().int().min(1).max(500_000),
  expiryDate: z.string().trim().optional().nullable(),
  warehouseLocationId: z.string().trim().optional().nullable(),
  status: z.enum(["active", "expired", "quarantined"]).optional().default("active"),
});

export async function GET(request: NextRequest) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter")?.trim(); // all | expiring | expired

  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const batches = await prisma.inventoryBatch.findMany({
      where:
        filter === "expired"
          ? {
              quantity: { gt: 0 },
              OR: [{ status: "expired" }, { expiryDate: { lt: now } }],
            }
          : filter === "expiring"
            ? {
                quantity: { gt: 0 },
                expiryDate: { gte: now, lte: soon },
              }
            : undefined,
      include: {
        product: { select: { id: true, name: true, barcode: true } },
        warehouseLocation: {
          select: { rackCode: true, levelCode: true, positionCode: true },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { receivedAt: "desc" }],
      take: 200,
    });

    return json({
      batches: batches.map((b) => {
        const isExpired =
          b.status === "expired" ||
          (b.expiryDate !== null && b.expiryDate.getTime() < now.getTime());
        const isExpiringSoon =
          !isExpired &&
          b.expiryDate !== null &&
          b.expiryDate.getTime() <= soon.getTime();
        return {
          id: b.id,
          productId: b.productId.toString(),
          productName: b.product.name,
          barcode: b.product.barcode,
          batchNumber: b.batchNumber,
          quantity: b.quantity,
          expiryDate: b.expiryDate,
          receivedDate: b.receivedAt,
          status: isExpired ? "expired" : b.status,
          isExpired,
          isExpiringSoon,
          warehouseLocation: b.warehouseLocation
            ? `${b.warehouseLocation.rackCode}/${b.warehouseLocation.levelCode}/${b.warehouseLocation.positionCode}`
            : null,
        };
      }),
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return json({ batches: [], migrationRequired: true });
    }
    console.error("List batches failed:", error);
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

  const parsed = batchSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    await ensureDigitalTwinSchema();
    const productId = BigInt(parsed.data.productId);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) return notFound("Product not found.");

    let store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
    if (!store) {
      store = await prisma.store.create({
        data: {
          code: DEFAULT_STORE_CODE,
          name: "Supermarket Zanzibar — Flagship",
          address: "Stone Town Main Road, Zanzibar",
          location: "Zanzibar, Tanzania",
          status: "active",
        },
      });
    }

    let expiryDate: Date | null = null;
    if (parsed.data.expiryDate) {
      const dt = new Date(parsed.data.expiryDate);
      if (Number.isNaN(dt.getTime())) {
        return validationError({ expiryDate: ["Invalid expiry date."] });
      }
      expiryDate = dt;
    }

    const batch = await prisma.inventoryBatch.create({
      data: {
        productId,
        storeId: store.id,
        warehouseLocationId: parsed.data.warehouseLocationId || null,
        batchNumber: parsed.data.batchNumber,
        quantity: parsed.data.quantity,
        expiryDate,
        status: parsed.data.status,
      },
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "BATCH_RECORDED",
      entityType: "INVENTORY_BATCH",
      entityId: batch.id,
      summary: `Recorded batch ${batch.batchNumber} for ${product.name} (${batch.quantity} units).`,
    });

    publishInventoryEvent({
      type: "stock_adjusted",
      productId: product.id.toString(),
      summary: `Batch ${batch.batchNumber} updated for ${product.name}`,
    });

    return created({ batch });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable("Run `npx prisma migrate deploy` first.");
    }
    console.error("Create batch failed:", error);
    return serverError("Unable to record inventory batch.");
  }
}
