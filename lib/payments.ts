// Payment library: payment processing for the API routes.

import { prisma } from "@/lib/db";
import { moneyString } from "@/lib/money";

export interface ProcessPaymentInput {
  saleId: bigint;
  amount: number;
  paymentMethod?: "cash" | "mobile_money" | "card";
  reference?: string;
}

export async function processPayment({
  saleId,
  amount,
  paymentMethod,
  reference,
}: ProcessPaymentInput) {
  // Generate a unique control number if one is not provided.
  const controlNumber =
    reference ??
    `ZN${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`;

  const payment = await prisma.payment.upsert({
    where: { saleId },
    update: {
      paymentMethod: paymentMethod ?? "cash",
      status: "confirmed",
    },
    create: {
      saleId,
      controlNumber,
      paymentMethod: paymentMethod ?? "cash",
      status: "confirmed",
    },
  });

  return {
    id: payment.id.toString(),
    control_number: payment.controlNumber,
    payment_method: payment.paymentMethod,
    status: payment.status,
    sale_id: payment.saleId.toString(),
    amount: moneyString(amount),
  };
}