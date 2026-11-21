// GET   /api/sales/[id] - Full sale detail with items, customer snapshot & payment.
// PATCH /api/sales/[id] - Update sale status (manager/admin). Cancelling a sale
//                         transactionally restocks items and logs IN movements.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound, serverError } from "@/lib/http";
import { requireManager, requireStaff } from "@/lib/auth/request";

function parseSaleId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

async function loadSaleDetail(saleId: bigint) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: { include: { user: true } },
      items: {
        include: { product: { select: { id: true, name: true, barcode: true } } },
        orderBy: { id: "asc" },
      },
      payment: {
        include: { confirmedBy: { select: { fullName: true, username: true } } },
      },
    },
  });

  if (!sale) return null;

  const customerFullName =
    sale.customerFullName.trim() ||
    sale.customer?.user.fullName.trim() ||
    "Walk-in Customer";

  return {
    id: sale.id.toString(),
    status: sale.status,
    paymentMethod: sale.payment?.paymentMethod ?? sale.paymentMethod,
    paymentConfirmed: sale.paymentConfirmed,
    subtotal: Number(sale.totalAmount),
    taxAmount: Number(sale.tax),
    discount: Number(sale.discount),
    grandTotal: Number(sale.finalAmount),
    customerId: sale.customerId ? sale.customerId.toString() : null,
    customerFullName,
    customerEmail: sale.customerEmail || sale.customer?.user.email || "",
    customerPhone: sale.customerPhone || sale.customer?.user.phone || "",
    customerAddress: sale.customerAddress || sale.customer?.user.address || "",
    deliveryLocation: sale.deliveryLocation,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    payment: sale.payment
      ? {
          id: sale.payment.id.toString(),
          controlNumber: sale.payment.controlNumber,
          paymentMethod: sale.payment.paymentMethod,
          status: sale.payment.status,
          confirmedBy:
            sale.payment.confirmedBy?.fullName ||
            sale.payment.confirmedBy?.username ||
            null,
          createdAt: sale.payment.createdAt,
        }
      : null,
    items: sale.items.map((item) => ({
      id: item.id.toString(),
      productId: item.productId.toString(),
      productName: item.product.name,
      barcode: item.product.barcode,
      price: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.total),
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const saleId = parseSaleId(id);
  if (!saleId) return badRequest("Invalid sale ID.");

  try {
    const detail = await loadSaleDetail(saleId);
    if (!detail) return notFound("Sale not found.");
    return json(detail);
  } catch (error) {
    console.error("Get sale detail failed:", error);
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
  const saleId = parseSaleId(id);
  if (!saleId) return badRequest("Invalid sale ID.");

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const nextStatus = typeof body.status === "string" ? body.status.trim() : "";
  const allowedStatuses = new Set([
    "completed",
    "pending_payment",
    "processing",
    "cancelled",
  ]);
  if (!allowedStatuses.has(nextStatus)) {
    return badRequest("Invalid status value.");
  }

  try {
    const existing = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, payment: true },
    });
    if (!existing) return notFound("Sale not found.");

    const shouldRestock =
      nextStatus === "cancelled" && existing.status !== "cancelled";

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: nextStatus,
          ...(nextStatus === "cancelled" ? { paymentConfirmed: false } : {}),
        },
      });

      if (shouldRestock) {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              saleItemId: item.id,
              quantity: item.quantity,
              movementType: "IN",
            },
          });
        }

        if (existing.payment) {
          await tx.payment.update({
            where: { id: existing.payment.id },
            data: { status: "refunded" },
          });
        }
      }
    });

    const detail = await loadSaleDetail(saleId);
    return json(detail);
  } catch (error) {
    console.error("Update sale failed:", error);
    return serverError("Unable to update sale.");
  }
}
