// GET  /api/customers - List customer profiles with loyalty points & order counts.
// POST /api/customers - Quick-register a customer profile from POS/directory.

import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  badRequest,
  conflict,
  created,
  json,
  serverError,
  validationError,
} from "@/lib/http";
import { requireStaff } from "@/lib/auth/request";
import { isEmailValid } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.CustomerWhereInput = {};
    if (search) {
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        {
          user: {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 100) : 30;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              address: true,
              isActive: true,
              createdAt: true,
            },
          },
          _count: { select: { sales: true } },
        },
        orderBy: { createdAt: "desc" },
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      prisma.customer.count({ where }),
    ]);

    return json({
      customers: customers.map((c) => ({
        id: c.id.toString(),
        userId: c.userId.toString(),
        name: c.user.fullName,
        email: c.user.email,
        phone: c.phone || c.user.phone,
        address: c.user.address ?? "",
        loyaltyPoints: c.loyaltyPoints,
        ordersCount: c._count.sales,
        is_active: c.user.isActive,
        createdAt: c.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.max(1, Math.ceil(total / takeNum)),
      },
    });
  } catch (error) {
    console.error("List customers failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("A JSON body is required.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("A JSON body is required.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  const errors: Record<string, string[]> = {};
  if (!name) errors.name = ["Customer name is required."];
  if (!phone) errors.phone = ["Phone number is required."];
  if (rawEmail && !isEmailValid(rawEmail)) {
    errors.email = ["Enter a valid email address."];
  }
  if (Object.keys(errors).length > 0) return validationError(errors);

  const suffix = randomBytes(4).toString("hex");
  const email = rawEmail || `customer_${suffix}@walkin.zanzibar.local`;
  const username = `cust_${suffix}`;

  try {
    const createdCustomer = await prisma.customer.create({
      data: {
        phone,
        loyaltyPoints: 0,
        user: {
          create: {
            username,
            email,
            fullName: name,
            phone,
            address,
            role: "customer",
            isActive: true,
            password: `!${randomBytes(16).toString("hex")}`,
          },
        },
      },
      include: { user: true },
    });

    return created({
      id: createdCustomer.id.toString(),
      userId: createdCustomer.userId.toString(),
      name: createdCustomer.user.fullName,
      email: createdCustomer.user.email,
      phone: createdCustomer.phone,
      address: createdCustomer.user.address ?? "",
      loyaltyPoints: createdCustomer.loyaltyPoints,
      ordersCount: 0,
      is_active: createdCustomer.user.isActive,
      createdAt: createdCustomer.createdAt,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("A customer with that email or phone number already exists.");
    }
    console.error("Create customer failed:", error);
    return serverError("Unable to create customer.");
  }
}
