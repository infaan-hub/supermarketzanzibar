// GET   /api/customers/[id] - Customer profile, loyalty points & purchase history.
// PATCH /api/customers/[id] - Update customer contact info or loyalty points (manager/admin).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, conflict, json, notFound, serverError } from "@/lib/http";
import { requireManager, requireStaff } from "@/lib/auth/request";
import { isEmailValid } from "@/lib/validation";

function parseId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

async function loadCustomerDetail(customerId: bigint) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      user: true,
      sales: {
        include: {
          payment: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!customer) return null;

  const totalSpent = customer.sales
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + Number(s.finalAmount), 0);

  return {
    id: customer.id.toString(),
    userId: customer.userId.toString(),
    username: customer.user.username,
    name: customer.user.fullName,
    email: customer.user.email,
    phone: customer.phone || customer.user.phone,
    address: customer.user.address ?? "",
    loyaltyPoints: customer.loyaltyPoints,
    isActive: customer.user.isActive,
    createdAt: customer.createdAt,
    totalSpent,
    ordersCount: customer.sales.length,
    sales: customer.sales.map((s) => ({
      id: s.id.toString(),
      grandTotal: Number(s.finalAmount),
      paymentMethod: s.payment?.paymentMethod ?? s.paymentMethod,
      paymentStatus:
        s.payment?.status ?? (s.paymentConfirmed ? "confirmed" : "pending"),
      status: s.status,
      itemsCount: s._count.items,
      createdAt: s.createdAt,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const customerId = parseId(id);
  if (!customerId) return badRequest("Invalid customer ID.");

  try {
    const detail = await loadCustomerDetail(customerId);
    if (!detail) return notFound("Customer not found.");
    return json(detail);
  } catch (error) {
    console.error("Get customer detail failed:", error);
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
  const customerId = parseId(id);
  if (!customerId) return badRequest("Invalid customer ID.");

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  try {
    const existing = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { user: true },
    });
    if (!existing) return notFound("Customer not found.");

    const userData: Prisma.UserUpdateInput = {};
    const customerData: Prisma.CustomerUpdateInput = {};

    if (typeof body.name === "string" && body.name.trim()) {
      userData.fullName = body.name.trim();
    }
    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (!isEmailValid(email)) return badRequest("Enter a valid email address.");
      userData.email = email;
    }
    if (typeof body.phone === "string" && body.phone.trim()) {
      const phone = body.phone.trim();
      userData.phone = phone;
      customerData.phone = phone;
    }
    if (typeof body.address === "string") {
      userData.address = body.address.trim();
    }
    if (body.loyaltyPoints !== undefined) {
      const pts = Number(body.loyaltyPoints);
      if (!Number.isInteger(pts) || pts < 0) {
        return badRequest("Loyalty points must be a non-negative whole number.");
      }
      customerData.loyaltyPoints = pts;
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: existing.userId }, data: userData }),
      prisma.customer.update({ where: { id: customerId }, data: customerData }),
    ]);

    const detail = await loadCustomerDetail(customerId);
    return json(detail);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("Email or phone is already used by another account.");
    }
    console.error("Update customer failed:", error);
    return serverError("Unable to update customer.");
  }
}
