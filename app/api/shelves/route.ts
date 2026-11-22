// GET  /api/shelves — List all retail shelves and their product positions.
// POST /api/shelves — Create a new shelf fixture with default slots (manager/admin).

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireExplorer, requireManager } from "@/lib/auth/request";
import {
  badRequest,
  conflict,
  created,
  json,
  notFound,
  serverError,
  serviceUnavailable,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import { isMissingTwinTables } from "@/services/digital-twin.service";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";

export const dynamic = "force-dynamic";

const createShelfSchema = z.object({
  departmentId: z.string().trim().min(1, "Select a department."),
  shelfCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores."),
  shelfName: z.string().trim().min(2).max(120),
  fixtureKind: z
    .enum([
      "gondola",
      "double_gondola",
      "beverage_rack",
      "refrigerator",
      "freezer",
      "bakery_case",
      "cosmetics_display",
      "produce_island",
      "electronics_case",
    ])
    .optional()
    .default("gondola"),
  capacity: z.coerce.number().int().min(1).max(5000).optional().default(180),
  slotCount: z.coerce.number().int().min(1).max(12).optional().default(6),
});

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const departmentCode = searchParams.get("department")?.trim().toUpperCase();

  try {
    const shelves = await prisma.shelf.findMany({
      where: departmentCode
        ? { department: { code: departmentCode } }
        : undefined,
      include: {
        department: { select: { id: true, code: true, name: true } },
        positions: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                price: true,
                quantity: true,
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { slotIndex: "asc" },
        },
      },
      orderBy: { shelfCode: "asc" },
    });

    return json({
      shelves: shelves.map((s) => ({
        id: s.id,
        shelfCode: s.shelfCode,
        shelfName: s.shelfName,
        fixtureKind: s.fixtureKind,
        capacity: s.capacity,
        status: s.status,
        department: s.department,
        totalUnits: s.positions.reduce((sum, p) => sum + p.quantity, 0),
        positions: s.positions.map((p) => ({
          id: p.id,
          positionCode: p.positionCode,
          slotIndex: p.slotIndex,
          quantity: p.quantity,
          maximumCapacity: p.maximumCapacity,
          reservedQuantity: p.reservedQuantity,
          reorderLevel: p.reorderLevel,
          product: p.product
            ? {
                id: p.product.id.toString(),
                name: p.product.name,
                sku: p.product.sku,
                barcode: p.product.barcode,
                price: Number(p.product.price),
                totalStock: p.product.quantity,
                categoryName: p.product.category?.name ?? null,
              }
            : null,
        })),
      })),
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return json({ shelves: [], migrationRequired: true });
    }
    console.error("List shelves failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("A valid JSON body is required.");
  }

  const parsed = createShelfSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    await ensureDigitalTwinSchema();
    const dept = await prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
      select: { id: true, storeId: true, code: true, name: true },
    });
    if (!dept) return notFound("Department not found.");

    const shelfCode = parsed.data.shelfCode.toUpperCase();
    const existing = await prisma.shelf.findUnique({
      where: {
        storeId_shelfCode: { storeId: dept.storeId, shelfCode },
      },
    });
    if (existing) {
      return conflict(`Shelf "${shelfCode}" already exists.`);
    }

    const shelf = await prisma.$transaction(async (tx) => {
      const createdShelf = await tx.shelf.create({
        data: {
          storeId: dept.storeId,
          departmentId: dept.id,
          shelfCode,
          shelfName: parsed.data.shelfName,
          fixtureKind: parsed.data.fixtureKind,
          capacity: parsed.data.capacity,
          status: "active",
        },
      });

      for (let i = 0; i < parsed.data.slotCount; i += 1) {
        await tx.shelfPosition.create({
          data: {
            shelfId: createdShelf.id,
            positionCode: `POS_${String(i + 1).padStart(2, "0")}`,
            slotIndex: i,
            quantity: 0,
            maximumCapacity: Math.max(
              12,
              Math.floor(parsed.data.capacity / parsed.data.slotCount),
            ),
            reorderLevel: 6,
          },
        });
      }

      return createdShelf;
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "SHELF_CREATED",
      entityType: "SHELF",
      entityId: shelf.id,
      summary: `Created shelf ${shelf.shelfCode} in ${dept.name}.`,
    });

    publishInventoryEvent({
      type: "shelf_updated",
      shelfId: shelf.id,
      shelfCode: shelf.shelfCode,
      summary: `Added shelf ${shelf.shelfCode}`,
    });

    return created({ shelf });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable("Run `npx prisma migrate deploy` first.");
    }
    console.error("Create shelf failed:", error);
    return serverError("Unable to create shelf.");
  }
}
