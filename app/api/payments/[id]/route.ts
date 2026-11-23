// PATCH /api/payments/[id] - Confirm or update a payment's reconciliation status (marketmaster/manager/admin).

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound, serverError } from "@/lib/http";
import { requirePos } from "@/lib/auth/request";

const ALLOWED_STATUSES = new Set(["confirmed", "pending", "failed", "refunded"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePos(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!/^\d+$/.test(id)) return badRequest("Invalid payment ID.");
  const paymentId = BigInt(id);

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const nextStatus = typeof body.status === "string" ? body.status.trim() : "";
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    return badRequest("status must be confirmed, pending, failed, or refunded.");
  }

  try {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { sale: true },
    });
    if (!existing) return notFound("Payment not found.");

    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: nextStatus,
          ...(nextStatus === "confirmed"
            ? { confirmedById: guard.user.id }
            : {}),
        },
        include: {
          sale: true,
          confirmedBy: { select: { fullName: true, username: true } },
        },
      });

      await tx.sale.update({
        where: { id: existing.saleId },
        data: {
          paymentConfirmed: nextStatus === "confirmed",
          ...(nextStatus === "confirmed" &&
          existing.sale.status === "pending_payment"
            ? { status: "completed" }
            : {}),
        },
      });

      return payment;
    });

    return json({
      id: updated.id.toString(),
      saleId: updated.saleId.toString(),
      controlNumber: updated.controlNumber,
      amount: Number(updated.sale.finalAmount),
      paymentMethod: updated.paymentMethod,
      status: updated.status,
      confirmedBy:
        updated.confirmedBy?.fullName || updated.confirmedBy?.username || null,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Update payment failed:", error);
    return serverError("Unable to update payment.");
  }
}
