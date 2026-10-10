// HTTP response helpers.
//
// The original Django REST Framework returned errors as `{ "detail": "..." }`
// and validation errors as `{ field: [...] }`. The frontend depends on these
// exact shapes, so we reproduce them here for compatibility.

import { NextResponse } from "next/server";

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

export function ok(data: unknown, headers?: HeadersInit) {
  return NextResponse.json(data, { status: 200, headers });
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(detail: string) {
  return NextResponse.json({ detail }, { status: 400 });
}

// DRF field-validation style error: { field: ["message", ...] }.
export function validationError(fields: Record<string, string[]>) {
  return NextResponse.json(fields, { status: 400 });
}

export function unauthorized(detail = "Authentication credentials were not provided.") {
  return NextResponse.json({ detail }, { status: 401 });
}

export function forbidden(detail = "You do not have permission to perform this action.") {
  return NextResponse.json({ detail }, { status: 403 });
}

export function notFound(detail = "Not found.") {
  return NextResponse.json({ detail }, { status: 404 });
}

export function conflict(detail: string) {
  return NextResponse.json({ detail }, { status: 409 });
}

export function serviceUnavailable(detail: string) {
  return NextResponse.json({ detail }, { status: 503 });
}

// Generic server error that never leaks internal details.
export function serverError(detail = "An unexpected error occurred.") {
  return NextResponse.json({ detail }, { status: 500 });
}
