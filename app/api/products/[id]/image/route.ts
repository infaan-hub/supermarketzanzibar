// GET    /api/products/[id]/image - Serve product photo (active or archived).
// POST   /api/products/[id]/image - Upload/replace product photo (marketmaster/manager/admin).
// DELETE /api/products/[id]/image - Remove product photo (marketmaster/manager/admin).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, json, notFound, serverError } from "@/lib/http";
import { requireProductManager } from "@/lib/auth/request";
import { recordAuditLog } from "@/lib/audit";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function parseProductId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { imageData: true, imageContentType: true },
    });

    if (!product?.imageData) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(new Uint8Array(product.imageData), {
      status: 200,
      headers: {
        "Content-Type": product.imageContentType || "image/jpeg",
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Unavailable", { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireProductManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return badRequest("Invalid product ID.");

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
    return badRequest("Product image must be 5 MB or smaller.");
  }

  const contentType = (candidate.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return badRequest(
      "Unsupported image format. Please upload a JPG, PNG, WebP, or GIF image.",
    );
  }

  try {
    const buffer = Buffer.from(await candidate.arrayBuffer());
    const safeName = (candidate.name || "product-image")
      .replace(/[^\w.\- ]+/g, "_")
      .slice(0, 240);

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        imageData: buffer,
        imageName: safeName,
        imageContentType: contentType === "image/jpg" ? "image/jpeg" : contentType,
      },
      select: {
        id: true,
        name: true,
        imageName: true,
        imageContentType: true,
        updatedAt: true,
      },
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "PRODUCT_IMAGE_UPDATED",
      entityType: "PRODUCT",
      entityId: updated.id.toString(),
      summary: `Uploaded image "${updated.imageName}" for product "${updated.name}".`,
    });

    publishInventoryEvent({
      type: "shelf_updated",
      productId: updated.id.toString(),
      summary: `Updated image for ${updated.name}`,
    });

    return json({
      id: updated.id.toString(),
      image_available: true,
      imageName: updated.imageName,
      imageContentType: updated.imageContentType,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound("Product not found.");
    }
    console.error("Upload product image failed:", error);
    return serverError("Unable to upload product image.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireProductManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return badRequest("Invalid product ID.");

  try {
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        imageData: null,
        imageName: "",
        imageContentType: "",
      },
      select: { id: true, name: true, updatedAt: true },
    });

    await recordAuditLog({
      actorId: guard.user.id,
      action: "PRODUCT_IMAGE_REMOVED",
      entityType: "PRODUCT",
      entityId: updated.id.toString(),
      summary: `Removed image for product "${updated.name}".`,
    });

    return json({
      id: updated.id.toString(),
      image_available: false,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound("Product not found.");
    }
    console.error("Remove product image failed:", error);
    return serverError("Unable to remove product image.");
  }
}
