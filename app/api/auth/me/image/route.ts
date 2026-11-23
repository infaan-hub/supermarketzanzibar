// GET    /api/auth/me/image - Serve signed-in (or specified `?u=id`) user's profile image.
// POST   /api/auth/me/image - Upload/replace signed-in user's profile image.
// DELETE /api/auth/me/image - Remove signed-in user's profile image.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, json, serverError } from "@/lib/http";
import { requireAuth } from "@/lib/auth/request";
import { recordAuditLog } from "@/lib/audit";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function parseUserId(raw: string | null): bigint | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  let targetUserId = parseUserId(request.nextUrl.searchParams.get("u"));
  if (!targetUserId) {
    const guard = await requireAuth(request);
    if (!guard.ok) {
      return new NextResponse("Not found", { status: 404 });
    }
    targetUserId = guard.user.id;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        profileImageData: true,
        profileImageContentType: true,
      },
    });

    if (!user?.profileImageData) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(new Uint8Array(user.profileImageData), {
      status: 200,
      headers: {
        "Content-Type": user.profileImageContentType || "image/jpeg",
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Unavailable", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Upload must be multipart/form-data with an image file.");
  }

  const candidate = formData.get("file") ?? formData.get("image");
  if (!(candidate instanceof File) || candidate.size === 0) {
    return badRequest("Please select an image file to upload.");
  }

  if (candidate.size > MAX_IMAGE_BYTES) {
    return badRequest("Profile image must be 5 MB or smaller.");
  }

  const contentType = (candidate.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return badRequest(
      "Unsupported image format. Please upload a JPG, PNG, WebP, or GIF image.",
    );
  }

  try {
    const buffer = Buffer.from(await candidate.arrayBuffer());
    const safeName = (candidate.name || "profile-image")
      .replace(/[^\w.\- ]+/g, "_")
      .slice(0, 240);

    const updated = await prisma.user.update({
      where: { id: guard.user.id },
      data: {
        profileImageData: buffer,
        profileImageName: safeName,
        profileImageContentType:
          contentType === "image/jpg" ? "image/jpeg" : contentType,
      },
      select: {
        id: true,
        username: true,
        updatedAt: true,
      },
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "USER_PROFILE_IMAGE_UPLOADED",
      entityType: "USER",
      entityId: updated.id.toString(),
      summary: `Uploaded profile image for @${updated.username}.`,
    }).catch(() => undefined);

    const url = `/api/auth/me/image?u=${updated.id.toString()}&v=${updated.updatedAt.getTime()}`;

    return json({
      profile_image_available: true,
      profile_image_url: url,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Upload profile image failed:", error);
    return serverError("Unable to upload profile image.");
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  try {
    await prisma.user.update({
      where: { id: guard.user.id },
      data: {
        profileImageData: null,
        profileImageName: "",
        profileImageContentType: "",
      },
    });

    return json({ profile_image_available: false });
  } catch (error) {
    console.error("Delete profile image failed:", error);
    return serverError("Unable to remove profile image.");
  }
}
