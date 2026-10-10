// Product library: product queries for the API routes.

import { prisma } from "@/lib/db";

export interface ProductFindOptions {
  where?: {
    id?: bigint;
    categoryId?: bigint;
    supplierId?: bigint;
    isActive?: boolean;
    slug?: string;
    barcode?: string;
  };
  orderBy?: { id?: "asc" | "desc"; name?: "asc" | "desc"; createdAt?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export async function getProductById(id: bigint) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true, supplier: true },
  });
}

export async function getProductsByCategory(categoryId: bigint) {
  return prisma.product.findMany({
    where: { categoryId, isActive: true },
    include: { category: true, supplier: true },
    orderBy: { name: "asc" },
  });
}

export async function findManyProducts(options: ProductFindOptions = {}) {
  const { where, orderBy, take, skip } = options;
  return prisma.product.findMany({
    include: { category: true, supplier: true },
    where,
    orderBy,
    take,
    skip,
  });
}

export async function countProducts(
  where: ProductFindOptions["where"] = {},
) {
  return prisma.product.count({ where });
}