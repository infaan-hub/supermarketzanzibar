// POST /api/payments - Process a payment for a sale.
//
// Handles cash, mobile money, and card payment methods.

import { NextResponse } from "next/server";
import { processPayment } from "@/lib/payments";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { saleId, amount, paymentMethod, reference } = body as {
      saleId: string;
      amount: number;
      paymentMethod?: "cash" | "mobile_money" | "card";
      reference?: string;
    };

    if (!saleId || amount == null) {
      return NextResponse.json(
        { detail: "saleId and amount are required." },
        { status: 400 },
      );
    }

    const result = await processPayment({
      saleId: BigInt(saleId),
      amount,
      paymentMethod: paymentMethod ?? "cash",
      reference,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Payment failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { detail: "POST /api/payments to process a payment." },
    { status: 405 },
  );
}
