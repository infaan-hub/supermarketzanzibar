// Authentication service. Ports the Django SimpleJWT + custom views logic into
// reusable, testable functions. All role checks are server-side; roles from
// the client are never trusted.

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, isUsablePassword } from "@/lib/auth/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  randomJti,
} from "@/lib/auth/jwt";
import { hasActiveScheduledAccess, scheduledAccessDenialDetail } from "@/lib/auth/schedule";
import { serializeUser, serializeScheduledAccess } from "@/lib/serializers";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/lib/env";
import type { Role } from "@/lib/auth/jwt";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
    public code:
      | "invalid_credentials"
      | "wrong_role"
      | "scheduled"
      | "unavailable"
      | "not_found"
      | "conflict"
      | "bad_request" = "bad_request",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function issueTokenPair(user: {
  id: bigint;
  role: string;
  username: string;
}) {
  const access = await signAccessToken(user);
  const jti = randomJti();
  const refresh = await signRefreshToken(user, jti);
  // Persist refresh-token state for rotation + revocation.
  await prisma.refreshToken.create({
    data: {
      jti,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  return { access, refresh };
}

async function fullUser(id: bigint) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AuthError("User not found.", 404, "not_found");
  return user;
}

export async function loginByRole(
  username: string | undefined,
  password: string | undefined,
  requiredRole?: Role,
) {
  if (!username || !password) {
    throw new AuthError("Invalid credentials.", 401, "invalid_credentials");
  }
  // Match Django's case handling: username lookup is case-insensitive via
  // the DB (AbstractUser), so we lowercase for the lookup.
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
  if (!user || !isUsablePassword(user.password) || !verifyPassword(password, user.password)) {
    throw new AuthError("Invalid credentials.", 401, "invalid_credentials");
  }
  if (requiredRole && user.role !== requiredRole) {
    throw new AuthError(`Only ${requiredRole} can login here.`, 403, "wrong_role");
  }
  if (!user.isActive) {
    throw new AuthError("This account is inactive.", 403, "wrong_role");
  }
  if (!hasActiveScheduledAccess(user)) {
    throw new AuthError(scheduledAccessDenialDetail(user), 403, "scheduled");
  }
  const tokens = await issueTokenPair(user);
  return { ...tokens, user: serializeUser(user) };
}

export function tokenPayloadShape(user: unknown) {
  return { user };
}
// ---- Google login ----
export async function verifyGoogleCredential(credential: string): Promise<Record<string, unknown>> {
  const googleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!googleClientId) {
    throw new AuthError("Google login is not configured.", 503, "unavailable");
  }
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new AuthError("Google login is temporarily unavailable.", 503, "unavailable");
  }
  const profile = (await res.json()) as Record<string, unknown>;
  if (profile.aud !== googleClientId) {
    throw new AuthError("Google sign in is not configured for this app.", 400, "bad_request");
  }
  return profile;
}

function uniqueUsernameSeed(value: string): string {
  const base = value.replace(/[^a-zA-Z0-9._]/g, "") || "customer";
  return base;
}

export async function googleCustomerLogin(credentialRaw: string) {
  const credential = (credentialRaw || "").trim();
  if (!credential) {
    throw new AuthError("Google credential is required.", 400, "bad_request");
  }
  const profile = await verifyGoogleCredential(credential);
  const email = String(profile.email || "").trim().toLowerCase();
  if (!email) {
    throw new AuthError("Google did not return an email address.", 400, "bad_request");
  }
  const verified = profile.email_verified;
  if (verified !== true && verified !== "true" && verified !== "True" && verified !== "1" && verified !== 1) {
    throw new AuthError("Only verified Google email accounts can sign in.", 400, "bad_request");
  }

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  let user;
  if (existing) {
    if (existing.role !== "customer") {
      throw new AuthError("Only customer accounts can sign in with Google here.", 403, "wrong_role");
    }
    if (!existing.isActive) {
      throw new AuthError("This customer account is inactive.", 403, "wrong_role");
    }
    await prisma.customer.upsert({
      where: { userId: existing.id },
      update: {},
      create: { userId: existing.id, phone: existing.phone },
    });
    user = existing;
  } else {
    const fullName = String(profile.name || email.split("@")[0] || "Customer").trim() || "Customer";
    user = await prisma.user.create({
      data: {
        username: await uniqueUsername(`google_${uniqueUsernameSeed(fullName)}`),
        email,
        fullName,
        phone: await uniquePhone(),
        address: "",
        role: "customer",
        isActive: true,
        password: "!", // unusable password, matching set_unusable_password()
      },
    });
    await prisma.customer.create({ data: { userId: user.id, phone: user.phone } });
  }
  const tokens = await issueTokenPair(user);
  return { ...tokens, user: serializeUser(user) };
}

async function uniqueUsername(seed: string): Promise<string> {
  let candidate = seed;
  let counter = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${seed}${counter}`;
    counter += 1;
  }
  return candidate;
}

async function uniquePhone(): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
    const candidate = `2557${digits}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await prisma.user.findUnique({ where: { phone: candidate } }))) {
      return candidate;
    }
  }
  return `2557${Date.now()}`;
}

