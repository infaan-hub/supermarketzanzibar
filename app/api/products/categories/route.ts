// GET /api/products/categories - List all product categories.
//
// Used by the product picker and category filter.

import { NextResponse } from "next/server";
import { findManyCategories, countCategories } from "@/lib/categories";

export async function GET() {
  try {
    const [categories, total] = await Promise.all([
      findManyCategories({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      countCategories({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        description: c.description,
        image_available: Boolean(c.imageData),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: { total, page: 1, take: categories.length, pages: 1 },
    });
  } catch (error) {
    console.error("List categories failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { detail: "Use the admin dashboard to manage categories." },
    { status: 403 },
  );
}
