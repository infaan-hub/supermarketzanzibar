// Sale service: sale/order CRUD, status transitions, assigned driver.
//
// Ports Django `Sale` model and related views.

import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/request";

export type SaleStatus =
  | "pending_payment"
  | "payment_confirmed"
  | "processing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface SaleFindOptions {
  where?: {
    id?: bigint;
    customerId?: bigint;
    userId?: bigint;
    paymentConfirmed?: boolean;
    status?: SaleStatus;
    assignedDriverId?: bigint;
  };
  include?: {
    items?: { include: { product: boolean } };
    payment?: boolean;
    assignedDriver?: boolean;
    customer?: boolean;
    user?: boolean;
  };
  orderBy?: { id?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export interface SaleCreateInput {
  customerId?: bigint;
  userId?: bigint;
  totalAmount: string;
  tax?: string;
  discount?: string;
  finalAmount: string;
  paymentMethod: string;
  paymentConfirmed: boolean;
  termsAccepted: boolean;
  deliveryLocation?: string | null;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  status: SaleStatus;
}

export async function findSale(options: SaleFindOptions) {
  return prisma.sale.findFirst(options);
}

export async function findSaleById(id: bigint) {
  return prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      payment: true,
      assignedDriver: true,
      customer: true,
      user: true,
    },
  });
}

export async function findManySales(options: SaleFindOptions = {}) {
  return prisma.sale.findMany({
    include: {
      items: { include: { product: true } },
      payment: true,
      assignedDriver: true,
      customer: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
    ...options,
  });
}

export async function createSale(data: SaleCreateInput) {
  return prisma.sale.create({ data });
}

export async function updateSale(id: bigint, data: Partial<SaleCreateInput>) {
  return prisma.sale.update({ where: { id }, data });
}

export async function deleteSale(id: bigint) {
  return prisma.sale.delete({ where: { id } });
}

export async function countSales(options: { where?: { status?: SaleStatus; paymentConfirmed?: boolean } } = {}) {
  return prisma.sale.count(options);
}

export async function getPendingPayments() {
  return prisma.sale.findMany({
    where: { paymentConfirmed: false },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPaidSales() {
  return prisma.sale.findMany({
    where: { paymentConfirmed: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSalesByCustomer(customerId: bigint) {
  return prisma.sale.findMany({
    where: { customerId },
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSalesByUser(userId: bigint) {
  return prisma.sale.findMany({
    where: { userId },
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSaleForReceipt(saleId: bigint) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: { include: { product: true } },
      payment: true,
      assignedDriver: true,
      customer: true,
      user: true,
    },
  });
}

export async function getSalesWithAssignmentError() {
  return prisma.sale.findMany({
    where: {
      assignedDriverId: null,
      status: { in: ["payment_confirmed", "processing", "out_for_delivery"] },
    },
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function countSalesByStatus() {
  return prisma.sale.groupBy({
    by: ["status"],
    _count: { status: true },
  });
}
