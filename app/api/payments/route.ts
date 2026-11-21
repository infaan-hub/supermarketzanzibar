// GET  /api/payments - List & reconcile payments with status/method filters.
// POST /api/payments - Record a payment for a sale.

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, json, serverError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/request";
import { processPayment } from "@/lib/payments";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const method = searchParams.get("method")?.trim();
    const search = searchParams.get("search")?.trim();
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.PaymentWhereInput = {};
    if (status) where.status = status;
    if (method) where.paymentMethod = method;
    if (search) {
      const orClauses: Prisma.PaymentWhereInput[] = [
        { controlNumber: { contains: search, mode: "insensitive" } },
        {
          sale: {
            customerFullName: { contains: search, mode: "insensitive" },
          },
        },
      ];
      if (/^\d+$/.test(search)) {
        orClauses.push({ saleId: BigInt(search) });
      }
      where.OR = orClauses;
    }

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 100) : 30;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [payments, total, confirmedRows, pendingRows] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              finalAmount: true,
              status: true,
              customerFullName: true,
              customer: { select: { user: { select: { fullName: true } } } },
            },
          },
          confirmedBy: { select: { fullName: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where: { status: "confirmed" },
        select: { sale: { select: { finalAmount: true } } },
      }),
      prisma.payment.findMany({
        where: { status: "pending" },
        select: { sale: { select: { finalAmount: true } } },
      }),
    ]);

    const totalConfirmedAmount = confirmedRows.reduce(
      (sum, row) => sum + Number(row.sale.finalAmount),
      0,
    );
    const pendingAmount = pendingRows.reduce(
      (sum, row) => sum + Number(row.sale.finalAmount),
      0,
    );

    return json({
      payments: payments.map((p) => ({
        id: p.id.toString(),
        saleId: p.saleId.toString(),
        controlNumber: p.controlNumber,
        amount: Number(p.sale.finalAmount),
        paymentMethod: p.paymentMethod,
        status: p.status,
        customerName:
          p.sale.customerFullName.trim() ||
          p.sale.customer?.user.fullName.trim() ||
          "Walk-in Customer",
        saleStatus: p.sale.status,
        confirmedBy:
          p.confirmedBy?.fullName || p.confirmedBy?.username || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      summary: {
        totalConfirmedAmount,
        confirmedCount: confirmedRows.length,
        pendingAmount,
        pendingCount: pendingRows.length,
      },
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.max(1, Math.ceil(total / takeNum)),
      },
    });
  } catch (error) {
    console.error("List payments failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json().catch(() => null)) as {
      saleId?: string;
      amount?: number;
      paymentMethod?: "cash" | "mobile_money" | "card";
      reference?: string;
    } | null;

    if (!body?.saleId || body.amount == null) {
      return badRequest("saleId and amount are required.");
    }

    const result = await processPayment({
      saleId: BigInt(body.saleId),
      amount: body.amount,
      paymentMethod: body.paymentMethod ?? "cash",
      reference: body.reference,
    });

    return json(result);
  } catch (error) {
    console.error("Payment failed:", error);
    return serverError();
  }
}
