// GET /api/customers - List customers.
//
// Returns customer records for look-up and order history.

import { NextResponse } from "next/server";
import { findManyCustomers, countCustomers } from "@/lib/customers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [customers, total] = await Promise.all([
      findManyCustomers({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          address: true,
          isActive: true,
          createdAt: true,
        },
        take,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
        orderBy: { createdAt: "desc" },
      }),
      countCustomers(where),
    ]);

    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id.toString(),
        name: c.fullName,
        email: c.email,
        phone: c.phone,
        address: c.address,
        is_active: c.isActive,
        createdAt: c.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.ceil(total / takeNum),
      },
    });
  } catch (error) {
    console.error("List customers failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { detail: "Use the admin dashboard to manage customers." },
    { status: 403 },
  );
}
