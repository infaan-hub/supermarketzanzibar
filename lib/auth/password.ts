// Password hashing compatible with the existing Django database.
//
// The existing users were created by Django using its default PBKDF2 hasher and
// stored as: pbkdf2_sha256$<iterations>$<salt>$<base64-hash>. We verify existing
// hashes with this exact format and produce new hashes in the same format so the
// migrated records remain valid and interchangeable.

import {
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "pbkdf2_sha256";
const ITERATIONS = 1_200_000;
const SALT_BYTES = 22;
const HASH_BYTES = 32;

function dkLenFor(iterations: number): number {
  // Django's default dklen equals the digest length (sha256 -> 32). Older
  // hashes used a 32-byte digest as well, so 32 is correct for both.
  void iterations;
  return HASH_BYTES;
}

function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("base64").slice(0, SALT_BYTES);
  const derived = pbkdf2Sync(
    password,
    salt,
    ITERATIONS,
    dkLenFor(ITERATIONS),
    "sha256",
  );
  return `${ALGORITHM}$${ITERATIONS}$${salt}$${toBase64(derived)}`;
}

function parse(stored: string): {
  algorithm: string;
  iterations: number;
  salt: string;
  hashB64: string;
} | null {
  const parts = stored.split("$");
  if (parts.length !== 4) return null;
  const [algorithm, iterRaw, salt, hashB64] = parts;
  const iterations = Number(iterRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) return null;
  return { algorithm, iterations, salt, hashB64 };
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  const parsed = parse(stored);
  if (!parsed) return false;
  // Only the Django PBKDF2-SHA256 format is used by this app's users.
  const digestName =
    parsed.algorithm === "pbkdf2_sha256"
      ? "sha256"
      : parsed.algorithm.replace("pbkdf2_", "");
  if (!["sha256", "sha1"].includes(digestName)) return false;

  const expected = Buffer.from(parsed.hashB64, "base64");
  const candidate = pbkdf2Sync(
    password,
    parsed.salt,
    parsed.iterations,
    expected.length || dkLenFor(parsed.iterations),
    digestName,
  );
  if (expected.length !== candidate.length) return false;
  return timingSafeEqual(expected, candidate);
}

export function isUsablePassword(stored: string | null | undefined): boolean {
  // Google-only accounts have an unusable password starting with "!".
  return Boolean(stored) && !stored!.startsWith("!");
}

// Exposed for HMAC-based token identifiers if ever needed.
export function hmac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}
