// GET   /api/purchase-orders/[id] — Single PO detail.
// PATCH /api/purchase-orders/[id] — Update PO status (draft/ordered/cancelled).

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireInventory, requireManager } from "@/lib/auth/request";
import {
  badRequest,
  json,
  notFound,
  serverError,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";

const patchPoSchema = z.object({
  status: z.enum(["draft", "ordered", "partially_received", "received", "cancelled"]),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireInventory(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, companyName: true } },
        items: { include: { product: { select: { id: true, name: true, barcode: true } } } },
        goodsReceipts: { orderBy: { receivedAt: "desc" } },
      },
    });
    if (!po) return notFound("Purchase order not found.");

    return json({
      id: po.id,
      orderNumber: po.orderNumber,
      status: po.status,
      supplierId: po.supplierId.toString(),
      supplierName: po.supplier.companyName,
      totalAmount: Number(po.totalAmount),
      expectedDate: po.expectedDate,
      notes: po.notes,
      createdAt: po.createdAt,
      items: po.items.map((item) => ({
        id: item.id,
        productId: item.productId.toString(),
        productName: item.product.name,
        barcode: item.product.barcode,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        unitCost: Number(item.unitCost),
        lineTotal: Number(item.lineTotal),
      })),
      receipts: po.goodsReceipts,
    });
  } catch (error) {
    console.error("Get purchase order failed:", error);
    return serverError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("A valid JSON body is required.");
  }

  const parsed = patchPoSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) return notFound("Purchase order not found.");

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: parsed.data,
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "PURCHASE_ORDER_UPDATED",
      entityType: "PURCHASE_ORDER",
      entityId: updated.id,
      summary: `Updated ${updated.orderNumber} status to ${updated.status}.`,
    });

    return json({
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
      notes: updated.notes,
    });
  } catch (error) {
    console.error("Update purchase order failed:", error);
    return serverError();
  }
}
