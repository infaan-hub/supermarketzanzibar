// GET /api/auth/me   - Fetch the signed-in user's profile.
// PATCH /api/auth/me - Update profile details or change password.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, json, serverError } from "@/lib/http";
import { requireAuth } from "@/lib/auth/request";
import { isEmailValid } from "@/lib/validation";
import {
  AuthError,
  toAuthUserDTO,
  updateUserProfile,
} from "@/services/auth.service";

export async function GET(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  try {
    const user = await prisma.user.findUnique({
      where: { id: guard.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        profileImageName: true,
        profileImageContentType: true,
      },
    });
    if (!user) return json({ detail: "User not found." }, { status: 404 });
    return json({ user: toAuthUserDTO(user) });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const email =
    typeof body.email === "string" ? body.email.trim() : undefined;
  if (email !== undefined && !isEmailValid(email)) {
    return badRequest("Enter a valid email address.");
  }

  const fullName =
    typeof body.full_name === "string"
      ? body.full_name
      : typeof body.fullName === "string"
        ? body.fullName
        : undefined;
  const phone = typeof body.phone === "string" ? body.phone : undefined;
  const address = typeof body.address === "string" ? body.address : undefined;
  const currentPassword =
    typeof body.current_password === "string"
      ? body.current_password
      : typeof body.currentPassword === "string"
        ? body.currentPassword
        : undefined;
  const newPassword =
    typeof body.new_password === "string"
      ? body.new_password
      : typeof body.newPassword === "string"
        ? body.newPassword
        : undefined;

  try {
    const updated = await updateUserProfile(guard.user.id, {
      fullName,
      email,
      phone,
      address,
      currentPassword,
      newPassword,
    });
    return json({ user: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ detail: error.message }, { status: error.status });
    }
    console.error("PATCH /api/auth/me failed:", error);
    return serverError();
  }
}
