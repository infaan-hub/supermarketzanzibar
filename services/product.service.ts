// Product service: product CRUD, stock management, barcode search.
//
// Ports Django `Product` model and related views.

import { prisma } from "@/lib/db";

export interface ProductFindOptions {
  where?: {
    id?: bigint;
    categoryId?: bigint;
    supplierId?: bigint;
    isActive?: boolean;
    categoryId_not?: bigint;
  };
  select?: {
    id?: boolean;
    name?: boolean;
    slug?: boolean;
    price?: boolean;
    quantity?: boolean;
    barcode?: boolean;
    description?: boolean;
    isActive?: boolean;
    categoryId?: boolean;
    supplierId?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };
  orderBy?: { id?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export interface ProductCreateInput {
  name: string;
  slug: string;
  categoryId?: bigint | null;
  supplierId?: bigint | null;
  price: string;
  costPrice: string;
  quantity: number;
  barcode: string;
  description?: string;
  isActive?: boolean;
}

export async function findProduct(options: ProductFindOptions) {
  return prisma.product.findFirst(options);
}

export async function findProductById(id: bigint) {
  return prisma.product.findUnique({ where: { id }, include: { category: true, supplier: true } });
}

export async function findUniqueProductByBarcode(barcode: string) {
  return prisma.product.findUnique({ where: { barcode } });
}

export async function findUniqueProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug } });
}

export async function findManyProducts(options: ProductFindOptions = {}) {
  return prisma.product.findMany({
    include: { category: true, supplier: true },
    orderBy: { createdAt: "desc" },
    ...options,
  });
}

export async function createProduct(data: ProductCreateInput) {
  return prisma.product.create({ data });
}

export async function updateProduct(id: bigint, data: Partial<ProductCreateInput>) {
  return prisma.product.update({ where: { id }, data });
}

export async function deleteProduct(id: bigint) {
  return prisma.product.delete({ where: { id } });
}

export async function incrementStock(id: bigint, quantity: number) {
  return prisma.product.update({
    where: { id },
    data: { quantity: { increment: quantity } },
  });
}

export async function decrementStock(id: bigint, quantity: number) {
  return prisma.product.update({
    where: { id },
    data: { quantity: { decrement: quantity } },
  });
}

export async function getStockLevelByBarcode(barcode: string) {
  const product = await prisma.product.findUnique({ where: { barcode } });
  return product ? product.quantity : null;
}

export async function getStockLevelsByProductIds(ids: bigint[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, quantity: true },
  });
  const map = new Map(products.map((p) => [p.id, p.quantity]));
  return ids.map((id) => ({ productId: id, quantity: map.get(id) ?? 0 }));
}

export async function countProducts(options: { where?: { isActive?: boolean; categoryId?: bigint } } = {}) {
  return prisma.product.count(options);
}

export async function getProductsForSale() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}
