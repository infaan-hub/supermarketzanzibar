// GET /api/sales - List sales (orders).
//
// Returns order records for the POS dashboard.

import { NextResponse } from "next/server";
import { findManySales, countSales } from "@/lib/sales";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.SaleWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = new Date(start);
      if (end) where.createdAt.lte = new Date(end);
    }

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [sales, total] = await Promise.all([
      findManySales({
        where,
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
        orderBy: { createdAt: "desc" },
      }),
      countSales(where),
    ]);

    return NextResponse.json({
      sales: sales.map((s) => ({
        id: s.id.toString(),
        customer: s.customer
          ? { id: s.customer.id.toString(), name: s.customer.fullName }
          : null,
        totalAmount: s.totalAmount,
        taxAmount: s.taxAmount,
        discount: s.discount,
        changeDue: s.changeDue,
        grandTotal: s.grandTotal,
        status: s.status,
        paymentMethod: s.paymentMethod,
        paymentStatus: s.paymentStatus,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.ceil(total / takeNum),
      },
    });
  } catch (error) {
    console.error("List sales failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { detail: "Use the POS / checkout flow to create sales." },
    { status: 403 },
  );
}
