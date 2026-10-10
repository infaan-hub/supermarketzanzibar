// Supplier management service: supplier permissions, product imports.
//
// Ports Django `Supplier` management views and product import logic.

import { prisma } from "@/lib/db";
import { countProducts } from "./product.service";

export interface SupplierProductImportInput {
  supplierId: bigint;
  products: {
    name: string;
    slug: string;
    price: string;
    costPrice: string;
    quantity: number;
    barcode: string;
    description?: string;
  }[];
}

export async function importProductsForSupplier(data: SupplierProductImportInput) {
  const { supplierId, products } = data;

  const created = await Promise.all(
    products.map(async (p) => {
      const slug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const existing = await prisma.product.findUnique({ where: { barcode: p.barcode } });

      if (existing) return null;

      return prisma.product.create({
        data: {
          name: p.name,
          slug,
          price: p.price,
          costPrice: p.costPrice,
          quantity: p.quantity,
          barcode: p.barcode,
          description: p.description ?? "",
          supplierId,
          isActive: true,
        },
      });
    }),
  );

  const validCreated = created.filter((p): p is { id: bigint } => p !== null);

  return {
    supplierId,
    createdCount: validCreated.length,
    skippedCount: products.length - validCreated.length,
    products: validCreated,
  };
}

export async function getSupplierProducts(supplierId: bigint) {
  return prisma.product.findMany({
    where: { supplierId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getSupplierSales(supplierId: bigint) {
  return prisma.sale.findMany({
    where: { paymentConfirmed: true },
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
  });
}
