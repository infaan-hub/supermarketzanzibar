// DELETE /api/barcodes/[id] - Remove a non-primary pack/shelf barcode (marketmaster/manager/admin).

import type { NextRequest } from "next/server";
import { requireProductManager } from "@/lib/auth/request";
import {
  badRequest,
  json,
  notFound,
  serverError,
  serviceUnavailable,
} from "@/lib/http";
import { BarcodeError, deleteProductBarcode } from "@/services/barcode.service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireProductManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id.trim()) return badRequest("Barcode ID is required.");

  try {
    await deleteProductBarcode(id.trim());
    return json({ detail: "Barcode label removed." });
  } catch (error) {
    if (error instanceof BarcodeError) {
      if (error.code === "not_found") return notFound(error.message);
      if (error.code === "unavailable") return serviceUnavailable(error.message);
      return badRequest(error.message);
    }
    console.error("Delete barcode failed:", error);
    return serverError("Unable to remove barcode label.");
  }
}
