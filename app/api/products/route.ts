// GET /api/products - List products.
//
// Returns active products with basic info for display.

import { NextResponse } from "next/server";
import { findManyProducts, countProducts } from "@/lib/products";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where = {
      isActive: true,
      ...(categoryId ? { categoryId: BigInt(categoryId) } : {}),
    };

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [products, total] = await Promise.all([
      findManyProducts({
        where,
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      countProducts(where),
    ]);

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id.toString(),
        name: p.name,
        slug: p.slug,
        price: p.price,
        quantity: p.quantity,
        barcode: p.barcode,
        description: p.description,
        category: p.category
          ? { id: p.category.id.toString(), name: p.category.name }
          : null,
        supplier: p.supplier
          ? { id: p.supplier.id.toString(), companyName: p.supplier.companyName }
          : null,
        image_available: Boolean(p.imageData),
        createdAt: p.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.ceil(total / takeNum),
      },
    });
  } catch (error) {
    console.error("List products failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { detail: "Use the admin dashboard to create products." },
    { status: 403 },
  );
}
