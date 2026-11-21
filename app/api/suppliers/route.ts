// GET  /api/suppliers - List suppliers with supplied product & low-stock counts.
// POST /api/suppliers - Create a new supplier vendor (manager/admin).

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
import { requireManager, requireStaff } from "@/lib/auth/request";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { isEmailValid } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.SupplierWhereInput = {};
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        {
          user: {
            is: {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 100) : 30;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          user: true,
          products: {
            where: { isActive: true },
            select: { id: true, quantity: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      prisma.supplier.count({ where }),
    ]);

    return json({
      suppliers: suppliers.map((s) => ({
        id: s.id.toString(),
        companyName: s.companyName,
        contactName: s.user.fullName,
        phone: s.phone,
        email: s.user.email,
        address: s.address,
        productsCount: s.products.length,
        lowStockCount: s.products.filter(
          (p) => p.quantity <= LOW_STOCK_THRESHOLD,
        ).length,
        is_active: s.user.isActive,
        createdAt: s.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.max(1, Math.ceil(total / takeNum)),
      },
    });
  } catch (error) {
    console.error("List suppliers failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("A JSON body is required.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("A JSON body is required.");
  }

  const companyName =
    typeof body.companyName === "string" ? body.companyName.trim() : "";
  const contactName =
    typeof body.contactName === "string" ? body.contactName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const rawEmail =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  const errors: Record<string, string[]> = {};
  if (!companyName) errors.companyName = ["Company name is required."];
  if (!contactName) errors.contactName = ["Contact name is required."];
  if (!phone) errors.phone = ["Phone number is required."];
  if (rawEmail && !isEmailValid(rawEmail)) {
    errors.email = ["Enter a valid email address."];
  }
  if (Object.keys(errors).length > 0) return validationError(errors);

  const suffix = randomBytes(4).toString("hex");
  const email = rawEmail || `supplier_${suffix}@vendor.zanzibar.local`;
  const username = `sup_${suffix}`;

  try {
    const createdSupplier = await prisma.supplier.create({
      data: {
        companyName,
        phone,
        address,
        user: {
          create: {
            username,
            email,
            fullName: contactName,
            phone,
            address,
            role: "supplier",
            isActive: true,
            password: `!${randomBytes(16).toString("hex")}`,
          },
        },
      },
      include: { user: true },
    });

    return created({
      id: createdSupplier.id.toString(),
      companyName: createdSupplier.companyName,
      contactName: createdSupplier.user.fullName,
      phone: createdSupplier.phone,
      email: createdSupplier.user.email,
      address: createdSupplier.address,
      productsCount: 0,
      lowStockCount: 0,
      is_active: createdSupplier.user.isActive,
      createdAt: createdSupplier.createdAt,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("A supplier with that email or phone already exists.");
    }
    console.error("Create supplier failed:", error);
    return serverError("Unable to create supplier.");
  }
}
