// PATCH /api/users/[id] - Update user role, status, or reset password (admin only).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, conflict, json, notFound, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/request";
import { ALL_ROLES, normalizeRole } from "@/lib/auth/roles";
import { hashPassword } from "@/lib/auth/password";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!/^\d+$/.test(id)) return badRequest("Invalid user ID.");
  const targetId = BigInt(id);

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const data: Prisma.UserUpdateInput = {};

  if (body.role !== undefined) {
    const nextRole = normalizeRole(String(body.role));
    if (!(ALL_ROLES as readonly string[]).includes(nextRole)) {
      return badRequest(`Role must be one of: ${ALL_ROLES.join(", ")}.`);
    }
    if (targetId === guard.user.id && nextRole !== "admin") {
      return badRequest("You cannot remove your own administrator role.");
    }
    data.role = nextRole;
    data.isStaff =
      nextRole === "admin" ||
      nextRole === "manager" ||
      nextRole === "marketmaster";
    data.isSuperuser = nextRole === "admin";
  }

  if (body.is_active !== undefined || body.isActive !== undefined) {
    const nextActive = Boolean(
      body.is_active !== undefined ? body.is_active : body.isActive,
    );
    if (targetId === guard.user.id && !nextActive) {
      return badRequest("You cannot disable your own account.");
    }
    data.isActive = nextActive;
  }

  if (typeof body.full_name === "string" && body.full_name.trim()) {
    data.fullName = body.full_name.trim();
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return badRequest("Password must be at least 8 characters.");
    }
    data.password = hashPassword(body.password);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: targetId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        fullName: true,
        address: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    return json({
      id: updated.id.toString(),
      username: updated.username,
      email: updated.email,
      phone: updated.phone,
      full_name: updated.fullName,
      address: updated.address ?? "",
      role: updated.role,
      is_active: updated.isActive,
      lastLogin: updated.lastLogin,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return notFound("User not found.");
      if (error.code === "P2002") return conflict("Username, email, or phone already exists.");
    }
    console.error("Update user failed:", error);
    return serverError("Unable to update user.");
  }
}
