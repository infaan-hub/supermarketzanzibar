// POST /api/checkout - Create a POS sale, deduct stock, record payment & receipt.
//
// Always re-prices items from PostgreSQL so client totals can never tamper
// with charges. Supports walk-in cash customers (email is optional) as well as
// linked Customer accounts (awarding loyalty points automatically).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { badRequest, json, serverError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/request";
import { generateReceipt } from "@/lib/receipt";
import { sendOrderEmail } from "@/lib/mail";
import { isEmailValid, text as cleanText } from "@/lib/validation";

const VALID_METHODS = new Set(["cash", "mobile_money", "card", "bank_transfer"]);

interface CheckoutItem {
  productId: string;
  quantity: number;
  price?: number;
}

class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      return badRequest("A JSON body is required.");
    }

    const items = (body.items ?? []) as CheckoutItem[];
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest("At least one item is required.");
    }

    const customerEmail = cleanText(body.customerEmail) ?? "";
    if (customerEmail && !isEmailValid(customerEmail)) {
      return badRequest("Enter a valid customer email address or leave it blank.");
    }

    const customerFullName = cleanText(body.customerFullName) ?? "Walk-in Customer";
    const customerPhone = cleanText(body.customerPhone) ?? "";
    const customerAddress = cleanText(body.customerAddress) ?? "";
    const rawMethod =
      typeof body.paymentMethod === "string"
        ? body.paymentMethod.trim().toLowerCase()
        : "cash";
    const paymentMethod = VALID_METHODS.has(rawMethod) ? rawMethod : "cash";

    const rawTaxRate =
      body.taxRatePercent !== undefined ? Number(body.taxRatePercent) : 15;
    if (!Number.isFinite(rawTaxRate) || rawTaxRate < 0 || rawTaxRate > 50) {
      return badRequest("taxRatePercent must be between 0 and 50.");
    }
    const taxRateDecimal = new Prisma.Decimal(rawTaxRate).div(100);

    const rawDiscount =
      body.discount !== undefined && body.discount !== ""
        ? Number(body.discount)
        : 0;
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0) {
      return badRequest("Discount must be 0 or greater.");
    }
    const requestedDiscount = new Prisma.Decimal(rawDiscount.toFixed(2));

    let customerId: bigint | null = null;
    if (body.customerId && /^\d+$/.test(String(body.customerId))) {
      customerId = BigInt(String(body.customerId));
    }

    const sale = await prisma.$transaction(async (tx) => {
      const requestedQuantities = new Map<string, number>();

      for (const item of items) {
        if (!item?.productId || !/^\d+$/.test(String(item.productId))) {
          throw new CheckoutError("Invalid product ID in cart.", 400);
        }
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new CheckoutError(
            `Invalid quantity for product ${item.productId}.`,
            400,
          );
        }
        const pid = String(item.productId);
        requestedQuantities.set(
          pid,
          (requestedQuantities.get(pid) ?? 0) + quantity,
        );
      }

      const uniqueIds = Array.from(requestedQuantities.keys()).map((id) =>
        BigInt(id),
      );
      const products = await tx.product.findMany({
        where: { id: { in: uniqueIds }, isActive: true },
        select: { id: true, name: true, quantity: true, price: true },
      });

      const lines: Array<{
        productId: bigint;
        productName: string;
        quantity: number;
        price: Prisma.Decimal;
        total: Prisma.Decimal;
      }> = [];

      for (const item of items) {
        const pid = BigInt(item.productId);
        const product = products.find((p) => p.id === pid);
        if (!product) {
          throw new CheckoutError(`Product not found: ${item.productId}`, 404);
        }

        const totalRequested =
          requestedQuantities.get(String(item.productId)) ?? Number(item.quantity);
        if (product.quantity < totalRequested) {
          throw new CheckoutError(
            `Insufficient stock for "${product.name}". Available: ${product.quantity}, requested: ${totalRequested}.`,
            409,
          );
        }

        const quantity = Number(item.quantity);
        const price = new Prisma.Decimal(product.price);
        lines.push({
          productId: product.id,
          productName: product.name,
          quantity,
          price,
          total: price.times(quantity),
        });
      }

      // Deduct stock atomically per product before recording the sale.
      for (const [pidStr, qty] of requestedQuantities.entries()) {
        const pid = BigInt(pidStr);
        const product = products.find((p) => p.id === pid)!;
        const updated = await tx.product.updateMany({
          where: { id: pid, isActive: true, quantity: { gte: qty } },
          data: { quantity: { decrement: qty } },
        });
        if (updated.count === 0) {
          throw new CheckoutError(
            `Insufficient stock for "${product.name}". Please rescan the item.`,
            409,
          );
        }
      }

      const totalAmount = lines.reduce(
        (sum, l) => sum.plus(l.total),
        new Prisma.Decimal(0),
      );
      const effectiveDiscount = requestedDiscount.gt(totalAmount)
        ? totalAmount
        : requestedDiscount;
      const taxableSubtotal = totalAmount.minus(effectiveDiscount);
      const taxAmount = taxableSubtotal.times(taxRateDecimal);
      const finalAmount = taxableSubtotal.plus(taxAmount);

      // Verify optional customer FK if passed.
      let validCustomerId: bigint | null = null;
      if (customerId !== null) {
        const customerRow = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true },
        });
        if (customerRow) {
          validCustomerId = customerRow.id;
        }
      }

      const createdSale = await tx.sale.create({
        data: {
          customerId: validCustomerId,
          userId: guard.user.id,
          totalAmount,
          tax: taxAmount,
          discount: effectiveDiscount,
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
        include: { items: true },
      });

      // Record stock OUT movements linked to each SaleItem.
      for (const itemRow of createdSale.items) {
        await tx.stockMovement.create({
          data: {
            productId: itemRow.productId,
            saleItemId: itemRow.id,
            quantity: itemRow.quantity,
            movementType: "OUT",
          },
        });
      }

      // Award loyalty points (1 pt per 1,000 TZS) for linked customer accounts.
      if (validCustomerId !== null) {
        const earnedPoints = Math.floor(Number(finalAmount) / 1000);
        if (earnedPoints > 0) {
          await tx.customer.update({
            where: { id: validCustomerId },
            data: { loyaltyPoints: { increment: earnedPoints } },
          });
        }
      }

      const now = new Date();
      const controlNumber = `ZN${now.getFullYear().toString().slice(2)}${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${Math.floor(
        Math.random() * 100000000,
      )
        .toString()
        .padStart(8, "0")}`;

      const payment = await tx.payment.create({
        data: {
          saleId: createdSale.id,
          controlNumber,
          paymentMethod,
          status: "confirmed",
          confirmedById: guard.user.id,
        },
      });

      return { ...createdSale, payment, lines };
    });

    const subtotal = Number(sale.totalAmount);
    const discount = Number(sale.discount);
    const taxAmount = Number(sale.tax);
    const grandTotal = Number(sale.finalAmount);

    const receipt = generateReceipt({
      saleId: sale.id.toString(),
      controlNumber: sale.payment.controlNumber,
      customerFullName,
      customerEmail,
      items: sale.items.map((i) => {
        const line = sale.lines.find((l) => l.productId === i.productId);
        return {
          productId: i.productId.toString(),
          productName: line?.productName ?? "",
          price: Number(i.price),
          quantity: i.quantity,
          lineTotal: Number(i.total),
        };
      }),
      subtotal,
      discount,
      taxAmount,
      taxRatePercent: rawTaxRate,
      grandTotal,
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.payment.status,
      createdAt: sale.createdAt,
    });

    if (customerEmail) {
      await sendOrderEmail(
        customerEmail,
        `Receipt #${sale.id.toString()} — Supermarket Zanzibar`,
        receipt,
      );
    }

    return json({
      sale: {
        id: sale.id.toString(),
        customerFullName,
        customerEmail,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        subtotal,
        discount,
        taxAmount,
        grandTotal,
        paymentStatus: sale.payment.status,
        controlNumber: sale.payment.controlNumber,
        createdAt: sale.createdAt,
      },
      receipt,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return json({ detail: error.message }, { status: error.status });
    }
    console.error("Checkout failed:", error);
    return serverError(
      error instanceof Error ? error.message : "An unexpected error occurred.",
    );
  }
}
