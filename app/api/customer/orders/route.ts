// GET  /api/customer/orders - List the signed-in customer's orders and bought-products history.
// POST /api/customer/orders - Submit a new customer order from the Marketplace cart.

import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, created, json, serverError } from "@/lib/http";
import { requireAuth } from "@/lib/auth/request";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import {
  isMissingTwinTables,
  syncTwinDeductionInTx,
} from "@/services/digital-twin.service";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";

export const dynamic = "force-dynamic";

const VALID_METHODS = new Set(["cash", "mobile_money", "card", "bank_transfer"]);

function generateControlNumber(): string {
  const digits = randomBytes(6)
    .reduce((acc, b) => acc + String(b % 10), "")
    .slice(0, 10);
  return `SZ${digits}`;
}

export async function GET(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: guard.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        address: true,
        customerProfile: { select: { id: true, loyaltyPoints: true } },
      },
    });

    if (!userRecord) {
      return json({ detail: "User not found." }, { status: 404 });
    }

    const orClauses: Prisma.SaleWhereInput[] = [{ userId: userRecord.id }];
    if (userRecord.customerProfile) {
      orClauses.push({ customerId: userRecord.customerProfile.id });
    }
    if (userRecord.email) {
      orClauses.push({
        customerEmail: { equals: userRecord.email, mode: "insensitive" },
      });
    }

    const sales = await prisma.sale.findMany({
      where: {
        customerHistoryHidden: false,
        OR: orClauses,
      },
      include: {
        payment: {
          select: {
            id: true,
            controlNumber: true,
            paymentMethod: true,
            status: true,
            createdAt: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                barcode: true,
                price: true,
                quantity: true,
                isActive: true,
                imageName: true,
                imageContentType: true,
                updatedAt: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    let totalSpent = 0;
    let totalItemsBought = 0;
    let completedOrders = 0;
    let pendingOrders = 0;

    const boughtMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        barcode: string;
        categoryName: string | null;
        imageUrl: string | null;
        currentPrice: number;
        currentStock: number;
        inStock: boolean;
        totalQuantityBought: number;
        totalSpent: number;
        orderCount: number;
        lastPurchasedAt: string;
        latestOrderId: string;
        purchases: Array<{
          saleId: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
          status: string;
          purchasedAt: string;
        }>;
      }
    >();

    const orders = sales.map((s) => {
      const grandTotal = Number(s.finalAmount);
      const isCancelled = s.status === "cancelled";
      const isCompleted =
        !isCancelled &&
        (s.status === "completed" ||
          s.status === "delivered" ||
          s.payment?.status === "confirmed" ||
          s.paymentConfirmed);

      if (!isCancelled) {
        totalSpent += grandTotal;
        if (isCompleted) completedOrders += 1;
        else pendingOrders += 1;
      }

      const items = s.items.map((item) => {
        const pid = item.productId.toString();
        const unitPrice = Number(item.price);
        const lineTotal = Number(item.total);
        const hasImage = Boolean(
          item.product.imageName || item.product.imageContentType,
        );
        const imageUrl = hasImage
          ? `/api/public/products/${pid}/image?v=${item.product.updatedAt.getTime()}`
          : null;

        if (!isCancelled) {
          totalItemsBought += item.quantity;
          let agg = boughtMap.get(pid);
          if (!agg) {
            agg = {
              productId: pid,
              productName: item.product.name,
              barcode: item.product.barcode,
              categoryName: item.product.category?.name ?? null,
              imageUrl,
              currentPrice: Number(item.product.price),
              currentStock: item.product.quantity,
              inStock: item.product.isActive && item.product.quantity > 0,
              totalQuantityBought: 0,
              totalSpent: 0,
              orderCount: 0,
              lastPurchasedAt: s.createdAt.toISOString(),
              latestOrderId: s.id.toString(),
              purchases: [],
            };
            boughtMap.set(pid, agg);
          }
          agg.totalQuantityBought += item.quantity;
          agg.totalSpent += lineTotal;
          agg.orderCount += 1;
          agg.purchases.push({
            saleId: s.id.toString(),
            quantity: item.quantity,
            unitPrice,
            lineTotal,
            status: s.status,
            purchasedAt: s.createdAt.toISOString(),
          });
        }

        return {
          id: item.id.toString(),
          productId: pid,
          productName: item.product.name,
          barcode: item.product.barcode,
          categoryName: item.product.category?.name ?? null,
          imageUrl,
          quantity: item.quantity,
          price: unitPrice,
          lineTotal,
        };
      });

      return {
        id: s.id.toString(),
        orderNumber: `#${s.id.toString().padStart(6, "0")}`,
        status: s.status,
        paymentMethod: s.payment?.paymentMethod ?? s.paymentMethod,
        paymentStatus:
          s.payment?.status ?? (s.paymentConfirmed ? "confirmed" : "pending"),
        controlNumber: s.payment?.controlNumber ?? null,
        deliveryLocation: s.deliveryLocation || s.customerAddress || "Store Pickup",
        subtotal: Number(s.totalAmount),
        taxAmount: Number(s.tax),
        discount: Number(s.discount),
        grandTotal,
        itemsCount: items.reduce((sum, i) => sum + i.quantity, 0),
        items,
        createdAt: s.createdAt.toISOString(),
      };
    });

    const boughtProducts = Array.from(boughtMap.values()).sort(
      (a, b) =>
        new Date(b.lastPurchasedAt).getTime() -
        new Date(a.lastPurchasedAt).getTime(),
    );

    return json({
      customer: {
        fullName: userRecord.fullName,
        email: userRecord.email,
        phone: userRecord.phone,
        address: userRecord.address ?? "",
        loyaltyPoints: userRecord.customerProfile?.loyaltyPoints ?? 0,
      },
      summary: {
        totalOrders: orders.length,
        completedOrders,
        pendingOrders,
        totalSpent,
        totalItemsBought,
        uniqueProductsBought: boughtProducts.length,
      },
      orders,
      boughtProducts,
    });
  } catch (error) {
    console.error("GET /api/customer/orders failed:", error);
    return serverError("Unable to load your orders and purchase history.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") {
      return badRequest("A JSON body is required.");
    }
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("A JSON body is required.");
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return badRequest("Add at least one product to your cart before ordering.");
  }

  const normalizedMap = new Map<bigint, number>();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const rawId = String(rec.productId ?? "").trim();
    const qty = Math.floor(Number(rec.quantity ?? 0));
    if (!/^\d+$/.test(rawId) || !Number.isFinite(qty) || qty <= 0) {
      return badRequest("Every cart item must have a valid product and positive quantity.");
    }
    const pid = BigInt(rawId);
    normalizedMap.set(pid, (normalizedMap.get(pid) ?? 0) + qty);
  }

  if (normalizedMap.size === 0) {
    return badRequest("Cart cannot be empty.");
  }

  const rawMethod =
    typeof body.paymentMethod === "string"
      ? body.paymentMethod.trim().toLowerCase()
      : "mobile_money";
  const paymentMethod = VALID_METHODS.has(rawMethod) ? rawMethod : "mobile_money";

  const fulfillmentMode =
    typeof body.fulfillmentMode === "string"
      ? body.fulfillmentMode.trim()
      : "delivery";
  const deliveryAddress =
    typeof body.deliveryAddress === "string" && body.deliveryAddress.trim()
      ? body.deliveryAddress.trim().slice(0, 300)
      : "";

  try {
    await ensureDigitalTwinSchema().catch(() => undefined);

    const userRecord = await prisma.user.findUnique({
      where: { id: guard.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        address: true,
        customerProfile: { select: { id: true } },
      },
    });
    if (!userRecord) {
      return badRequest("User account not found.");
    }

    const productIds = Array.from(normalizedMap.keys());
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, name: true, price: true, quantity: true },
    });
    const productById = new Map(dbProducts.map((p) => [p.id, p]));

    for (const [pid, qty] of normalizedMap.entries()) {
      const prod = productById.get(pid);
      if (!prod) {
        return badRequest(`Product #${pid.toString()} is no longer available.`);
      }
      if (prod.quantity < qty) {
        return badRequest(
          `Only ${prod.quantity} unit(s) of "${prod.name}" are currently in stock.`,
        );
      }
    }

    const deliveryFee = fulfillmentMode === "delivery" ? 1500 : 0;

    const result = await prisma.$transaction(async (tx) => {
      let customerId = userRecord.customerProfile?.id ?? null;
      if (!customerId) {
        const createdCustomer = await tx.customer.create({
          data: {
            userId: userRecord.id,
            phone: userRecord.phone,
            loyaltyPoints: 0,
          },
          select: { id: true },
        });
        customerId = createdCustomer.id;
      }

      let subtotalNum = 0;
      const linePayloads: Array<{
        productId: bigint;
        name: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }> = [];

      for (const [pid, qty] of normalizedMap.entries()) {
        const prod = productById.get(pid)!;
        const unitPrice = prod.price;
        const lineTotal = unitPrice.mul(qty);
        subtotalNum += Number(lineTotal);

        const updated = await tx.product.updateMany({
          where: { id: pid, quantity: { gte: qty } },
          data: { quantity: { decrement: qty } },
        });
        if (updated.count === 0) {
          throw new Error(`Insufficient stock for "${prod.name}".`);
        }

        linePayloads.push({
          productId: pid,
          name: prod.name,
          quantity: qty,
          unitPrice,
          lineTotal,
        });
      }

      const finalNum = subtotalNum + deliveryFee;
      const store = await tx.store
        .findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } })
        .catch(() => null);

      const sale = await tx.sale.create({
        data: {
          storeId: store?.id ?? null,
          customerId,
          userId: userRecord.id,
          totalAmount: new Prisma.Decimal(subtotalNum.toFixed(2)),
          tax: new Prisma.Decimal("0.00"),
          discount: new Prisma.Decimal("0.00"),
          finalAmount: new Prisma.Decimal(finalNum.toFixed(2)),
          paymentMethod,
          paymentConfirmed: true,
          termsAccepted: true,
          status: "completed",
          deliveryLocation:
            deliveryAddress ||
            userRecord.address ||
            (fulfillmentMode === "delivery"
              ? "Stone Town, Zanzibar"
              : fulfillmentMode === "takeaway"
                ? "Express Store Pickup"
                : "In-Store Order"),
          customerFullName: userRecord.fullName || "Marketplace Customer",
          customerEmail: userRecord.email,
          customerPhone: userRecord.phone,
          customerAddress: deliveryAddress || userRecord.address || "",
        },
      });

      const controlNumber = generateControlNumber();
      await tx.payment.create({
        data: {
          controlNumber,
          paymentMethod,
          status: "confirmed",
          saleId: sale.id,
        },
      });

      const allTwinUpdates: Array<{
        productId: string;
        shelfCode: string;
        positionId: string;
        quantity: number;
      }> = [];

      for (const line of linePayloads) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: line.productId,
            quantity: line.quantity,
            price: line.unitPrice,
            total: line.lineTotal,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            saleItemId: saleItem.id,
            performedById: userRecord.id,
            quantity: line.quantity,
            movementType: "OUT",
            reference: `ORDER-${sale.id.toString()}`,
            notes: `Marketplace customer order (${fulfillmentMode})`,
          },
        });

        try {
          const twinSync = await syncTwinDeductionInTx(
            tx,
            line.productId,
            line.quantity,
          );
          allTwinUpdates.push(...twinSync.positionUpdates);
        } catch (err) {
          if (!isMissingTwinTables(err)) throw err;
        }
      }

      const loyaltyEarned = Math.max(1, Math.floor(finalNum / 1000));
      await tx.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { increment: loyaltyEarned } },
      });

      return {
        saleId: sale.id.toString(),
        orderNumber: `#${sale.id.toString().padStart(6, "0")}`,
        controlNumber,
        grandTotal: finalNum,
        itemsCount: linePayloads.reduce((s, l) => s + l.quantity, 0),
        createdAt: sale.createdAt.toISOString(),
        allTwinUpdates,
      };
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "CUSTOMER_ORDER_PLACED",
      entityType: "SALE",
      entityId: result.saleId,
      summary: `Customer placed Marketplace order ${result.orderNumber} (${result.itemsCount} items).`,
    }).catch(() => undefined);

    if (result.allTwinUpdates.length > 0) {
      publishInventoryEvent({
        type: "sale_completed",
        updates: result.allTwinUpdates,
        summary: `Order ${result.orderNumber} completed (${result.itemsCount} items).`,
      });
    }

    return created({
      order: {
        id: result.saleId,
        orderNumber: result.orderNumber,
        controlNumber: result.controlNumber,
        grandTotal: result.grandTotal,
        itemsCount: result.itemsCount,
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/customer/orders failed:", error);
    return serverError(
      error instanceof Error ? error.message : "Unable to place order.",
    );
  }
}
