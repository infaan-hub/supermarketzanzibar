// GET  /api/goods-received — List goods receipt records.
// POST /api/goods-received — Receive supplier stock (optionally linked to a PO)
//                            into a warehouse rack position with batch & expiry
//                            tracking inside a single atomic transaction (Phase 8).

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
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import {
  DEFAULT_STORE_CODE,
  isMissingTwinTables,
} from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

const receiveSchema = z.object({
  purchaseOrderId: z.string().trim().optional().nullable(),
  warehouseLocationId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().regex(/^\d+$/, "Invalid product."),
        quantity: z.coerce.number().int().min(1).max(500_000),
        batchNumber: z.string().trim().max(80).optional(),
        expiryDate: z.string().trim().optional(),
      }),
    )
    .min(1, "Add at least one received item."),
});

export async function GET(request: NextRequest) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  try {
    const receipts = await prisma.goodsReceipt.findMany({
      include: {
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            supplier: { select: { companyName: true } },
          },
        },
        receivedBy: { select: { fullName: true, username: true } },
        warehouseLocation: {
          select: {
            id: true,
            zoneCode: true,
            rackCode: true,
            levelCode: true,
            positionCode: true,
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });

    return json({
      receipts: receipts.map((r) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        purchaseOrderId: r.purchaseOrderId,
        orderNumber: r.purchaseOrder?.orderNumber ?? null,
        supplierName: r.purchaseOrder?.supplier.companyName ?? "Direct Delivery",
        receivedBy:
          r.receivedBy?.fullName || r.receivedBy?.username || "Staff",
        warehouseLocation: r.warehouseLocation
          ? `${r.warehouseLocation.rackCode}/${r.warehouseLocation.levelCode}/${r.warehouseLocation.positionCode}`
          : null,
        notes: r.notes,
        receivedAt: r.receivedAt,
      })),
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return json({ receipts: [], migrationRequired: true });
    }
    console.error("List goods receipts failed:", error);
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

  const parsed = receiveSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
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

    let whLocationId: string | null = parsed.data.warehouseLocationId || null;
    if (whLocationId) {
      const loc = await prisma.warehouseLocation.findUnique({
        where: { id: whLocationId },
        select: { id: true },
      });
      if (!loc) return notFound("Selected warehouse location was not found.");
    } else {
      const fallbackLoc = await prisma.warehouseLocation.findFirst({
        where: { storeId: store.id },
        orderBy: [{ rackCode: "asc" }, { levelCode: "asc" }],
        select: { id: true },
      });
      whLocationId = fallbackLoc?.id ?? null;
    }

    const poId = parsed.data.purchaseOrderId || null;
    if (poId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        select: { id: true, status: true },
      });
      if (!po) return notFound("Purchase order not found.");
      if (po.status === "cancelled") {
        return badRequest("Cannot receive goods against a cancelled purchase order.");
      }
    }

    const now = new Date();
    const receiptNumber = `GRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const result = await prisma.$transaction(async (tx) => {
      const totalUnits = parsed.data.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNumber,
          storeId: store.id,
          purchaseOrderId: poId,
          receivedById: guard.user.id,
          warehouseLocationId: whLocationId,
          totalUnits,
          notes: parsed.data.notes ?? "",
          receivedAt: now,
        },
      });

      for (const item of parsed.data.items) {
        const productId = BigInt(item.productId);
        const prod = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, name: true },
        });
        if (!prod) {
          throw new Error(`Product ${item.productId} not found.`);
        }

        // 1. Increment master Product.quantity.
        await tx.product.update({
          where: { id: productId },
          data: { quantity: { increment: item.quantity } },
        });

        // 2. Increment warehouse Inventory record if a rack location exists.
        if (whLocationId) {
          await tx.inventory.upsert({
            where: {
              productId_storeId_warehouseLocationId: {
                productId,
                storeId: store.id,
                warehouseLocationId: whLocationId,
              },
            },
            update: { quantityOnHand: { increment: item.quantity } },
            create: {
              productId,
              storeId: store.id,
              warehouseLocationId: whLocationId,
              quantityOnHand: item.quantity,
              reorderLevel: LOW_STOCK_THRESHOLD,
            },
          });
        }

        // 3. Create InventoryBatch record for traceability & expiry tracking.
        let expiryDate: Date | null = null;
        if (item.expiryDate) {
          const dt = new Date(item.expiryDate);
          if (!Number.isNaN(dt.getTime())) expiryDate = dt;
        }
        await tx.inventoryBatch.create({
          data: {
            productId,
            storeId: store.id,
            warehouseLocationId: whLocationId,
            batchNumber:
              item.batchNumber?.trim() ||
              `${receiptNumber}-${productId.toString()}`,
            quantity: item.quantity,
            expiryDate,
            receivedAt: now,
            status:
              expiryDate && expiryDate.getTime() < now.getTime()
                ? "expired"
                : "active",
          },
        });

        // 4. Record StockMovement ledger row.
        await tx.stockMovement.create({
          data: {
            productId,
            quantity: item.quantity,
            movementType: "IN",
            destinationLocationId: whLocationId ?? undefined,
            performedById: guard.user.id,
            reference: receiptNumber,
            notes: parsed.data.notes ?? "Goods received note",
          },
        });

        // 5. Update matching PurchaseOrderItem receivedQuantity if PO linked.
        if (poId) {
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: { purchaseOrderId: poId, productId },
          });
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { receivedQuantity: { increment: item.quantity } },
            });
          }
        }
      }

      // 6. Refresh PO status to partially_received or received.
      if (poId) {
        const allItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: poId },
        });
        const allComplete =
          allItems.length > 0 &&
          allItems.every((i) => i.receivedQuantity >= i.orderedQuantity);
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: { status: allComplete ? "received" : "partially_received" },
        });
      }

      return { receipt, totalUnits };
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "GOODS_RECEIVED",
      entityType: "GOODS_RECEIPT",
      entityId: result.receipt.id,
      summary: `Recorded ${receiptNumber} (${result.totalUnits} unit(s) received).`,
    });

    publishInventoryEvent({
      type: "goods_received",
      warehouseLocationId: whLocationId ?? undefined,
      delta: result.totalUnits,
      summary: `Goods received (${receiptNumber}): +${result.totalUnits} unit(s)`,
    });

    return created({
      receipt: {
        id: result.receipt.id,
        receiptNumber: result.receipt.receiptNumber,
        totalUnits: result.totalUnits,
        receivedAt: result.receipt.receivedAt,
      },
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable("Run `npx prisma migrate deploy` first.");
    }
    console.error("Goods receipt failed:", error);
    return serverError(
      error instanceof Error ? error.message : "Unable to record goods receipt.",
    );
  }
}
