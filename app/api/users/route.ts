// GET /api/users - List users.
//
// Returns user accounts for admin management.

import { NextResponse } from "next/server";
import { findManyUsers, countUsers } from "@/lib/users";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: {
      OR?: { username: string; fullName: string }[];
      role?: string;
    } = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" as const } },
        { fullName: { contains: search, mode: "insensitive" as const } },
      ];
    }
    if (role) where.role = role;

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [users, total] = await Promise.all([
      findManyUsers({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        take,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      countUsers(where),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id.toString(),
        username: u.username,
        email: u.email,
        phone: u.phone,
        full_name: u.fullName,
        role: u.role,
        is_active: u.isActive,
        createdAt: u.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.ceil(total / takeNum),
      },
    });
  } catch (error) {
    console.error("List users failed:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { detail: "Use the admin dashboard to manage users." },
    { status: 403 },
  );
}
