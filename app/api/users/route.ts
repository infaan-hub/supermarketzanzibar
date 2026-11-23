// GET  /api/users - List user accounts (admin only).
// POST /api/users - Create a new staff/user account (admin only).

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  badRequest,
  created,
  json,
  serverError,
  validationError,
} from "@/lib/http";
import { requireAdmin } from "@/lib/auth/request";
import { isEmailValid } from "@/lib/validation";
import { AuthError, adminCreateUser } from "@/services/auth.service";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const role = searchParams.get("role")?.trim();
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role;

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 100) : 50;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
        orderBy: [{ role: "asc" }, { createdAt: "desc" }],
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      prisma.user.count({ where }),
    ]);

    return json({
      users: users.map((u) => ({
        id: u.id.toString(),
        username: u.username,
        email: u.email,
        phone: u.phone,
        full_name: u.fullName,
        address: u.address ?? "",
        role: u.role,
        is_active: u.isActive,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.max(1, Math.ceil(total / takeNum)),
      },
    });
  } catch (error) {
    console.error("List users failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("A JSON body is required.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("A JSON body is required.");
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const fullName =
    typeof body.full_name === "string"
      ? body.full_name.trim()
      : typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role.trim() : "manager";
  const companyName =
    typeof body.companyName === "string" ? body.companyName.trim() : undefined;

  const errors: Record<string, string[]> = {};
  if (!username) errors.username = ["Username is required."];
  if (!email || !isEmailValid(email)) errors.email = ["A valid email is required."];
  if (!fullName) errors.full_name = ["Full name is required."];
  if (!phone) errors.phone = ["Phone is required."];
  if (password.length < 8) {
    errors.password = ["Password must be at least 8 characters."];
  }
  if (Object.keys(errors).length > 0) return validationError(errors);

  try {
    const user = await adminCreateUser(
      { username, email, fullName, phone, address, password, companyName },
      role,
    );
    return created({
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      full_name: user.full_name,
      address: user.address,
      role: user.role,
      is_active: user.is_active,
      createdAt: user.created_at,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ detail: error.message }, { status: error.status });
    }
    console.error("Create user failed:", error);
    return serverError("Unable to create user.");
  }
}
