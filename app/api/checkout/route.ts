// POST /api/checkout - Create a new sale/checkout.
//
// Creates an order, processes payment, generates receipt, and sends email.

import { json } from "@/lib/http";
import { generateReceipt } from "@/lib/receipt";
import { sendOrderEmail } from "@/lib/mail";
import { isEmailValid, text as cleanText } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

const TAX_RATE = new Prisma.Decimal("0.15");

interface CheckoutItem {
  productId: string;
  quantity: number;
  price: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const items = (body.items ?? []) as CheckoutItem[];

    if (!Array.isArray(items) || items.length === 0) {
      return json(
        { detail: "At least one item is required." },
        { status: 400 },
      );
    }

    if (!isEmailValid(body.customerEmail)) {
      return json(
        { detail: "A valid customer email is required." },
        { status: 400 },
      );
    }

    const customerEmail = cleanText(body.customerEmail) ?? "";
    const customerFullName = cleanText(body.customerFullName) ?? "";
    const customerPhone = cleanText(body.customerPhone) ?? "";
    const customerAddress = cleanText(body.customerAddress) ?? "";
    const paymentMethod = body.paymentMethod
      ? (body.paymentMethod as "cash" | "mobile_money" | "card")
      : "mobile_money";

    const sale = await prisma.$transaction(async (tx) => {
      // 1. Load products and verify stock. Quantities are summed per product
      // because the same product can appear as an "each" and a pack line.
      const requestedQuantities = new Map<string, number>();

      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error(`Invalid quantity for product ${item.productId}.`);
        }
        requestedQuantities.set(
          item.productId,
          (requestedQuantities.get(item.productId) ?? 0) + quantity,
        );
      }

      const products = await tx.product.findMany({
        where: {
          id: { in: items.map((i) => BigInt(i.productId)) },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          quantity: true,
          price: true,
        },
      });

      const lines: {
        productId: bigint;
        productName: string;
        quantity: number;
        price: Prisma.Decimal;
        total: Prisma.Decimal;
      }[] = [];

      for (const item of items) {
        const product = products.find((p) => p.id === BigInt(item.productId));
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const requestedQuantity =
          requestedQuantities.get(item.productId) ?? Number(item.quantity);

        if (product.quantity < requestedQuantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.quantity}, requested: ${requestedQuantity}`,
          );
        }

        const quantity = Number(item.quantity);
        // Always price from the database. The client-supplied price is only a
        // display hint and must never decide what the customer is charged.
        const price = new Prisma.Decimal(product.price);
        lines.push({
          productId: product.id,
          productName: product.name,
          quantity,
          price,
          total: price.times(quantity),
        });
      }

      // 2. Deduct stock and record the movements. The conditional update makes
      // concurrent checkouts safe: a line only succeeds if stock is still there.
      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: {
            id: line.productId,
            isActive: true,
            quantity: { gte: line.quantity },
          },
          data: { quantity: { decrement: line.quantity } },
        });

        if (updated.count === 0) {
          throw new Error(
            `Insufficient stock for "${line.productName}". Please rescan the item.`,
          );
        }

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            quantity: line.quantity,
            movementType: "OUT",
          },
        });
      }

      const totalAmount = lines.reduce(
        (sum, l) => sum.plus(l.total),
        new Prisma.Decimal(0),
      );
      const taxAmount = totalAmount.times(TAX_RATE);
      const finalAmount = totalAmount.plus(taxAmount);

      // 3. Create the sale and its items.
      const created = await tx.sale.create({
        data: {
          totalAmount,
          tax: taxAmount,
          discount: new Prisma.Decimal(0),
          finalAmount,
          paymentMethod,
          paymentConfirmed: true,
          termsAccepted: true,
          customerFullName,
          customerEmail,
          customerPhone,
          customerAddress,
          status: "completed",
          date: new Date(),
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              price: l.price,
              total: l.total,
            })),
          },
        },
        include: { items: true, payment: true },
      });

      // 4. Process the payment.
      const controlNumber = `ZN${new Date().getFullYear().toString().slice(2)}${String(
        new Date().getMonth() + 1,
      ).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${Math.floor(
        Math.random() * 100000000,
      )
        .toString()
        .padStart(8, "0")}`;

      const payment = await tx.payment.create({
        data: {
          saleId: created.id,
          controlNumber,
          paymentMethod,
          status: "confirmed",
        },
      });

      return { ...created, payment, lines };
    });

    const subtotal = Number(sale.totalAmount);
    const taxAmount = Number(sale.tax);
    const grandTotal = Number(sale.finalAmount);

    // Generate receipt.
    const receipt = generateReceipt({
      saleId: sale.id.toString(),
      customerFullName,
      customerEmail,
      items: sale.items.map((i) => {
        const line = sale.lines.find(
          (l: { productId: bigint }) => l.productId === i.productId,
        );
        return {
          productId: i.productId.toString(),
          productName: line?.productName ?? "",
          price: Number(i.price),
          quantity: i.quantity,
          lineTotal: Number(i.total),
        };
      }),
      subtotal,
      taxAmount,
      grandTotal,
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.payment.status,
      createdAt: sale.createdAt,
    });

    // Send email.
    await sendOrderEmail(customerEmail, "Order Receipt", receipt);

    return json({
      sale: {
        id: sale.id.toString(),
        customerFullName,
        customerEmail,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        subtotal,
        taxAmount,
        grandTotal,
        paymentStatus: sale.payment.status,
        controlNumber: sale.payment.controlNumber,
        createdAt: sale.createdAt,
      },
      receipt,
    });
  } catch (error) {
    console.error("Checkout failed:", error);
    return json(
      { detail: error instanceof Error ? error.message : "An unexpected error occurred." },
      { status: 500 },
    );
  }
}