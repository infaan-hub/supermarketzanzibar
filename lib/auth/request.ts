// Request authentication helpers shared by all protected Route Handlers.
//
// Parses `Authorization: Bearer <access>`, verifies the token, loads the user,
// and provides role/permission guards. Secrets and hashes are never exposed.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessToken, type Role } from "@/lib/auth/jwt";
import {
  hasActiveScheduledAccess,
  scheduledAccessDenialDetail,
} from "@/lib/auth/schedule";

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

export function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function authenticate(req: NextRequest): Promise<AuthResult> {
  const token = extractBearerToken(req);
  if (!token) {
    return { ok: false, error: "Authentication credentials were not provided.", expired: false };
  }
  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch (err) {
    const expired = err instanceof Error && (err as { code?: string }).code === "expired";
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
  return Boolean(user && roles.includes(user.role));
}

// Enforce supplier/driver scheduled-access windows, matching Django behavior.
export function scheduledAccessOk(user: CurrentUser): boolean {
  return hasActiveScheduledAccess(user);
}

export function scheduledAccessDetail(user: CurrentUser): string {
  return scheduledAccessDenialDetail(user);
}
