// GET   /api/suppliers/[id] - Supplier profile, supplied products & reorder queue.
// PATCH /api/suppliers/[id] - Update supplier details (manager/admin).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, conflict, json, notFound, serverError } from "@/lib/http";
import { requireManager, requireStaff } from "@/lib/auth/request";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { isEmailValid } from "@/lib/validation";

function parseId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

async function loadSupplierDetail(supplierId: bigint) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: {
      user: true,
      products: {
        include: { category: true },
        orderBy: [{ quantity: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!supplier) return null;

  const products = supplier.products.map((p) => ({
    id: p.id.toString(),
    name: p.name,
    barcode: p.barcode,
    category: p.category?.name ?? null,
    price: Number(p.price),
    costPrice: Number(p.costPrice),
    quantity: p.quantity,
    isActive: p.isActive,
  }));

  return {
    id: supplier.id.toString(),
    userId: supplier.userId.toString(),
    companyName: supplier.companyName,
    contactName: supplier.user.fullName,
    phone: supplier.phone,
    email: supplier.user.email,
    address: supplier.address,
    isActive: supplier.user.isActive,
    createdAt: supplier.createdAt,
    products,
    lowStockProducts: products.filter(
      (p) => p.isActive && p.quantity <= LOW_STOCK_THRESHOLD,
    ),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const supplierId = parseId(id);
  if (!supplierId) return badRequest("Invalid supplier ID.");

  try {
    const detail = await loadSupplierDetail(supplierId);
    if (!detail) return notFound("Supplier not found.");
    return json(detail);
  } catch (error) {
    console.error("Get supplier detail failed:", error);
    return serverError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const supplierId = parseId(id);
  if (!supplierId) return badRequest("Invalid supplier ID.");

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  try {
    const existing = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { user: true },
    });
    if (!existing) return notFound("Supplier not found.");

    const supplierData: Prisma.SupplierUpdateInput = {};
    const userData: Prisma.UserUpdateInput = {};

    if (typeof body.companyName === "string" && body.companyName.trim()) {
      supplierData.companyName = body.companyName.trim();
    }
    if (typeof body.contactName === "string" && body.contactName.trim()) {
      userData.fullName = body.contactName.trim();
    }
    if (typeof body.phone === "string" && body.phone.trim()) {
      supplierData.phone = body.phone.trim();
      userData.phone = body.phone.trim();
    }
    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (!isEmailValid(email)) return badRequest("Enter a valid email address.");
      userData.email = email;
    }
    if (typeof body.address === "string") {
      supplierData.address = body.address.trim();
      userData.address = body.address.trim();
    }

    await prisma.$transaction([
      prisma.supplier.update({ where: { id: supplierId }, data: supplierData }),
      prisma.user.update({ where: { id: existing.userId }, data: userData }),
    ]);

    const detail = await loadSupplierDetail(supplierId);
    return json(detail);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("Email or phone is already used by another account.");
    }
    console.error("Update supplier failed:", error);
    return serverError("Unable to update supplier.");
  }
}
