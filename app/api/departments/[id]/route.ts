// PATCH /api/departments/[id] — Update department name, description, or status.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth/request";
import {
  badRequest,
  json,
  notFound,
  serverError,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";

const patchDeptSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("A valid JSON body is required.");
  }

  const parsed = patchDeptSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  try {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return notFound("Department not found.");

    const updated = await prisma.department.update({
      where: { id },
      data: parsed.data,
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "DEPARTMENT_UPDATED",
      entityType: "DEPARTMENT",
      entityId: updated.id,
      summary: `Updated department ${updated.code} (${updated.name}).`,
    });

    publishInventoryEvent({
      type: "shelf_updated",
      summary: `Updated department ${updated.name}`,
    });

    return json({ department: updated });
  } catch (error) {
    console.error("Update department failed:", error);
    return serverError("Unable to update department.");
  }
}
