// GET  /api/departments — List store departments with live shelf & stock rollups.
// POST /api/departments — Create a department in PostgreSQL (manager/admin).

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireExplorer, requireManager } from "@/lib/auth/request";
import {
  badRequest,
  conflict,
  created,
  json,
  serverError,
  serviceUnavailable,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import {
  DEFAULT_STORE_CODE,
  isMissingTwinTables,
} from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

const createDeptSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be 2-12 characters.")
    .max(12)
    .regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, hyphens, or underscores."),
  name: z.string().trim().min(2, "Department name is required.").max(120),
  description: z.string().trim().max(500).optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  try {
    const departments = await prisma.department.findMany({
      include: {
        store: { select: { id: true, name: true, code: true } },
        shelves: {
          include: {
            positions: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                reorderLevel: true,
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    return json({
      departments: departments.map((dept) => {
        const allPositions = dept.shelves.flatMap((s) => s.positions);
        const assigned = allPositions.filter((p) => p.productId !== null);
        const totalUnits = allPositions.reduce((sum, p) => sum + p.quantity, 0);
        const lowStockCount = assigned.filter(
          (p) => p.quantity > 0 && p.quantity <= p.reorderLevel,
        ).length;
        const outOfStockCount = assigned.filter((p) => p.quantity <= 0).length;

        return {
          id: dept.id,
          storeId: dept.storeId,
          storeName: dept.store.name,
          code: dept.code,
          name: dept.name,
          description: dept.description,
          status: dept.status,
          shelvesCount: dept.shelves.length,
          productCount: assigned.length,
          totalUnits,
          lowStockCount,
          outOfStockCount,
          createdAt: dept.createdAt,
          updatedAt: dept.updatedAt,
        };
      }),
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return json({ departments: [], migrationRequired: true });
    }
    console.error("List departments failed:", error);
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

  const parsed = createDeptSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const code = parsed.data.code.toUpperCase();

  try {
    let store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
    if (!store) {
      store = await prisma.store.create({
        data: {
          code: DEFAULT_STORE_CODE,
          name: "Supermarket Zanzibar — Flagship",
          address: "Stone Town Main Road, Zanzibar",
          location: "Zanzibar, Tanzania",
          status: "active",
        },
      });
    }

    const existing = await prisma.department.findUnique({
      where: { storeId_code: { storeId: store.id, code } },
    });
    if (existing) {
      return conflict(`Department code "${code}" already exists.`);
    }

    const dept = await prisma.department.create({
      data: {
        storeId: store.id,
        code,
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status,
      },
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "DEPARTMENT_CREATED",
      entityType: "DEPARTMENT",
      entityId: dept.id,
      summary: `Created department ${dept.code} (${dept.name}).`,
    });

    publishInventoryEvent({
      type: "shelf_updated",
      summary: `Added department ${dept.name}`,
    });

    return created({ department: dept });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable("Run `npx prisma migrate deploy` first.");
    }
    console.error("Create department failed:", error);
    return serverError("Unable to create department.");
  }
}
