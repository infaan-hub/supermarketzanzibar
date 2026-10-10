// User service: user CRUD, role/permission management, access windows.
//
// Ports Django `CustomUser` model and related views.

import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/request";

export type Role = "admin" | "supplier" | "driver" | "customer";

export interface UserFindOptions {
  where?: {
    id?: bigint;
    username?: string;
    email?: string;
    phone?: string;
    role?: Role;
    isActive?: boolean;
  };
  include?: {
    supplierProfile?: boolean;
    customerProfile?: boolean;
    assignedSales?: boolean;
    confirmedPayments?: boolean;
    ownSales?: boolean;
    refreshTokens?: boolean;
  };
  orderBy?: { id?: "asc" | "desc" };
  take?: number;
  skip?: number;
}

export interface UserCreateInput {
  username: string;
  email: string;
  phone: string;
  fullName: string;
  password: string;
  role?: Role;
  isActive?: boolean;
  address?: string | null;
  accessWindowStart?: Date | null;
  accessWindowEnd?: Date | null;
}

export async function findUser(options: UserFindOptions) {
  return prisma.user.findFirst(options);
}

export async function findUserById(id: bigint) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      supplierProfile: true,
      customerProfile: true,
      assignedSales: true,
      confirmedPayments: true,
      ownSales: true,
      refreshTokens: true,
    },
  });
}

export async function findUserByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserByPhone(phone: string) {
  return prisma.user.findUnique({ where: { phone } });
}

export async function findManyUsers(options: UserFindOptions = {}) {
  return prisma.user.findMany({
    include: {
      supplierProfile: true,
      customerProfile: true,
      assignedSales: true,
      confirmedPayments: true,
      ownSales: true,
      refreshTokens: true,
    },
    orderBy: { createdAt: "desc" },
    ...options,
  });
}

export async function createUser(data: UserCreateInput) {
  return prisma.user.create({ data });
}

export async function updateUser(id: bigint, data: Partial<UserCreateInput>) {
  return prisma.user.update({ where: { id }, data });
}

export async function deactivateUser(id: bigint) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function reactivateUser(id: bigint) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true },
  });
}

export async function deleteUser(id: bigint) {
  return prisma.user.delete({ where: { id } });
}

export async function countUsers(options: { where?: { isActive?: boolean; role?: Role } } = {}) {
  return prisma.user.count(options);
}

export async function countUsersByRole() {
  return prisma.user.groupBy({
    by: ["role"],
    _count: { id: true },
  });
}

export async function getUserWithScheduledAccess(user: CurrentUser) {
  return prisma.user.findUnique({
    where: { id: user.id },
    include: { supplierProfile: true, customerProfile: true },
  });
}
