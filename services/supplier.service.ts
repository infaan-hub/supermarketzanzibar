// Supplier service: supplier CRUD, supplier relations.
//
// Ports Django `Supplier` model and related views.

import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/request";

export interface SupplierFindOptions {
  where?: {
    id?: bigint;
    userId?: bigint;
  };
  include?: {
    user?: boolean;
    products?: boolean;
  };
  orderBy?: { id?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export interface SupplierCreateInput {
  companyName: string;
  phone: string;
  address?: string;
  userId?: bigint;
}

export async function findSupplier(options: SupplierFindOptions) {
  return prisma.supplier.findFirst(options);
}

export async function findSupplierById(id: bigint) {
  return prisma.supplier.findUnique({
    where: { id },
    include: { user: true, products: true },
  });
}

export async function findSupplierByUserId(userId: bigint) {
  return prisma.supplier.findUnique({ where: { userId } });
}

export async function findSupplierByCompanyName(companyName: string) {
  return prisma.supplier.findUnique({ where: { companyName } });
}

export async function findManySuppliers(options: SupplierFindOptions = {}) {
  return prisma.supplier.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    ...options,
  });
}

export async function createSupplier(data: SupplierCreateInput) {
  return prisma.supplier.create({ data });
}

export async function updateSupplier(id: bigint, data: Partial<SupplierCreateInput>) {
  return prisma.supplier.update({ where: { id }, data });
}

export async function deleteSupplier(id: bigint) {
  return prisma.supplier.delete({ where: { id } });
}

export async function countSuppliers(options: { where?: { isActive?: boolean } } = {}) {
  return prisma.supplier.count(options);
}

export async function getSuppliersWithProductCount() {
  const suppliers = await prisma.supplier.findMany({
    include: {
      products: {
        select: { id: true },
        where: { isActive: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return suppliers.map((s) => ({
    ...s,
    productCount: s.products.length,
  }));
}

export async function getSuppliersWithProducts() {
  return prisma.supplier.findMany({
    where: { products: { some: { isActive: true } } },
    include: { products: true },
    orderBy: { companyName: "asc" },
  });
}
