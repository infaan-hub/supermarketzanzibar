// Immutable audit logging helper for sensitive inventory, POS, and twin actions.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface AuditInput {
  actorId?: bigint | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    // Never fail an already-committed business transaction if audit table isn't migrated yet.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return;
    }
    console.error("Audit log write failed:", error);
  }
}
