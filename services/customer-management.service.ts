// Customer management service: customer profiles, loyalty, history.
//
// Ports Django `Customer` model and related views.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth/request";

export interface CustomerFindOptions {
  where?: Prisma.CustomerWhereInput;
  include?: Prisma.CustomerInclude;
  orderBy?: Prisma.CustomerOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export interface CustomerCreateInput {
  phone: string;
  userId: bigint;
}

export async function findCustomer(options: CustomerFindOptions) {
  return prisma.customer.findFirst(options);
}

export async function findCustomerById(id: bigint) {
  return prisma.customer.findUnique({
    where: { id },
    include: { user: true, sales: true },
  });
}

export async function findCustomerByUserId(userId: bigint) {
  return prisma.customer.findUnique({ where: { userId } });
}

export async function findCustomerByPhone(phone: string) {
  return prisma.customer.findFirst({ where: { phone } });
}

export async function findManyCustomers(options: CustomerFindOptions = {}) {
  return prisma.customer.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    ...options,
  });
}

export async function createCustomer(data: CustomerCreateInput) {
  return prisma.customer.create({ data });
}

export async function updateCustomer(id: bigint, data: Partial<CustomerCreateInput>) {
  return prisma.customer.update({ where: { id }, data });
}

export async function incrementLoyaltyPoints(customerId: bigint, points: number) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: { increment: points } },
  });
}

export async function decrementLoyaltyPoints(customerId: bigint, points: number) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: { decrement: points } },
  });
}

export async function resetLoyaltyPoints(customerId: bigint) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: 0 },
  });
}

export async function getCustomerWithSales(userId: bigint) {
  return prisma.customer.findUnique({
    where: { userId },
    include: { user: true, sales: { include: { items: true, payment: true } } },
  });
}

export async function getCustomerSalesWithHistory(customerId: bigint) {
  return prisma.sale.findMany({
    where: { customerId },
    include: { items: true, payment: true, assignedDriver: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function countCustomers(
  options: { where?: Prisma.CustomerWhereInput } = {},
) {
  return prisma.customer.count(options);
}
