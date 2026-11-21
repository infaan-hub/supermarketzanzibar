// GET /api/products/categories - List all product categories with product counts.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/request";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });

    return json({
      categories: categories.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        description: c.description,
        productCount: c._count.products,
        image_available: false,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        total: categories.length,
        page: 1,
        take: categories.length || 20,
        pages: 1,
      },
    });
  } catch (error) {
    console.error("List product categories failed:", error);
    return serverError();
  }
}
