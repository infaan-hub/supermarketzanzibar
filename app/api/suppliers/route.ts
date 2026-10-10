// GET /api/suppliers - List suppliers.
//
// Returns supplier records for vendor management.

import { NextResponse } from "next/server";
import { findManySuppliers, countSuppliers } from "@/lib/suppliers";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.SupplierWhereInput = {};
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search, mode: "insensitive" as const } },
        {
          user: {
            is: {
              OR: [
                { fullName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            },
          },
        },
      ];
    }

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [suppliers, total] = await Promise.all([
      findManySuppliers({
        where,
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      countSuppliers(where),
    ]);

    return NextResponse.json({
      suppliers: suppliers.map((s) => ({
        id: s.id.toString(),
        companyName: s.companyName,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        address: s.address,
        is_active: s.isActive,
        createdAt: s.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.ceil(total / takeNum),
      },
    });
  } catch (error) {
    console.error("List suppliers failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { detail: "Use the admin dashboard to manage suppliers." },
    { status: 403 },
  );
}
