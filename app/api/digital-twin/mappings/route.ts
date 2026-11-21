// GET  /api/digital-twin/mappings — List persistent 3D object mappings & GLB assets.
// POST /api/digital-twin/mappings — Create or update a 3D object mapping (Phase 7).

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireExplorer, requireManager } from "@/lib/auth/request";
import {
  badRequest,
  json,
  serverError,
  serviceUnavailable,
  validationError,
} from "@/lib/http";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import { isMissingTwinTables } from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

const mappingSchema = z.object({
  objectName: z.string().trim().min(2).max(160),
  objectType: z.string().trim().min(2).max(60),
  linkedEntityType: z.string().trim().min(2).max(60),
  linkedEntityId: z.string().trim().min(1).max(120),
  assetKey: z.string().trim().optional().nullable(),
  position: z.tuple([z.number(), z.number(), z.number()]).optional(),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  scale: z.tuple([z.number(), z.number(), z.number()]).optional(),
});

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  try {
    const [mappings, assets] = await Promise.all([
      prisma.threeDObjectMapping.findMany({
        include: { asset: true },
        orderBy: { objectName: "asc" },
      }),
      prisma.threeDAsset.findMany({ orderBy: { assetKey: "asc" } }),
    ]);

    return json({
      mappings: mappings.map((m) => ({
        id: m.id,
        objectName: m.objectName,
        objectType: m.objectType,
        linkedEntityType: m.linkedEntityType,
        linkedEntityId: m.linkedEntityId,
        assetKey: m.asset?.assetKey ?? null,
        assetPath: m.asset?.filePath ?? null,
        position: [m.posX, m.posY, m.posZ],
        rotation: [m.rotX, m.rotY, m.rotZ],
        scale: [m.scaleX, m.scaleY, m.scaleZ],
        updatedAt: m.updatedAt,
      })),
      assets: assets.map((a) => ({
        id: a.id,
        assetKey: a.assetKey,
        assetName: a.assetName,
        assetType: a.assetType,
        filePath: a.filePath,
        format: a.format,
        version: a.version,
      })),
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return json({ mappings: [], assets: [] });
    }
    console.error("List 3D mappings failed:", error);
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

  const parsed = mappingSchema.safeParse(raw);
  if (!parsed.success) {
    return validationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const data = parsed.data;

  try {
    let assetId: string | null = null;
    if (data.assetKey) {
      const asset = await prisma.threeDAsset.findUnique({
        where: { assetKey: data.assetKey },
        select: { id: true },
      });
      assetId = asset?.id ?? null;
    }

    const pos = data.position ?? [0, 0, 0];
    const rot = data.rotation ?? [0, 0, 0];
    const scale = data.scale ?? [1, 1, 1];

    const mapping = await prisma.threeDObjectMapping.upsert({
      where: { objectName: data.objectName },
      update: {
        objectType: data.objectType,
        linkedEntityType: data.linkedEntityType,
        linkedEntityId: data.linkedEntityId,
        assetId,
        posX: pos[0],
        posY: pos[1],
        posZ: pos[2],
        rotX: rot[0],
        rotY: rot[1],
        rotZ: rot[2],
        scaleX: scale[0],
        scaleY: scale[1],
        scaleZ: scale[2],
      },
      create: {
        objectName: data.objectName,
        objectType: data.objectType,
        linkedEntityType: data.linkedEntityType,
        linkedEntityId: data.linkedEntityId,
        assetId,
        posX: pos[0],
        posY: pos[1],
        posZ: pos[2],
        rotX: rot[0],
        rotY: rot[1],
        rotZ: rot[2],
        scaleX: scale[0],
        scaleY: scale[1],
        scaleZ: scale[2],
      },
      include: { asset: true },
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "THREED_MAPPING_UPSERT",
      entityType: "THREE_D_MAPPING",
      entityId: mapping.id,
      summary: `Mapped 3D object ${mapping.objectName} -> ${mapping.linkedEntityType}:${mapping.linkedEntityId}`,
    });

    publishInventoryEvent({
      type: "shelf_updated",
      summary: `Updated 3D mapping ${mapping.objectName}`,
    });

    return json({
      id: mapping.id,
      objectName: mapping.objectName,
      objectType: mapping.objectType,
      linkedEntityType: mapping.linkedEntityType,
      linkedEntityId: mapping.linkedEntityId,
      assetPath: mapping.asset?.filePath ?? null,
    });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      return serviceUnavailable("Run `npx prisma migrate deploy` first.");
    }
    console.error("Upsert 3D mapping failed:", error);
    return serverError("Unable to save 3D object mapping.");
  }
}
