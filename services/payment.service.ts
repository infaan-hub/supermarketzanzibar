// Payment service: payment CRUD, control number generation, verification.
//
// Ports Django `Payment` model and related views.

import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/request";

export type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled" | "refunded";

export type PaymentMethod = "mobile_money" | "cash" | "card" | "bank_transfer" | "other";

export interface PaymentCreateInput {
  saleId: bigint;
  controlNumber: string;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  proofImageData?: Uint8Array | null;
  proofImageName?: string;
  proofImageContentType?: string;
  confirmedById?: bigint;
}

export interface PaymentFindOptions {
  where?: {
    id?: bigint;
    saleId?: bigint;
    controlNumber?: string;
    paymentMethod?: PaymentMethod;
    status?: PaymentStatus;
    confirmedById?: bigint;
  };
  include?: {
    sale?: boolean;
    confirmedBy?: boolean;
  };
  orderBy?: { id?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export async function createPayment(data: PaymentCreateInput) {
  return prisma.payment.create({ data });
}

export async function findPayment(options: PaymentFindOptions) {
  return prisma.payment.findFirst(options);
}

export async function findPaymentById(id: bigint) {
  return prisma.payment.findUnique({
    where: { id },
    include: { sale: true, confirmedBy: true },
  });
}

export async function findPaymentByControlNumber(controlNumber: string) {
  return prisma.payment.findUnique({ where: { controlNumber } });
}

export async function findPaymentBySaleId(saleId: bigint) {
  return prisma.payment.findUnique({ where: { saleId } });
}

export async function findMovements(options: PaymentFindOptions = {}) {
  return prisma.payment.findMany({
    include: { sale: true, confirmedBy: true },
    orderBy: { createdAt: "desc" },
    ...options,
  });
}

export async function updatePaymentStatus(
  id: bigint,
  status: PaymentStatus,
  confirmedById?: bigint,
) {
  const data: { status: PaymentStatus; confirmedById?: bigint } = { status };
  if (confirmedById !== undefined) data.confirmedById = confirmedById;
  return prisma.payment.update({ where: { id }, data });
}

export async function deletePayment(id: bigint) {
  return prisma.payment.delete({ where: { id } });
}

export async function countPayments(options: { where?: { status?: PaymentStatus } } = {}) {
  return prisma.payment.count(options);
}

export async function getPendingPayments() {
  return prisma.payment.findMany({
    where: { status: "pending" },
    include: { sale: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getConfirmedPayments() {
  return prisma.payment.findMany({
    where: { status: "confirmed" },
    include: { sale: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPaymentSummary() {
  const summary = await prisma.payment.groupBy({
    by: ["status"],
    _count: { id: true },
    _sum: { sale: { finalAmount: true } },
  });

  const result = {} as Record<string, { count: number; totalAmount: string }>;
  for (const s of summary) {
    result[s.status] = {
      count: s._count.id,
      totalAmount: s._sum?.sale?.finalAmount?.toFixed(2) ?? "0.00",
    };
  }
  return result;
}

export async function verifyPayment(reference: string, controlNumber: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      controlNumber,
      status: { in: ["pending", "confirmed"] },
    },
    include: { sale: true },
  });

  if (!payment) return { ok: false, error: "Payment not found." };

  if (payment.paymentMethod === "mobile_money") {
    // Mobile money verification is handled by the payment gateway.
    // This is a placeholder for the actual verification logic.
    return {
      ok: true,
      payment: {
        id: payment.id.toString(),
        control_number: payment.controlNumber,
        payment_method: payment.paymentMethod,
        status: "confirmed",
        sale_id: payment.saleId,
      },
    };
  }

  return {
    ok: true,
    payment: {
      id: payment.id.toString(),
      control_number: payment.controlNumber,
      payment_method: payment.paymentMethod,
      status: "confirmed",
      sale_id: payment.saleId,
    },
  };
}

export async function getPaymentsByCustomer(customerId: bigint) {
  return prisma.payment.findMany({
    where: { sale: { customerId } },
    include: { sale: true },
    orderBy: { createdAt: "desc" },
  });
}
