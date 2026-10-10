// GET /api/sales - List sales (orders).
//
// Returns order records for the POS dashboard.

import { NextResponse } from "next/server";
import { findManySales, countSales } from "@/lib/sales";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: {
      OR?: { status: string }[];
      createdAt?: { gte?: string; lte?: string };
    } = {};

    if (status) {
      where.OR = [{ status: status as "pending" | "completed" | "cancelled" }];
    }

    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [sales, total] = await Promise.all([
      findManySales({
        where,
        select: {
          id: true,
          customer: true,
          totalAmount: true,
          taxAmount: true,
          changeDue: true,
          grandTotal: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          createdAt: true,
          updatedAt: true,
        },
        take,
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