// ---- Refresh token rotation ----
// Rotating refresh: verify signature, ensure the jti is still valid (not
// revoked, not already replaced, not expired), mark it replaced, issue a new
// pair. Reuse of an old jti is rejected to prevent replay.
export async function refreshTokens(refreshToken: string) {
  let claims;
  try {
    claims = await verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError("Session refresh failed. Please login again.", 401, "invalid_credentials");
  }

  const record = await prisma.refreshToken.findUnique({ where: { jti: claims.jti } });
  if (!record || record.revokedAt || record.replacedBy) {
    throw new AuthError("Session refresh failed. Please login again.", 401, "invalid_credentials");
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AuthError("Session refresh failed. Please login again.", 401, "invalid_credentials");
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || !user.isActive) {
    throw new AuthError("Session refresh failed. Please login again.", 401, "invalid_credentials");
  }

  const newJti = randomJti();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { jti: claims.jti },
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

  const access = await signAccessToken(user);
  const refresh = await signRefreshToken(user, newJti);
  return { access, refresh };
}

// Logout: revoke the refresh token so it cannot be replayed.
export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const claims = await verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { jti: claims.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Ignore invalid tokens on logout; the goal is to clear client state.
  }
}


// ---- Registration ----
export interface RegisterInput {
  username: string;
  email: string;
  fullName: string;
  phone: string;
  address?: string | null;
  password: string;
  passwordConfirm: string;
  role?: string;
  companyName?: string;
}

async function ensureUniqueUserFields(username: string, email: string, phone: string) {
  if (await prisma.user.findUnique({ where: { username } })) {
    throw new AuthError("A user with that username already exists.", 400, "bad_request");
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new AuthError("A user with that email already exists.", 400, "bad_request");
  }
  if (await prisma.user.findUnique({ where: { phone } })) {
    throw new AuthError("A user with that phone already exists.", 400, "bad_request");
  }
}

type CreatedUser = Awaited<ReturnType<typeof prisma.user.create>>;

// Public customer registration. Role is forced to "customer"; any client role
// value is ignored so users cannot escalate privileges.
export async function registerCustomer(input: RegisterInput): Promise<CreatedUser> {
  await ensureUniqueUserFields(input.username, input.email, input.phone);
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      address: input.address || "",
      role: "customer",
      isActive: true,
      password: hashPassword(input.password),
      customerProfile: { create: { phone: input.phone, loyaltyPoints: 0 } },
    },
  });
}

// Public admin registration (only used by the /admin/register page). Role is
// forced to "admin" server-side.
export async function registerAdmin(input: RegisterInput): Promise<CreatedUser> {
  await ensureUniqueUserFields(input.username, input.email, input.phone);
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      address: input.address || "",
      role: "admin",
      isActive: true,
      password: hashPassword(input.password),
    },
  });
}

// Admin-only create-user. Validates that only supplier/driver/customer can be
// created here (mirrors AdminCreateUserSerializer.validate_role).
export async function adminCreateUser(
  input: RegisterInput,
  role: string,
): Promise<CreatedUser> {
  if (!["supplier", "driver", "customer"].includes(role)) {
    throw new AuthError(
      "Admin can only create supplier, driver, or customer users.",
      400,
      "bad_request",
    );
  }
  await ensureUniqueUserFields(input.username, input.email, input.phone);
  const companyName = input.companyName?.trim() || `${input.fullName} Supplies`;
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      address: input.address || "",
      role,
      isActive: true,
      password: hashPassword(input.password),
      ...(role === "supplier"
        ? {
            supplierProfile: {
              create: { companyName, phone: input.phone, address: input.address || "" },
            },
          }
        : {}),
      ...(role === "customer"
        ? { customerProfile: { create: { phone: input.phone, loyaltyPoints: 0 } } }
        : {}),
    },
  });
}

// ---- Scheduled access management (admin) ----
export async function listScheduledAccessUsers() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["supplier", "driver"] } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }, { username: "asc" }],
  });
  return users.map(serializeScheduledAccess);
}

export async function updateScheduledAccess(
  userId: bigint,
  input: { accessWindowStart?: Date | null; accessWindowEnd?: Date | null },
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: { in: ["supplier", "driver"] } },
  });
  if (!user) throw new AuthError("Scheduled user not found.", 404, "not_found");

  const start = "accessWindowStart" in input ? input.accessWindowStart : user.accessWindowStart;
  const end = "accessWindowEnd" in input ? input.accessWindowEnd : user.accessWindowEnd;

  if ((start === null || start === undefined) !== (end === null || end === undefined)) {
    throw new AuthError(
      "Set both start and end time, or clear both fields to disable access.",
      400,
      "bad_request",
    );
  }
  if (start && end && end <= start) {
    throw new AuthError("End time must be after start time.", 400, "bad_request");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      accessWindowStart: start ?? null,
      accessWindowEnd: end ?? null,
    },
  });
  return serializeScheduledAccess(updated);
}

