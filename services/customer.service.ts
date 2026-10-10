
// Customer service: checkout, order history, receipt support.
//
// Ports Django `CheckoutView`, `CustomerOrdersView`,
// `CustomerOrderHistoryItemView`, `CustomerReceiptView`,
// `build_whatsapp_order_url`, and the sole-driver auto-assignment helpers.
// Money uses exact Prisma Decimal arithmetic; stock writes happen inside one
// transaction with row locks, mirroring `@transaction.atomic` +
// `select_for_update()`.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeSale } from "@/lib/serializers";
import { sendOrderEmail } from "@/lib/mail";
import type { CurrentUser } from "@/lib/auth/request";

export const STORE_NAME = "Supermarket Zanzibar";
export const WHATSAPP_ORDER_NUMBER = "255711252758";

export interface CheckoutItemInput {
  productId: bigint;
  quantity: number;
}

export interface CheckoutInput {
  items: CheckoutItemInput[];
  paymentMethod: string;
  customerFullName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  deliveryLocation?: string;
  termsAccepted: boolean;
}

export class CheckoutValidationError extends Error {
  constructor(public fields: Record<string, string[]>) {
    super("Checkout validation failed.");
    this.name = "CheckoutValidationError";
  }
}

function badInput(field: string, message: string): CheckoutValidationError {
  return new CheckoutValidationError({ [field]: [message] });
}

export function validateCheckoutInput(raw: unknown): CheckoutInput {
  if (!raw || typeof raw !== "object") throw badInput("items", "This field is required.");
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { items: [], paymentMethod: "mobile_money", termsAccepted: false };
  }
  const items: CheckoutItemInput[] = body.items.map((entry: unknown, index: number) => {
    if (!entry || typeof entry !== "object") {
      throw new CheckoutValidationError({ items: [`Item ${index + 1} is invalid.`] });
    }
    const c = entry as Record<string, unknown>;
    const rawProduct = c.product ?? c.product_id ?? c.id;
    const n = typeof rawProduct === "string" ? Number(rawProduct) : rawProduct;
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      throw new CheckoutValidationError({ items: [`Product ${String(rawProduct ?? "?")} not found.`] });
    }
    const q = typeof c.quantity === "string" ? Number(c.quantity) : c.quantity;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1) {
      throw new CheckoutValidationError({ items: ["Quantity must be at least 1."] });
    }
    return { productId: BigInt(n), quantity: q };
  });
  const text = (v: unknown): string | undefined => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  };
  const email = text(body.customer_email);
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badInput("customer_email", "Enter a valid email address.");
  }
  return {
    items,
    paymentMethod: text(body.payment_method) ?? "mobile_money",
    customerFullName: text(body.customer_full_name),
    customerEmail: email,
    customerPhone: text(body.customer_phone),
    customerAddress: text(body.customer_address),
    deliveryLocation: text(body.delivery_location),
    termsAccepted: Boolean(body.terms_accepted),
  };
}

// Control numbers look like ZN<YYMMDD><8 random digits>, unique per payment.
function generateControlNumber(now: Date): string {
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  let token = "";
  for (let i = 0; i < 8; i++) token += String(Math.floor(Math.random() * 10));
  return `ZN${y}${m}${d}${token}`;
}

