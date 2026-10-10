// Category library: category queries for the API routes.
// Provides the functions used by the categories API route.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface CategoryFindOptions {
  where?: Prisma.CategoryWhereInput;
  include?: Prisma.CategoryInclude;
  orderBy?: Prisma.CategoryOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export interface CategoryCountOptions {
  where?: Prisma.CategoryWhereInput;
}

export async function findManyCategories(options: CategoryFindOptions = {}) {
  return prisma.category.findMany({
    include: { products: true },
    orderBy: { name: "asc" },
    ...options,
  });
}

export async function countCategories(options: CategoryCountOptions = {}) {
  return prisma.category.count(options);
}

export async function getCategoryById(id: bigint) {
  return prisma.category.findUnique({ where: { id } });
}