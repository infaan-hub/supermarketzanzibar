// GET /api/categories - List categories.
//
// Returns category groups for filtering and display.

import { NextResponse } from "next/server";
import { findManyCategories, countCategories } from "@/lib/categories";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.CategoryWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [categories, total] = await Promise.all([
      findManyCategories({
        where,
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
        orderBy: { name: "asc" },
      }),
      countCategories({ where }),
    ]);

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        description: c.description,
        image_available: false,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.ceil(total / takeNum),
      },
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
