// GET /api/sales - List sales with search, status, payment method & date filters.

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/request";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const method = searchParams.get("method")?.trim();
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.SaleWhereInput = {};

    if (status) where.status = status;
    if (method) where.paymentMethod = method;

    if (search) {
      const orClauses: Prisma.SaleWhereInput[] = [
        { customerFullName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        {
          payment: {
            is: { controlNumber: { contains: search, mode: "insensitive" } },
          },
        },
      ];
      if (/^\d+$/.test(search)) {
        orClauses.push({ id: BigInt(search) });
      }
      where.OR = orClauses;
    }

    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = new Date(start);
      if (end) {
        const endDate = new Date(end);
        if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
          endDate.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = endDate;
      }
    }

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 100) : 30;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: { include: { user: true } },
          payment: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      prisma.sale.count({ where }),
    ]);

    return json({
      sales: sales.map((s) => {
        const displayName =
          s.customerFullName.trim() ||
          s.customer?.user.fullName.trim() ||
          "Walk-in Customer";

        return {
          id: s.id.toString(),
          customer: s.customer
            ? { id: s.customer.id.toString(), name: displayName }
            : { id: "", name: displayName },
          customerFullName: displayName,
          customerEmail: s.customerEmail || s.customer?.user.email || "",
          customerPhone: s.customerPhone || s.customer?.user.phone || "",
          itemsCount: s._count.items,
          totalAmount: Number(s.totalAmount),
          taxAmount: Number(s.tax),
          discount: Number(s.discount),
          grandTotal: Number(s.finalAmount),
          status: s.status,
          paymentMethod: s.payment?.paymentMethod ?? s.paymentMethod,
          paymentStatus:
            s.payment?.status ?? (s.paymentConfirmed ? "confirmed" : "pending"),
          controlNumber: s.payment?.controlNumber ?? null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      }),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.max(1, Math.ceil(total / takeNum)),
      },
    });
  } catch (error) {
    console.error("List sales failed:", error);
    return serverError();
  }
}

export async function POST() {
  return json(
    { detail: "Use POST /api/checkout to create sales." },
    { status: 405 },
  );
}
