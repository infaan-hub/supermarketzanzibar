// Authentication service for Supermarket Zanzibar.
//
// Handles PBKDF2-SHA256 verification (compatible with migrated Django users),
// JWT access + rotating refresh tokens persisted in `refresh_token` (with
// graceful stateless fallback if that table is not migrated yet), registration,
// first-admin bootstrap, and profile/password updates.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  isUsablePassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  randomJti,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth/jwt";
import { ALL_ROLES, normalizeRole } from "@/lib/auth/roles";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/lib/env";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
    public code:
      | "invalid_credentials"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "bad_request" = "bad_request",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthUserDTO {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  profile_image_available?: boolean;
  profile_image_url?: string | null;
}

export function toAuthUserDTO(user: {
  id: bigint;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  address: string | null;
  role: string;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt?: Date;
  profileImageName?: string;
  profileImageContentType?: string;
  profileImageData?: Uint8Array | Buffer | null;
}): AuthUserDTO {
  const hasProfileImage = Boolean(
    user.profileImageName ||
      user.profileImageContentType ||
      user.profileImageData,
  );
  const versionTs = user.updatedAt
    ? user.updatedAt.getTime()
    : user.createdAt.getTime();

  return {
    id: user.id.toString(),
    username: user.username,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone,
    address: user.address ?? "",
    role: user.role,
    is_active: user.isActive,
    last_login: user.lastLogin ? user.lastLogin.toISOString() : null,
    created_at: user.createdAt.toISOString(),
    profile_image_available: hasProfileImage,
    profile_image_url: hasProfileImage
      ? `/api/auth/me/image?u=${user.id.toString()}&v=${versionTs}`
      : null,
  };
}

function isMissingRefreshTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function issueTokenPair(user: {
  id: bigint;
  role: string;
  username: string;
}) {
  const access = await signAccessToken(user);
  const jti = randomJti();
  const refresh = await signRefreshToken(user, jti);

  try {
    await prisma.refreshToken.create({
      data: {
        jti,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });
  } catch (error) {
    if (!isMissingRefreshTable(error)) throw error;
  }

  return { access, refresh };
}

export async function loginUser(identifierRaw: string, passwordRaw: string) {
  const identifier = (identifierRaw ?? "").trim();
  const password = passwordRaw ?? "";

  if (!identifier || !password) {
    throw new AuthError("Username and password are required.", 400, "bad_request");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: identifier, mode: "insensitive" } },
        { email: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  if (
    !user ||
    !isUsablePassword(user.password) ||
    !verifyPassword(password, user.password)
  ) {
    throw new AuthError("Invalid credentials.", 401, "invalid_credentials");
  }

  if (!user.isActive) {
    throw new AuthError("This account is disabled.", 403, "forbidden");
  }

  await prisma.user
    .update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })
    .catch(() => undefined);

  const tokens = await issueTokenPair(user);
  return { ...tokens, user: toAuthUserDTO(user) };
}

export async function refreshTokens(refreshToken: string) {
  let claims;
  try {
    claims = await verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError(
      "Session expired. Please sign in again.",
      401,
      "invalid_credentials",
    );
  }

  let userId: bigint;
  try {
    userId = BigInt(claims.sub);
  } catch {
    throw new AuthError("Invalid refresh token.", 401, "invalid_credentials");
  }

  let trackTable = true;
  try {
    const record = await prisma.refreshToken.findUnique({
      where: { jti: claims.jti },
    });

    if (record) {
      if (
        record.revokedAt ||
        record.replacedBy ||
        record.expiresAt.getTime() <= Date.now()
      ) {
        throw new AuthError(
          "Session expired. Please sign in again.",
          401,
          "invalid_credentials",
        );
      }
      userId = record.userId;
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (isMissingRefreshTable(error)) {
      trackTable = false;
    } else {
      throw error;
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AuthError(
      "Account not found or disabled.",
      401,
      "invalid_credentials",
    );
  }

  const newJti = randomJti();
  if (trackTable) {
    try {
      await prisma.$transaction([
        prisma.refreshToken.updateMany({
          where: { jti: claims.jti, revokedAt: null },
          data: { revokedAt: new Date(), replacedBy: newJti },
        }),
        prisma.refreshToken.create({
          data: {
            jti: newJti,
            userId: user.id,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
          },
        }),
      ]);
    } catch (error) {
      if (!isMissingRefreshTable(error)) throw error;
    }
  }

  const access = await signAccessToken(user);
  const refresh = await signRefreshToken(user, newJti);
  return { access, refresh, user: toAuthUserDTO(user) };
}

export async function logoutUser(
  refreshToken: string | undefined,
): Promise<void> {
  if (!refreshToken) return;
  try {
    const claims = await verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { jti: claims.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Ignore invalid/expired tokens or missing table on sign-out.
  }
}

export async function hasAnyAdmin(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "admin" } });
  return count > 0;
}

