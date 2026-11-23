// GET /api/public/catalog — Public read-only product & category catalog for
// unauthenticated guest storefront visitors (`/`).
//
// Strictly omits sensitive fields (`costPrice`, supplier details, internal
// warehouse reserve counts, or customer PII).

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/http";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureDigitalTwinSchema().catch(() => undefined);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const categoryId = searchParams.get("categoryId")?.trim();
    const take = searchParams.get("take");

    const where: Prisma.ProductWhereInput = { isActive: true };
    if (categoryId && /^\d+$/.test(categoryId)) {
      where.categoryId = BigInt(categoryId);
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 120) : 60;

    const [products, categories, totalProducts] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          quantity: true,
          description: true,
          imageName: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ quantity: "desc" }, { name: "asc" }],
        take: takeNum,
      }),
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { products: { where: { isActive: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    return json({
      store: {
        name: "Supermarket Zanzibar",
        location: "Stone Town, Zanzibar",
        currency: "TZS",
        totalProducts,
      },
      categories: categories.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        description: c.description,
        productCount: c._count.products,
      })),
      products: products.map((p) => {
        const stockStatus =
          p.quantity <= 0
            ? "out_of_stock"
            : p.quantity <= LOW_STOCK_THRESHOLD
              ? "low_stock"
              : "in_stock";
        return {
          id: p.id.toString(),
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          inStock: p.quantity > 0,
          stockStatus,
          availableQuantity: p.quantity > 0 ? Math.min(p.quantity, 50) : 0,
          description: p.description,
          imageAvailable: Boolean(p.imageName),
          imageUrl: p.imageName
            ? `/api/public/products/${p.id.toString()}/image?v=${p.updatedAt.getTime()}`
            : null,
          category: p.category
            ? { id: p.category.id.toString(), name: p.category.name }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Public catalog load failed:", error);
    return serverError("Unable to load storefront catalog.");
  }
}
