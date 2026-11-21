// PATCH  /api/categories/[id] - Update a category (manager/admin).
// DELETE /api/categories/[id] - Delete a category (manager/admin).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  badRequest,
  json,
  notFound,
  serverError,
  validationError,
} from "@/lib/http";
import { requireManager } from "@/lib/auth/request";

function parseId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const categoryId = parseId(id);
  if (!categoryId) return badRequest("Invalid category ID.");

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const data: Prisma.CategoryUpdateInput = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return validationError({ name: ["Category name is required."] });
    if (name.length > 200) {
      return validationError({ name: ["Category name must be 200 characters or fewer."] });
    }
    data.name = name;
  }
  if (body.description !== undefined) {
    data.description =
      typeof body.description === "string" ? body.description.trim() : "";
  }

  try {
    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
      include: { _count: { select: { products: true } } },
    });

    return json({
      id: updated.id.toString(),
      name: updated.name,
      description: updated.description,
      productCount: updated._count.products,
      image_available: false,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound("Category not found.");
    }
    console.error("Update category failed:", error);
    return serverError("Unable to update category.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const categoryId = parseId(id);
  if (!categoryId) return badRequest("Invalid category ID.");

  try {
    // Detach any products pointing to this category before removing it.
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { categoryId },
        data: { categoryId: null },
      }),
      prisma.category.delete({ where: { id: categoryId } }),
    ]);

    return json({ detail: "Category deleted." });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound("Category not found.");
    }
    console.error("Delete category failed:", error);
    return serverError("Unable to delete category.");
  }
}
