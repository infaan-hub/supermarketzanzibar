// User library: user queries for the API routes.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface UserFindOptions {
  where?: Prisma.UserWhereInput;
  select?: Prisma.UserSelect;
  orderBy?: Prisma.UserOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export async function findManyUsers(options: UserFindOptions = {}) {
  const { where, select, orderBy, take, skip } = options;
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
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

export async function countUsers(where?: Prisma.UserWhereInput) {
  return prisma.user.count({ where });
}