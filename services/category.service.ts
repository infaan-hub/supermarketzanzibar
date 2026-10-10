// Category service: category CRUD.
//
// Ports Django `Category` model and related views.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface CategoryFindOptions {
  where?: Prisma.CategoryWhereInput;
  include?: Prisma.CategoryInclude;
  orderBy?: Prisma.CategoryOrderByWithRelationInput;
  take?: number;
  skip?: number;
}

export interface CategoryCreateInput {
  name: string;
  description?: string;
}

export async function findCategory(options: CategoryFindOptions) {
  return prisma.category.findFirst(options);
}

export async function findCategoryById(id: bigint) {
  return prisma.category.findUnique({
    where: { id },
    include: { products: true },
  });
}

export async function findCategoryByName(name: string) {
  return prisma.category.findFirst({ where: { name } });
}

export async function findManyCategories(options: CategoryFindOptions = {}) {
  return prisma.category.findMany({
    include: { products: true },
    orderBy: { name: "asc" },
    ...options,
  });
}

export async function createCategory(data: CategoryCreateInput) {
  return prisma.category.create({ data });
}

export async function updateCategory(id: bigint, data: Partial<CategoryCreateInput>) {
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: bigint) {
  return prisma.category.delete({ where: { id } });
}

export async function countCategories(
  options: { where?: Prisma.CategoryWhereInput } = {},
) {
  return prisma.category.count(options);
}

export async function getCategoriesWithProductCount() {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        select: { id: true },
        where: { isActive: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return categories.map((c) => ({
    ...c,
    productCount: c.products.length,
  }));
}
