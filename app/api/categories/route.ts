// GET  /api/categories - List categories with product counts.
// POST /api/categories - Create a new category (marketmaster/manager/admin).

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, created, json, serverError, validationError } from "@/lib/http";
import { requireExplorer, requireProductManager } from "@/lib/auth/request";

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.CategoryWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 100) : 50;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        include: { _count: { select: { products: true } } },
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
        orderBy: { name: "asc" },
      }),
      prisma.category.count({ where }),
    ]);

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
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.max(1, Math.ceil(total / takeNum)),
      },
    });
  } catch (error) {
    console.error("List categories failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireProductManager(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("A JSON body is required.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("A JSON body is required.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!name) return validationError({ name: ["Category name is required."] });
  if (name.length > 200) {
    return validationError({ name: ["Category name must be 200 characters or fewer."] });
  }

  try {
    const category = await prisma.category.create({
      data: { name, description },
    });

    return created({
      id: category.id.toString(),
      name: category.name,
      description: category.description,
      productCount: 0,
      image_available: false,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (error) {
    console.error("Create category failed:", error);
    return serverError("Unable to create category.");
  }
}
