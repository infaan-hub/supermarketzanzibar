// POST /api/payments - Process a payment for a sale.
//
// Handles cash, mobile money, and card payment methods.

import { json } from "@/lib/http";
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
      return json(
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

    return json(result);
  } catch (error) {
    console.error("Payment failed:", error);
    return json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return json(
    { detail: "POST /api/payments to process a payment." },
    { status: 405 },
  );
}
