// GET /api/public/products/[id]/image — Serves product photos for active
// products on the public guest storefront.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id: BigInt(id), isActive: true },
      select: { imageData: true, imageContentType: true },
    });

    if (!product?.imageData) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(new Uint8Array(product.imageData), {
      status: 200,
      headers: {
        "Content-Type": product.imageContentType || "image/jpeg",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Unavailable", { status: 500 });
  }
}
