// HTTP response helpers.
//
// The original Django REST Framework returned errors as `{ "detail": "..." }`
// and validation errors as `{ field: [...] }`. The frontend depends on these
// exact shapes, so we reproduce them here for compatibility.

import { NextResponse } from "next/server";

export function json(
  data: unknown,
  statusOrInit: number | ResponseInit = 200,
  headers?: HeadersInit,
) {
  const init =
    typeof statusOrInit === "number"
      ? { status: statusOrInit, headers }
      : statusOrInit;
  return serializedJson(data, init);
}

export function ok(data: unknown, headers?: HeadersInit) {
  return serializedJson(data, { status: 200, headers });
}

export function created(data: unknown) {
  return serializedJson(data, { status: 201 });
}

/** Encode API values consistently, including PostgreSQL BIGINT IDs from Prisma. */
export function serializedJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  const body = JSON.stringify(data, (_key, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );

  return new NextResponse(body, { ...init, headers });
}

export function badRequest(detail: string) {
  return serializedJson({ detail }, { status: 400 });
}

// DRF field-validation style error: { field: ["message", ...] }.
export function validationError(fields: Record<string, string[]>) {
  return serializedJson(fields, { status: 400 });
}

export function unauthorized(detail = "Authentication credentials were not provided.") {
  return serializedJson({ detail }, { status: 401 });
}

export function forbidden(detail = "You do not have permission to perform this action.") {
  return serializedJson({ detail }, { status: 403 });
}

export function notFound(detail = "Not found.") {
  return serializedJson({ detail }, { status: 404 });
}

export function conflict(detail: string) {
  return serializedJson({ detail }, { status: 409 });
}

export function serviceUnavailable(detail: string) {
  return serializedJson({ detail }, { status: 503 });
}

// Generic server error that never leaks internal details.
export function serverError(detail = "An unexpected error occurred.") {
  return serializedJson({ detail }, { status: 500 });
}