async function uniqueControlNumber(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateControlNumber(new Date());
    const existing = await tx.payment.findUnique({ where: { controlNumber: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique control number.");
}

// If exactly one active driver exists, assign the sale to them (Django parity).
async function autoAssignSaleToSoleDriver(
  tx: Prisma.TransactionClient,
  saleId: bigint,
): Promise<void> {
  const sale = await tx.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.assignedDriverId) return;
  if (!["payment_confirmed", "processing", "out_for_delivery"].includes(sale.status)) return;
  const drivers = await tx.user.findMany({
    where: { role: "driver", isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  if (drivers.length !== 1) return;
  const data: { assignedDriverId: bigint; status?: string } = { assignedDriverId: drivers[0].id };
  if (["payment_confirmed", "processing"].includes(sale.status)) {
    data.status = "out_for_delivery";
  }
  await tx.sale.update({ where: { id: saleId }, data });
}

export function buildWhatsappOrderUrl(
  sale: { id: bigint; finalAmount: string; paymentMethod: string; deliveryLocation: string | null; customerFullName: string; customerEmail: string; customerPhone: string; customerAddress: string },
  payment: { controlNumber: string; status: string },
  lines: { name: string; price: string; quantity: number }[],
): string {
  const text = [
    "Zanzibar Supermarket Order",
    `Order ID: ${sale.id}`,
    `Control Number: ${payment.controlNumber}`,
    `Customer: ${sale.customerFullName || "Customer"}`,
    `Email: ${sale.customerEmail || "Not provided"}`,
    `Phone: ${sale.customerPhone || "Not provided"}`,
    `Address: ${sale.customerAddress || "Not provided"}`,
    `Delivery Location: ${sale.deliveryLocation || "Not provided"}`,
    `Payment Method: ${sale.paymentMethod}`,
    `Payment Status: ${payment.status}`,
    `Total: TZS ${sale.finalAmount}`,
    "Items:",
    ...lines.map((l) => `- ${l.name} x${l.quantity} @ TZS ${l.price} = TZS ${new Prisma.Decimal(l.price).times(l.quantity).toFixed(2)}`),
  ].join("\n");
  return `https://wa.me/${WHATSAPP_ORDER_NUMBER}?text=${encodeURIComponent(text)}`;
}

export async function checkout(
  user: CurrentUser,
  input: CheckoutInput,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (input.items.length === 0) {
    return { status: 400, body: { detail: "Cart is empty." } };
  }
  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        let customer = await tx.customer.findUnique({ where: { userId: user.id } });
        if (!customer) {
          customer = await tx.customer.create({ data: { userId: user.id, phone: user.phone } });
        }
        const ids = input.items.map((i) => i.productId);
        const products = await tx.$queryRaw<{ id: bigint; name: string; price: string; quantity: number }[]>`
          SELECT id, name, price, quantity FROM supermarketzanzibar_product
          WHERE id = ANY(${ids}::bigint[]) FOR UPDATE`;
        const productMap = new Map<string, { id: bigint; name: string; price: string; quantity: number }>(products.map((p) => [String(p.id), p]));
        for (const item of input.items) {
          if (!productMap.has(String(item.productId))) {
            return { status: 400, body: { detail: `Product ${item.productId} not found.` } };
          }
        }
        let total = new Prisma.Decimal(0);
        const resolved: { id: bigint; name: string; price: Prisma.Decimal; qty: number }[] = [];
        for (const item of input.items) {
          const p = productMap.get(String(item.productId))!;
          if (Number(p.quantity) < item.quantity) {
            return { status: 400, body: { detail: `Not enough stock for ${p.name}.` } };
          }
          const price = new Prisma.Decimal(p.price as string | number);
          total = total.plus(price.times(item.quantity));
          resolved.push({ id: p.id, name: p.name, price, qty: item.quantity });
        }
        const sale = await tx.sale.create({
          data: {
            customerId: customer.id,
            userId: user.id,
            totalAmount: total,
            tax: new Prisma.Decimal(0),
            discount: new Prisma.Decimal(0),
            finalAmount: total,
            paymentMethod: input.paymentMethod,
            paymentConfirmed: true,
            deliveryLocation: input.deliveryLocation ?? "",
            termsAccepted: input.termsAccepted,
            customerFullName: input.customerFullName ?? user.fullName ?? user.username,
            customerEmail: input.customerEmail ?? user.email ?? "",
            customerPhone: input.customerPhone ?? user.phone ?? "",
            customerAddress: input.customerAddress ?? user.address ?? "",
            status: "payment_confirmed",
          },
        });
        for (const r of resolved) {
          const item = await tx.saleItem.create({
            data: { saleId: sale.id, productId: r.id, quantity: r.qty, price: r.price, total: r.price.times(r.qty) },
          });
          await tx.$executeRaw`UPDATE supermarketzanzibar_product SET quantity = quantity - ${r.qty} WHERE id = ${r.id}`;
          await tx.stockMovement.create({
            data: { productId: r.id, saleItemId: item.id, quantity: r.qty, movementType: "OUT" },
          });
        }
        const controlNumber = await uniqueControlNumber(tx);
        const payment = await tx.payment.create({
          data: { saleId: sale.id, controlNumber, paymentMethod: input.paymentMethod, status: "confirmed" },
        });
        await autoAssignSaleToSoleDriver(tx, sale.id);
        return { saleId: sale.id, paymentId: payment.id };
      },
      { isolationLevel: "Serializable", timeout: 15000, maxWait: 10000 },
    );

    const ids2 = outcome as { saleId: bigint; paymentId: bigint };
    const sale = await prisma.sale.findUnique({
      where: { id: ids2.saleId },
      include: { items: { include: { product: true } }, payment: true, assignedDriver: true, customer: true, user: true },
    });
    const payment = await prisma.payment.findUnique({
      where: { id: ids2.paymentId },
      include: { sale: true, confirmedBy: true },
    });
    if (!sale || !payment) {
      return { status: 503, body: { detail: "Unable to place this order right now. Please try again shortly." } };
    }
    const itemsText = sale.items.map((it) => `- ${it.product.name} x${it.quantity}`).join("\n");
    const totalStr = new Prisma.Decimal(sale.finalAmount as unknown as string | number).toFixed(2);
    const subject = `Order Received - Control #${payment.controlNumber}`;
    const message = [
      `Hello ${sale.customerFullName || "Customer"},`, "", "Your payment was confirmed successfully.",
      `Order ID: ${sale.id}`, `Control Number: ${payment.controlNumber}`, `Payment Method: ${payment.paymentMethod}`,
      `Payment Status: ${payment.status}`, `Total: ${totalStr}`, `Phone: ${sale.customerPhone || "Not provided"}`,
      `Address: ${sale.customerAddress || "Not provided"}`, `Delivery location: ${sale.deliveryLocation || "Not provided"}`,
      "", `Items:\n${itemsText}`, "", `Your receipt is now available. Thank you for shopping with ${STORE_NAME}.`,
    ].join("\n");
    const recipient = sale.customerEmail || user.email || "";
    if (recipient) void sendOrderEmail(recipient, subject, message);
    const serialized = serializeSale(sale as never) as unknown as Record<string, unknown>;
    return {
      status: 201,
      body: {
        sale: serialized,
        payment: { id: payment.id.toString(), control_number: payment.controlNumber, payment_method: payment.paymentMethod, status: payment.status },
        whatsapp_url: buildWhatsappOrderUrl(
          { id: sale.id, finalAmount: totalStr, paymentMethod: sale.paymentMethod, deliveryLocation: sale.deliveryLocation, customerFullName: sale.customerFullName, customerEmail: sale.customerEmail, customerPhone: sale.customerPhone, customerAddress: sale.customerAddress },
          { controlNumber: payment.controlNumber, status: payment.status },
          sale.items.map((it) => ({ name: it.product.name, price: new Prisma.Decimal(it.price as unknown as string | number).toFixed(2), quantity: it.quantity })),
        ),
      },
    };
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      const first = Object.values(error.fields)[0]?.[0] ?? "Invalid input.";
      return { status: 400, body: { detail: first } };
    }
    console.error("Checkout failed:", error instanceof Error ? error.message : error);
    return { status: 503, body: { detail: "Unable to place this order right now. Please try again shortly." } };
  }
}

// Order history: visible (non-hidden) sales for the current customer user.
export async function listOrders(user: CurrentUser) {
  return prisma.sale.findMany({
    where: { userId: user.id, customerHistoryHidden: false },
    include: { items: { include: { product: true } }, payment: true, assignedDriver: true, customer: true, user: true },
    orderBy: { createdAt: "desc" },
  });
}

// History-only delete: flags sales hidden, never deletes financial records.
export async function clearOrderHistory(user: CurrentUser) {
  return prisma.sale.updateMany({
    where: { userId: user.id, customerHistoryHidden: false },
    data: { customerHistoryHidden: true },
  });
}

export async function hideOrderItem(user: CurrentUser, saleId: bigint) {
  return prisma.sale.updateMany({
    where: { id: saleId, userId: user.id, customerHistoryHidden: false },
    data: { customerHistoryHidden: true },
  });
}

export async function getOrderForReceipt(user: CurrentUser, saleId: bigint) {
  return prisma.sale.findFirst({
    where: { id: saleId, userId: user.id },
    include: {
      items: { include: { product: true } },
      payment: true,
      assignedDriver: true,
      customer: true,
      user: true,
    },
  });
}
