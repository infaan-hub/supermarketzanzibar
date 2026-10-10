// Lightweight request validation helpers producing DRF-style error shapes.
// The frontend and external consumers expect `{ field: ["message", ...] }`
// for validation errors, so these helpers build that shape.

export class ValidationFailed extends Error {
  constructor(public fields: Record<string, string[]>) {
    super("Validation failed.");
    this.name = "ValidationFailed";
  }
}

export function fail(field: string, message: string): never {
  throw new ValidationFailed({ [field]: [message] });
}

export function parseId(raw: string, field = "id"): bigint {
  try {
    if (!/^\d+$/.test(raw)) fail(field, "Must be a valid integer.");
    return BigInt(raw);
  } catch {
    return fail(field, "Must be a valid integer.");
  }
}

export function requireString(value: unknown, field: string, opts?: { min?: number }): string {
  if (typeof value !== "string") fail(field, "This field is required.");
  const trimmed = value.trim();
  if (opts?.min !== undefined && trimmed.length < opts.min) {
    fail(field, `Ensure this field has at least ${opts.min} characters.`);
  }
  return trimmed;
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

export function requireInt(value: unknown, field: string, min = 0): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) fail(field, "A valid integer is required.");
  if (!Number.isInteger(n)) fail(field, "A valid integer is required.");
  if (n < min) fail(field, `Ensure this value is greater than or equal to ${min}.`);
  return n;
}
// Parse a value that may be a JSON string (multipart form) or already parsed.
export function asBool(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase();
  return s === "true" || s === "1" || s === "on" || s === "yes";
}

// Extract a trimmed text string from a value.
export function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

// Validate an email address.
export function isEmailValid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
