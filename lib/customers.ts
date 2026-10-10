// Customer library: customer queries for the API routes.
// The customer API exposes User fields (fullName, email, address, isActive)
// alongside Customer model fields (id, phone, createdAt).

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface CustomerFindOptions {
  where?: Prisma.UserWhereInput;
  select?: Prisma.UserSelect;
  orderBy?: Prisma.UserOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export async function findManyCustomers(options: CustomerFindOptions = {}) {
  const { where, select, orderBy, take, skip } = options;
  return prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
      ...select,
    },
    where,
    orderBy,
    take,
    skip,
  });
}

export async function countCustomers(where?: Prisma.UserWhereInput) {
  return prisma.user.count({ where });
}