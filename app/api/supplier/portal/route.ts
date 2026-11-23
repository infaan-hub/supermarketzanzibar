// GET /api/supplier/portal — Scoped Supplier Portal API (`/supplier/*`).
//
// Suppliers strictly see ONLY their own profile, products, low-stock reorder
// queue, purchase orders, and delivery receipts. Admins and Managers may
// optionally pass `?supplierId=<id>` to inspect a supplier.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/auth/request";
import {
  SUPPLIER_PORTAL_ROLES,
  isManagerRole,
  normalizeRole,
} from "@/lib/auth/roles";
import { json, serverError } from "@/lib/http";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireRoles(
    request,
    SUPPLIER_PORTAL_ROLES,
    "Supplier, Manager, or Admin access is required.",
  );
  if (!guard.ok) return guard.response;

  try {
    await ensureDigitalTwinSchema().catch(() => undefined);

    const { searchParams } = new URL(request.url);
    const requestedSupplierId = searchParams.get("supplierId")?.trim();
    const isSelfSupplier = normalizeRole(guard.user.role) === "supplier";

    let supplier = null;
    if (isSelfSupplier) {
      supplier = await prisma.supplier.findUnique({
        where: { userId: guard.user.id },
        include: {
          user: { select: { fullName: true, email: true, phone: true } },
        },
      });
    } else if (requestedSupplierId && /^\d+$/.test(requestedSupplierId)) {
      supplier = await prisma.supplier.findUnique({
        where: { id: BigInt(requestedSupplierId) },
        include: {
          user: { select: { fullName: true, email: true, phone: true } },
        },
      });
    } else {
      supplier = await prisma.supplier.findFirst({
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { fullName: true, email: true, phone: true } },
        },
      });
    }

    const availableSuppliers = isManagerRole(guard.user.role)
      ? (
          await prisma.supplier.findMany({
            select: { id: true, companyName: true },
            orderBy: { companyName: "asc" },
          })
        ).map((s) => ({ id: s.id.toString(), companyName: s.companyName }))
      : [];

    if (!supplier) {
      return json({
        supplier: null,
        availableSuppliers,
        summary: {
          productsCount: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          openOrdersCount: 0,
          deliveriesCount: 0,
        },
        products: [],
        purchaseOrders: [],
        deliveries: [],
      });
    }

    const [products, purchaseOrders, deliveries] = await Promise.all([
      prisma.product.findMany({
        where: { supplierId: supplier.id },
        include: { category: { select: { name: true } } },
        orderBy: [{ quantity: "asc" }, { name: "asc" }],
      }),
      prisma.purchaseOrder.findMany({
        where: { supplierId: supplier.id },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, barcode: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.goodsReceipt.findMany({
        where: {
          OR: [
            { supplierId: supplier.id },
            { purchaseOrder: { supplierId: supplier.id } },
          ],
        },
        include: {
          purchaseOrder: { select: { orderNumber: true } },
          warehouseLocation: {
            select: { rackCode: true, levelCode: true, positionCode: true },
          },
          receivedBy: { select: { fullName: true, username: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: 100,
      }),
    ]);

    const activeProducts = products.filter((p) => p.isActive);
    const lowStockCount = activeProducts.filter(
      (p) => p.quantity > 0 && p.quantity <= LOW_STOCK_THRESHOLD,
    ).length;
    const outOfStockCount = activeProducts.filter((p) => p.quantity <= 0).length;
    const openOrdersCount = purchaseOrders.filter(
      (po) => po.status !== "received" && po.status !== "cancelled",
    ).length;

    return json({
      supplier: {
        id: supplier.id.toString(),
        companyName: supplier.companyName,
        contactName: supplier.user.fullName,
        email: supplier.user.email,
        phone: supplier.phone || supplier.user.phone,
        address: supplier.address,
      },
      availableSuppliers,
      summary: {
        productsCount: activeProducts.length,
        lowStockCount,
        outOfStockCount,
        openOrdersCount,
        deliveriesCount: deliveries.length,
      },
      products: products.map((p) => ({
        id: p.id.toString(),
        name: p.name,
        sku: p.sku ?? `SKU-${p.id.toString().padStart(5, "0")}`,
        barcode: p.barcode,
        categoryName: p.category?.name ?? null,
        price: Number(p.price),
        costPrice: Number(p.costPrice),
        quantity: p.quantity,
        isActive: p.isActive,
        needsRestock: p.isActive && p.quantity <= LOW_STOCK_THRESHOLD,
      })),
      purchaseOrders: purchaseOrders.map((po) => ({
        id: po.id,
        orderNumber: po.orderNumber,
        status: po.status,
        totalAmount: Number(po.totalAmount),
        expectedDate: po.expectedDate,
        notes: po.notes,
        createdAt: po.createdAt,
        items: po.items.map((item) => ({
          id: item.id,
          productId: item.productId.toString(),
          productName: item.product.name,
          barcode: item.product.barcode,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          remainingQuantity: Math.max(
            0,
            item.orderedQuantity - item.receivedQuantity,
          ),
          unitCost: Number(item.unitCost),
          lineTotal: Number(item.lineTotal),
        })),
      })),
      deliveries: deliveries.map((d) => ({
        id: d.id,
        receiptNumber: d.receiptNumber,
        orderNumber: d.purchaseOrder?.orderNumber ?? null,
        totalUnits: d.totalUnits,
        warehouseLocation: d.warehouseLocation
          ? `${d.warehouseLocation.rackCode}/${d.warehouseLocation.levelCode}/${d.warehouseLocation.positionCode}`
          : "Receiving Dock",
        receivedBy:
          d.receivedBy?.fullName || d.receivedBy?.username || "Warehouse Staff",
        notes: d.notes,
        receivedAt: d.receivedAt,
      })),
    });
  } catch (error) {
    console.error("Load supplier portal failed:", error);
    return serverError("Unable to load supplier portal.");
  }
}
