// GET  /api/purchase-orders — List purchase orders with supplier & line items.
// POST /api/purchase-orders — Create a supplier purchase order (manager/admin).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireInventory, requireManager } from "@/lib/auth/request";
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
import {
  DEFAULT_STORE_CODE,
  isMissingTwinTables,
} from "@/services/digital-twin.service";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";

export const dynamic = "force-dynamic";

const createPoSchema = z.object({
  supplierId: z.string().trim().regex(/^\d+$/, "Select a supplier."),
  expectedDate: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().regex(/^\d+$/, "Invalid product."),
        orderedQuantity: z.coerce.number().int().min(1).max(500_000),
        unitCost: z.coerce.number().min(0).max(100_000_000),
      }),
    )
    .min(1, "Add at least one product line."),
});

export async function GET(request: NextRequest) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: status ? { status } : undefined,
      include: {
        supplier: { select: { id: true, companyName: true } },
        createdBy: { select: { fullName: true, username: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true } },
          },
        },
        goodsReceipts: {
          select: { id: true, receiptNumber: true, receivedAt: true },
          orderBy: { receivedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return json({
      purchaseOrders: orders.map((po) => ({
        id: po.id,
        orderNumber: po.orderNumber,
        status: po.status,
        supplierId: po.supplierId.toString(),
        supplierName: po.supplier.companyName,
        totalAmount: Number(po.totalAmount),
        expectedDate: po.expectedDate,
        notes: po.notes,
        createdBy:
          po.createdBy?.fullName || po.createdBy?.username || "System",
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
        receiptsCount: po.goodsReceipts.length,
        items: po.items.map((item) => ({
          id: item.id,
          productId: item.productId.toString(),
          productName: item.product.name,
          barcode: item.product.barcode,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          remainingQuantity: Math.max(
            0,
            item.orderedQuantity - item.receivedQuantity,
          ),
          unitCost: Number(item.unitCost),
          lineTotal: Number(item.lineTotal),
        })),
      })),
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return json({ purchaseOrders: [], migrationRequired: true });
    }
    console.error("List purchase orders failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("A valid JSON body is required.");
  }

  const parsed = createPoSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  let expectedDate: Date | null = null;
  if (parsed.data.expectedDate) {
    const d = new Date(parsed.data.expectedDate);
    if (Number.isNaN(d.getTime())) {
      return validationError({ expectedDate: ["Enter a valid date."] });
    }
    expectedDate = d;
  }

  try {
    await ensureDigitalTwinSchema();
    const supplierId = BigInt(parsed.data.supplierId);
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, companyName: true },
    });
    if (!supplier) return notFound("Supplier not found.");

    const productIds = parsed.data.items.map((i) => BigInt(i.productId));
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const validIds = new Set(existingProducts.map((p) => p.id.toString()));
    for (const item of parsed.data.items) {
      if (!validIds.has(item.productId)) {
        return notFound(`Product ${item.productId} not found.`);
      }
    }

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

    const lines = parsed.data.items.map((item) => {
      const unitCost = new Prisma.Decimal(item.unitCost.toFixed(2));
      const lineTotal = unitCost.times(item.orderedQuantity);
      return {
        productId: BigInt(item.productId),
        orderedQuantity: item.orderedQuantity,
        unitCost,
        lineTotal,
      };
    });

    const totalAmount = lines.reduce(
      (sum, line) => sum.plus(line.lineTotal),
      new Prisma.Decimal(0),
    );

    const now = new Date();
    const orderNumber = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        storeId: store.id,
        supplierId: supplier.id,
        createdById: guard.user.id,
        status: "ordered",
        totalAmount,
        expectedDate,
        notes: parsed.data.notes ?? "",
        items: { create: lines },
      },
      include: {
        supplier: { select: { companyName: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "PURCHASE_ORDER_CREATED",
      entityType: "PURCHASE_ORDER",
      entityId: po.id,
      summary: `Created ${po.orderNumber} for ${supplier.companyName} (${lines.length} line(s), total ${Number(totalAmount)}).`,
    });

    return created({
      purchaseOrder: {
        id: po.id,
        orderNumber: po.orderNumber,
        status: po.status,
        supplierName: po.supplier.companyName,
        totalAmount: Number(po.totalAmount),
        createdAt: po.createdAt,
      },
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable("Run `npx prisma migrate deploy` first.");
    }
    console.error("Create purchase order failed:", error);
    return serverError("Unable to create purchase order.");
  }
}
