// JWT access/refresh token issuing and verification.
//
// Preserves the original contract:
//   - Authorization: Bearer <access>
//   - Access token lifetime: 30 minutes
//   - Refresh token lifetime: 7 days with rotation
//   - Refresh tokens carry a unique `jti` so rotation/revocation can be tracked
//     server-side in the refresh_token table.

import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { env } from "@/lib/env";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/lib/env";

export type Role = "admin" | "supplier" | "driver" | "customer" | string;

export interface AccessTokenClaims extends JWTPayload {
  sub: string; // user id
  token_type: "access";
  role: Role;
  username: string;
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string; // user id
  token_type: "refresh";
  jti: string;
  role: Role;
  username: string;
}

const encoder = new TextEncoder();
const secret = encoder.encode(env.jwtSecret);

export function randomJti(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

export async function signAccessToken(user: {
  id: bigint;
  role: string;
  username: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    token_type: "access",
    role: user.role,
    username: user.username,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id.toString())
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(secret);
}

export async function signRefreshToken(user: {
  id: bigint;
  role: string;
  username: string;
}, jti: string = randomJti()): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    token_type: "refresh",
    jti,
    role: user.role,
    username: user.username,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id.toString())
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_TTL_SECONDS)
    .sign(secret);
}

export class TokenError extends Error {
  constructor(
    message: string,
    public code: "invalid" | "expired" = "invalid",
  ) {
    super(message);
    this.name = "TokenError";
  }
}

async function verify(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    const expired =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_JWT_EXPIRED";
    throw new TokenError(
      expired ? "Token has expired." : "Token is invalid.",
      expired ? "expired" : "invalid",
    );
  }
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims> {
  const payload = await verify(token);
  if (payload.token_type !== "access") {
    throw new TokenError("Wrong token type.");
  }
  return payload as AccessTokenClaims;
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenClaims> {
  const payload = await verify(token);
  if (payload.token_type !== "refresh") {
    throw new TokenError("Wrong token type.");
  }
  return payload as RefreshTokenClaims;
}
