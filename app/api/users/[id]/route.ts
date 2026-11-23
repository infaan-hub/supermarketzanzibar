// PATCH  /api/users/[id] - Update user profile, role, status, or reset login password (admin only).
// DELETE /api/users/[id] - Permanently delete a user account (admin only).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  badRequest,
  conflict,
  json,
  notFound,
  serverError,
} from "@/lib/http";
import { requireAdmin } from "@/lib/auth/request";
import { ALL_ROLES, normalizeRole } from "@/lib/auth/roles";
import { hashPassword } from "@/lib/auth/password";
import { isEmailValid } from "@/lib/validation";
import { recordAuditLog } from "@/lib/audit";

function isMissingOptionalTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

class DeleteUserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeleteUserConflictError";
  }
}

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
    if (!raw || typeof raw !== "object") {
      return badRequest("Invalid JSON body.");
    }
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const existing = await prisma.user.findUnique({
    where: { id: targetId },
    include: { supplierProfile: true, customerProfile: true },
  });
  if (!existing) return notFound("User not found.");

  const data: Prisma.UserUpdateInput = {};
  let nextRole: string | undefined;
  let nextPhone: string | undefined;
  let nextAddress: string | undefined;
  let nextFullName: string | undefined;
  let passwordChanged = false;
  let disabledAccount = false;

  if (body.username !== undefined) {
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username) return badRequest("Username cannot be empty.");
    if (username.length > 150) {
      return badRequest("Username must be 150 characters or fewer.");
    }
    data.username = username;
  }

  const rawFullName =
    body.full_name !== undefined ? body.full_name : body.fullName;
  if (rawFullName !== undefined) {
    const fullName = typeof rawFullName === "string" ? rawFullName.trim() : "";
    if (!fullName) return badRequest("Full name cannot be empty.");
    if (fullName.length > 255) {
      return badRequest("Full name must be 255 characters or fewer.");
    }
    data.fullName = fullName;
    nextFullName = fullName;
  }

  if (body.email !== undefined) {
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !isEmailValid(email)) {
      return badRequest("A valid email address is required.");
    }
    data.email = email;
  }

  if (body.phone !== undefined) {
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!phone) return badRequest("Phone number cannot be empty.");
    if (phone.length > 20) {
      return badRequest("Phone number must be 20 characters or fewer.");
    }
    data.phone = phone;
    nextPhone = phone;
  }

  if (body.address !== undefined) {
    const address = typeof body.address === "string" ? body.address.trim() : "";
    data.address = address;
    nextAddress = address;
  }

  if (body.role !== undefined) {
    const normalized = normalizeRole(String(body.role));
    if (!(ALL_ROLES as readonly string[]).includes(normalized)) {
      return badRequest(`Role must be one of: ${ALL_ROLES.join(", ")}.`);
    }
    if (targetId === guard.user.id && normalized !== "admin") {
      return badRequest("You cannot remove your own administrator role.");
    }
    if (existing.role === "admin" && normalized !== "admin") {
      const activeAdmins = await prisma.user.count({
        where: { role: "admin", isActive: true },
      });
      if (activeAdmins <= 1) {
        return badRequest("At least one active administrator is required.");
      }
    }
    nextRole = normalized;
    data.role = normalized;
    data.isStaff =
      normalized === "admin" ||
      normalized === "manager" ||
      normalized === "marketmaster";
    data.isSuperuser = normalized === "admin";
  }

  if (body.is_active !== undefined || body.isActive !== undefined) {
    const nextActive = Boolean(
      body.is_active !== undefined ? body.is_active : body.isActive,
    );
    if (targetId === guard.user.id && !nextActive) {
      return badRequest("You cannot disable your own account.");
    }
    if (existing.role === "admin" && existing.isActive && !nextActive) {
      const activeAdmins = await prisma.user.count({
        where: { role: "admin", isActive: true },
      });
      if (activeAdmins <= 1) {
        return badRequest("Cannot disable the last active administrator.");
      }
    }
    data.isActive = nextActive;
    if (!nextActive) disabledAccount = true;
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return badRequest("Password must be at least 8 characters.");
    }
    data.password = hashPassword(body.password);
    passwordChanged = true;
  }

  const companyName =
    typeof body.companyName === "string" ? body.companyName.trim() : "";

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
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

      const effectivePhone = nextPhone ?? user.phone;
      const effectiveAddress = nextAddress ?? user.address ?? "";
      const effectiveFullName = nextFullName ?? user.fullName;

      if (existing.customerProfile && nextPhone) {
        await tx.customer.update({
          where: { id: existing.customerProfile.id },
          data: { phone: effectivePhone },
        });
      } else if (nextRole === "customer" && !existing.customerProfile) {
        await tx.customer.create({
          data: {
            userId: targetId,
            phone: effectivePhone,
            loyaltyPoints: 0,
          },
        });
      }

      if (existing.supplierProfile) {
        if (nextPhone || nextAddress !== undefined || companyName) {
          await tx.supplier.update({
            where: { id: existing.supplierProfile.id },
            data: {
              ...(nextPhone ? { phone: effectivePhone } : {}),
              ...(nextAddress !== undefined ? { address: effectiveAddress } : {}),
              ...(companyName ? { companyName } : {}),
            },
          });
        }
      } else if (nextRole === "supplier") {
        await tx.supplier.create({
          data: {
            userId: targetId,
            companyName: companyName || `${effectiveFullName} Supplies`,
            phone: effectivePhone,
            address: effectiveAddress,
          },
        });
      }

      if (passwordChanged || disabledAccount) {
        try {
          await tx.refreshToken.updateMany({
            where: { userId: targetId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        } catch (err) {
          if (!isMissingOptionalTable(err)) throw err;
        }
      }

      return user;
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: passwordChanged ? "USER_PASSWORD_RESET" : "USER_UPDATED",
      entityType: "USER",
      entityId: updated.id.toString(),
      summary: `Updated user @${updated.username} (${updated.role})${passwordChanged ? " with new login password" : ""}.`,
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
      if (error.code === "P2002") {
        return conflict("Username, email, or phone already exists.");
      }
    }
    console.error("Update user failed:", error);
    return serverError("Unable to update user.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!/^\d+$/.test(id)) return badRequest("Invalid user ID.");
  const targetId = BigInt(id);

  if (targetId === guard.user.id) {
    return badRequest("You cannot delete your own administrator account.");
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: targetId },
      include: { supplierProfile: true, customerProfile: true },
    });
    if (!existing) return notFound("User not found.");

    if (existing.role === "admin") {
      const activeAdmins = await prisma.user.count({
        where: { role: "admin", isActive: true },
      });
      if (activeAdmins <= 1 && existing.isActive) {
        return badRequest("Cannot delete the last active administrator.");
      }
    }

    await prisma.$transaction(async (tx) => {
      if (existing.supplierProfile) {
        const supplierId = existing.supplierProfile.id;
        try {
          const poCount = await tx.purchaseOrder.count({
            where: { supplierId },
          });
          if (poCount > 0) {
            throw new DeleteUserConflictError(
              "This supplier has existing purchase orders and cannot be permanently deleted. Disable the account instead.",
            );
          }
          await tx.goodsReceipt.updateMany({
            where: { supplierId },
            data: { supplierId: null },
          });
        } catch (err) {
          if (err instanceof DeleteUserConflictError) throw err;
          if (!isMissingOptionalTable(err)) throw err;
        }

        await tx.product.updateMany({
          where: { supplierId },
          data: { supplierId: null },
        });

        await tx.supplier.delete({ where: { id: supplierId } });
      }

      if (existing.customerProfile) {
        const customerId = existing.customerProfile.id;
        await tx.sale.updateMany({
          where: { customerId },
          data: { customerId: null },
        });
        await tx.customer.delete({ where: { id: customerId } });
      }

      await tx.sale.updateMany({
        where: { userId: targetId },
        data: { userId: null },
      });
      await tx.sale.updateMany({
        where: { assignedDriverId: targetId },
        data: { assignedDriverId: null },
      });
      await tx.payment.updateMany({
        where: { confirmedById: targetId },
        data: { confirmedById: null },
      });
      await tx.stockMovement.updateMany({
        where: { performedById: targetId },
        data: { performedById: null },
      });

      try {
        await tx.purchaseOrder.updateMany({
          where: { createdById: targetId },
          data: { createdById: null },
        });
      } catch (err) {
        if (!isMissingOptionalTable(err)) throw err;
      }

      try {
        await tx.goodsReceipt.updateMany({
          where: { receivedById: targetId },
          data: { receivedById: null },
        });
      } catch (err) {
        if (!isMissingOptionalTable(err)) throw err;
      }

      try {
        await tx.auditLog.updateMany({
          where: { actorId: targetId },
          data: { actorId: null },
        });
      } catch (err) {
        if (!isMissingOptionalTable(err)) throw err;
      }

      try {
        await tx.refreshToken.deleteMany({ where: { userId: targetId } });
      } catch (err) {
        if (!isMissingOptionalTable(err)) throw err;
      }

      await tx.user.delete({ where: { id: targetId } });
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "USER_DELETED",
      entityType: "USER",
      entityId: targetId.toString(),
      summary: `Deleted user @${existing.username} (${existing.fullName}, role: ${existing.role}).`,
    });

    return json({ detail: `User @${existing.username} deleted.` });
  } catch (error) {
    if (error instanceof DeleteUserConflictError) {
      return conflict(error.message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return notFound("User not found.");
      if (error.code === "P2003") {
        return conflict(
          "This user is linked to historical records and cannot be deleted. Disable the account instead.",
        );
      }
    }
    console.error("Delete user failed:", error);
    return serverError("Unable to delete user.");
  }
}
