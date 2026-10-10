// Sale library: sale/order queries for the API routes.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface SaleFindOptions {
  where?: Prisma.SaleWhereInput;
  orderBy?: Prisma.SaleOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export interface SaleCreateInput {
  customerId?: bigint | null;
  userId?: bigint | null;
  totalAmount: string;
  tax?: string;
  discount?: string;
  finalAmount: string;
  paymentMethod: string;
  paymentConfirmed?: boolean;
  termsAccepted?: boolean;
  deliveryLocation?: string | null;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  status: string;
}

export async function findManySales(options: SaleFindOptions = {}) {
  const { where, orderBy, take, skip } = options;
  const sales = await prisma.sale.findMany({
    include: {
      customer: { include: { user: true } },
      payment: true,
    },
    where,
    orderBy,
    take,
    skip,
  });

  return sales.map((s) => ({
    id: s.id,
    customer: s.customer
      ? {
          id: s.customer.id,
          userId: s.customer.userId,
          fullName: s.customer.user.fullName ?? null,
          email: s.customer.user.email ?? null,
          phone: s.customer.user.phone ?? null,
        }
      : null,
    totalAmount: s.totalAmount,
    taxAmount: s.tax,
    discount: s.discount,
    changeDue: s.finalAmount,
    grandTotal: s.finalAmount,
    status: s.status,
    paymentMethod: s.paymentMethod,
    paymentStatus: s.payment?.status ?? (s.paymentConfirmed ? "confirmed" : "pending"),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function countSales(where?: Prisma.SaleWhereInput) {
  return prisma.sale.count({ where });
}

export async function createSale(data: SaleCreateInput) {
  return prisma.sale.create({ data });
}

export async function listItems(saleId: bigint) {
  return prisma.saleItem.findMany({
    where: { saleId },
    include: { product: true },
  });
}