export interface RegisterInput {
  username: string;
  email: string;
  fullName: string;
  phone: string;
  address?: string | null;
  password: string;
  passwordConfirm?: string;
  role?: string;
  companyName?: string;
}

async function ensureUniqueUserFields(
  username: string,
  email: string,
  phone: string,
  excludeUserId?: bigint,
) {
  const notSelf = excludeUserId ? { id: { not: excludeUserId } } : {};

  if (
    await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" }, ...notSelf },
      select: { id: true },
    })
  ) {
    throw new AuthError("A user with that username already exists.", 400, "bad_request");
  }

  if (
    await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, ...notSelf },
      select: { id: true },
    })
  ) {
    throw new AuthError("A user with that email already exists.", 400, "bad_request");
  }

  if (
    await prisma.user.findFirst({
      where: { phone, ...notSelf },
      select: { id: true },
    })
  ) {
    throw new AuthError("A user with that phone already exists.", 400, "bad_request");
  }
}

/**
 * Public registration.
 * If zero admin users exist in the database (initial bootstrap), creates the
 * first admin account. Otherwise always forces `role = "customer"`.
 */
export async function registerPublicUser(input: RegisterInput) {
  await ensureUniqueUserFields(input.username, input.email, input.phone);
  const adminExists = await hasAnyAdmin();
  const role = adminExists ? "customer" : "admin";

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      phone: input.phone,
      address: input.address || "",
      role,
      isActive: true,
      isStaff: role === "admin",
      isSuperuser: role === "admin",
      password: hashPassword(input.password),
      ...(role === "customer"
        ? { customerProfile: { create: { phone: input.phone, loyaltyPoints: 0 } } }
        : {}),
    },
  });

  return toAuthUserDTO(user);
}

/** Admin-only account creation supporting all application roles. */
export async function adminCreateUser(input: RegisterInput, requestedRole: string) {
  const role = normalizeRole(requestedRole);
  if (!(ALL_ROLES as readonly string[]).includes(role)) {
    throw new AuthError(
      `Role must be one of: ${ALL_ROLES.join(", ")}.`,
      400,
      "bad_request",
    );
  }

  await ensureUniqueUserFields(input.username, input.email, input.phone);
  const companyName = input.companyName?.trim() || `${input.fullName} Supplies`;

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      phone: input.phone,
      address: input.address || "",
      role,
      isActive: true,
      isStaff: role === "admin" || role === "manager" || role === "marketmaster",
      isSuperuser: role === "admin",
      password: hashPassword(input.password),
      ...(role === "supplier"
        ? {
            supplierProfile: {
              create: {
                companyName,
                phone: input.phone,
                address: input.address || "",
              },
            },
          }
        : {}),
      ...(role === "customer"
        ? {
            customerProfile: {
              create: { phone: input.phone, loyaltyPoints: 0 },
            },
          }
        : {}),
    },
  });

  return toAuthUserDTO(user);
}

export async function updateUserProfile(
  userId: bigint,
  input: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    currentPassword?: string;
    newPassword?: string;
  },
) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AuthError("User not found.", 404, "not_found");
  }

  const nextEmail = input.email?.trim().toLowerCase() ?? existing.email;
  const nextPhone = input.phone?.trim() ?? existing.phone;
  const nextFullName = input.fullName?.trim() || existing.fullName;
  const nextAddress =
    input.address !== undefined ? input.address.trim() : (existing.address ?? "");

  if (nextEmail !== existing.email || nextPhone !== existing.phone) {
    await ensureUniqueUserFields(existing.username, nextEmail, nextPhone, userId);
  }

  let nextPasswordHash: string | undefined;
  if (input.newPassword) {
    if (input.newPassword.length < 8) {
      throw new AuthError(
        "New password must be at least 8 characters.",
        400,
        "bad_request",
      );
    }
    if (
      !input.currentPassword ||
      !verifyPassword(input.currentPassword, existing.password)
    ) {
      throw new AuthError(
        "Current password is incorrect.",
        400,
        "bad_request",
      );
    }
    nextPasswordHash = hashPassword(input.newPassword);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: nextFullName,
      email: nextEmail,
      phone: nextPhone,
      address: nextAddress,
      ...(nextPasswordHash ? { password: nextPasswordHash } : {}),
    },
  });

  return toAuthUserDTO(updated);
}
