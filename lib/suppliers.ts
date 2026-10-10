// Supplier library: supplier queries for the API routes.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface SupplierFindOptions {
  where?: Prisma.SupplierWhereInput;
  orderBy?: Prisma.SupplierOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export async function findManySuppliers(options: SupplierFindOptions = {}) {
  const { where, orderBy, take, skip } = options;
  const suppliers = await prisma.supplier.findMany({
    include: { user: true },
    where,
    orderBy: orderBy ?? { createdAt: "desc" },
    take,
    skip,
  });

  return suppliers.map((s) => ({
    id: s.id,
    companyName: s.companyName,
    contactName: s.user.fullName,
    phone: s.phone,
    email: s.user.email,
    address: s.address,
    isActive: s.user.isActive,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function countSuppliers(where?: Prisma.SupplierWhereInput) {
  return prisma.supplier.count({ where });
}