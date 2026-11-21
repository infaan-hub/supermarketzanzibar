// Request authentication & RBAC guards shared by all protected Route Handlers.

import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessToken, type Role } from "@/lib/auth/jwt";
import {
  ADMIN_ROLES,
  EXPLORE_ROLES,
  INVENTORY_ROLES,
  MANAGER_ROLES,
  POS_ROLES,
  STAFF_ROLES,
  normalizeRole,
} from "@/lib/auth/roles";
import {
  hasActiveScheduledAccess,
  scheduledAccessDenialDetail,
} from "@/lib/auth/schedule";
import { forbidden, unauthorized } from "@/lib/http";

export interface CurrentUser {
  id: bigint;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  address: string | null;
  role: string;
  isActive: boolean;
  accessWindowStart: Date | null;
  accessWindowEnd: Date | null;
}

export type AuthResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; error: string; expired: boolean };

export type GuardResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse };

export function extractBearerToken(req: Request | NextRequest): string | null {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function authenticateTokenString(
  token: string | null | undefined,
): Promise<AuthResult> {
  if (!token || !token.trim()) {
    return {
      ok: false,
      error: "Authentication credentials were not provided.",
      expired: false,
    };
  }

  let claims;
  try {
    claims = await verifyAccessToken(token.trim());
  } catch (err) {
    const expired =
      err instanceof Error && (err as { code?: string }).code === "expired";
    return {
      ok: false,
      error: expired ? "Token has expired." : "Invalid token.",
      expired,
    };
  }

  let id: bigint;
  try {
    id = BigInt(claims.sub);
  } catch {
    return { ok: false, error: "Invalid token.", expired: false };
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    return { ok: false, error: "User not found or inactive.", expired: false };
  }

  return { ok: true, user: toCurrentUser(user) };
}

export async function authenticate(
  req: Request | NextRequest,
): Promise<AuthResult> {
  return authenticateTokenString(extractBearerToken(req));
}

export async function requireAuth(
  req: Request | NextRequest,
): Promise<GuardResult> {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return { ok: false, response: unauthorized(auth.error) };
  }
  return { ok: true, user: auth.user };
}

export async function requireRoles(
  req: Request | NextRequest,
  roles: readonly string[],
  forbiddenDetail = "You do not have permission to perform this action.",
): Promise<GuardResult> {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return { ok: false, response: unauthorized(auth.error) };
  }
  const normalized = normalizeRole(auth.user.role);
  if (!roles.includes(normalized)) {
    return { ok: false, response: forbidden(forbiddenDetail) };
  }
  return { ok: true, user: auth.user };
}

export function requireExplorer(
  req: Request | NextRequest,
): Promise<GuardResult> {
  return requireRoles(
    req,
    EXPLORE_ROLES,
    "Authorized store viewer or staff access is required.",
  );
}

export function requireStaff(req: Request | NextRequest): Promise<GuardResult> {
  return requireRoles(
    req,
    STAFF_ROLES,
    "Staff access is required for this operation.",
  );
}

export function requirePos(req: Request | NextRequest): Promise<GuardResult> {
  return requireRoles(
    req,
    POS_ROLES,
    "Cashier, manager, or administrator permission is required for POS.",
  );
}

export function requireInventory(
  req: Request | NextRequest,
): Promise<GuardResult> {
  return requireRoles(
    req,
    INVENTORY_ROLES,
    "Inventory staff, manager, or administrator permission is required.",
  );
}

export function requireManager(
  req: Request | NextRequest,
): Promise<GuardResult> {
  return requireRoles(
    req,
    MANAGER_ROLES,
    "Manager or administrator permission is required.",
  );
}

export function requireAdmin(req: Request | NextRequest): Promise<GuardResult> {
  return requireRoles(
    req,
    ADMIN_ROLES,
    "Administrator permission is required.",
  );
}

export function toCurrentUser(user: {
  id: bigint;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  address: string | null;
  role: string;
  isActive: boolean;
  accessWindowStart: Date | null;
  accessWindowEnd: Date | null;
}): CurrentUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    address: user.address,
    role: user.role,
    isActive: user.isActive,
    accessWindowStart: user.accessWindowStart,
    accessWindowEnd: user.accessWindowEnd,
  };
}

export function hasRole(user: CurrentUser | null, ...roles: Role[]): boolean {
  if (!user) return false;
  const normalized = normalizeRole(user.role);
  return roles.some((r) => normalizeRole(r) === normalized);
}

export function scheduledAccessOk(user: CurrentUser): boolean {
  return hasActiveScheduledAccess(user);
}

export function scheduledAccessDetail(user: CurrentUser): string {
  return scheduledAccessDenialDetail(user);
}
