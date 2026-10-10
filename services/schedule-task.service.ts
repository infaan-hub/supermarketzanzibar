// Schedule-task service: scheduled access tasks, driver assignments.
//
// Ports Django `schedule_access` functionality and task scheduling.

import { prisma } from "@/lib/db";
import { scheduleStatus, hasActiveScheduledAccess } from "@/lib/auth/schedule";
import type { CurrentUser } from "@/lib/auth/request";

export interface ScheduledAccess {
  id: bigint;
  role: string;
  accessWindowStart: Date | null;
  accessWindowEnd: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskOptions {
  where?: {
    userId?: bigint;
    role?: string;
    isActive?: boolean;
  };
  orderBy?: { createdAt?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export async function listScheduledAccess(requester: CurrentUser) {
  const users = await prisma.user.findMany({
    where: { role: { in: ["supplier", "driver"] }, isActive: true },
    include: { supplierProfile: true, customerProfile: true },
  });

  return users.map((user) => ({
    ...user,
    schedule_status: scheduleStatus({ role: user.role, accessWindowStart: user.accessWindowStart, accessWindowEnd: user.accessWindowEnd }),
    has_active_scheduled_access: hasActiveScheduledAccess({ role: user.role, accessWindowStart: user.accessWindowStart, accessWindowEnd: user.accessWindowEnd }),
  }));
}

export async function countScheduledAccess(options: TaskOptions = {}) {
  return prisma.user.count(options);
}

export async function getUpcomingAccessWindows() {
  const now = new Date();
  return prisma.user.findMany({
    where: {
      role: { in: ["supplier", "driver"] },
      isActive: true,
      accessWindowStart: { not: null, lte: now },
      accessWindowEnd: { not: null, gt: now },
    },
    include: { supplierProfile: true, customerProfile: true },
  });
}

export async function getExpiredAccessWindows() {
  const now = new Date();
  return prisma.user.findMany({
    where: {
      role: { in: ["supplier", "driver"] },
      isActive: true,
      accessWindowStart: { not: null },
      accessWindowEnd: { not: null, lte: now },
    },
    include: { supplierProfile: true, customerProfile: true },
  });
}

export async function getAccessWindowConflicts(role: string, start: Date, end: Date) {
  return prisma.user.findMany({
    where: {
      role,
      isActive: true,
      accessWindowStart: { not: null },
      accessWindowEnd: { not: null },
      OR: [
        { accessWindowStart: { lte: start } },
        { accessWindowEnd: { gt: end } },
      ],
    },
  });
}

export async function assignAccessWindow(
  userId: bigint,
  start: Date,
  end: Date,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { accessWindowStart: start, accessWindowEnd: end },
  });
}

export async function clearAccessWindow(userId: bigint) {
  return prisma.user.update({
    where: { id: userId },
    data: { accessWindowStart: null, accessWindowEnd: null },
  });
}
