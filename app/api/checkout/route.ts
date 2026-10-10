// POST /api/checkout - Create a new sale/checkout.
//
// Creates an order, processes payment, generates receipt, and sends email.

import { NextResponse } from "next/server";
import { createSale, listItems } from "@/lib/sales";
import { processPayment } from "@/lib/payments";
import { generateReceipt } from "@/lib/receipt";
import { sendOrderEmail } from "@/lib/mail";
import { isEmailValid, text as cleanText } from "@/lib/validation";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const items = (body.items ?? []) as {
      productId: string;
      quantity: number;
      price: number;
    }[];

    if (!items || items.length === 0) {
      return NextResponse.json(
        { detail: "At least one item is required." },
        { status: 400 },
      );
    }

    if (!isEmailValid(body.customerEmail)) {
      return NextResponse.json(
        { detail: "A valid customer email is required." },
        { status: 400 },
      );
    }

    const customerEmail = cleanText(body.customerEmail);
    const customerFullName = cleanText(body.customerFullName);
    const paymentMethod = body.paymentMethod
      ? (body.paymentMethod as "cash" | "mobile_money" | "card")
      : "mobile_money";

    // Start transaction: lock rows, deduct stock, create sale, process payment
    const prisma = await import("@/lib/db").then((m) => m.prisma);

    const sale = await prisma.$transaction(async (tx) => {
      // 1. Lock product rows and verify stock
      const products = await tx.product.findMany({
        where: {
          id: { in: items.map((i) => BigInt(i.productId)) },
        },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          price: true,
          barcode: true,
        },
      });

      for (const item of items) {
        const product = products.find((p) => p.id === BigInt(item.productId));
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        if (product.stockQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, requested: ${item.quantity}`,
          );
        }
      }

      // 2. Deduct stock
      for (const item of items) {
        await tx.product.update({
          where: { id: BigInt(item.productId) },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // 3. Create sale
      const now = new Date().toISOString();
      const sale = await tx.sale.create({
        data: {
          customerFullName,
          customerEmail,
          paymentMethod,
          createdAt: now,
          updatedAt: now,
          status: "completed",
          subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
          taxAmount: items.reduce(
            (sum, i) => sum + i.price * i.quantity * 0.15,
            0,
          ),
          grandTotal: items.reduce(
            (sum, i) => sum + i.price * i.quantity * 1.15,
            0,
          ),
          items: {
            create: items.map((i) => ({
              productId: BigInt(i.productId),
              productName: "",
              price: i.price,
              quantity: i.quantity,
              lineTotal: i.price * i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // 4. Process payment
      const payment = await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: sale.grandTotal,
          paymentMethod,
          status: "completed",
          referenceNumber: `ZN${new Date().getFullYear().toString().slice(2)}${
            String(new Date().getMonth() + 1).padStart(2, "0")
          }${String(new Date().getDate()).padStart(2, "0")}${Math.floor(
            Math.random() * 100000000,
          )
            .toString()
            .padStart(8, "0")}`,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        ...sale,
        payment,
      };
    });

    // Generate receipt
    const receipt = generateReceipt({
      saleId: sale.id.toString(),
      customerFullName,
      customerEmail,
      items: sale.items.map((i) => ({
        productId: i.productId.toString(),
        productName: i.productName,
        price: i.price,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      subtotal: sale.subtotal,
      taxAmount: sale.taxAmount,
      grandTotal: sale.grandTotal,
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus,
      createdAt: sale.createdAt,
    });

    // Send email
    await sendOrderEmail(customerEmail, "Order Receipt", receipt);

    return NextResponse.json({
      sale: {
        id: sale.id.toString(),
        customerFullName,
        customerEmail,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        grandTotal: sale.grandTotal,
        paymentStatus: sale.paymentStatus,
        createdAt: sale.createdAt,
      },
      receipt,
    });
  } catch (error) {
    console.error("Checkout failed:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
