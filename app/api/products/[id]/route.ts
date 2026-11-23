// GET    /api/products/[id] - Product detail including barcodes & recent movements.
// PATCH  /api/products/[id] - Update product details (marketmaster/manager/admin).
// DELETE /api/products/[id] - Archive (deactivate) product (marketmaster/manager/admin).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  badRequest,
  json,
  notFound,
  serverError,
  validationError,
} from "@/lib/http";
import {
  requireProductManager,
  requireStaff,
} from "@/lib/auth/request";
import { listProductBarcodes } from "@/services/barcode.service";
import {
  isValidProductAssetKey,
  resolveEffectiveProductAsset,
} from "@/lib/digital-twin/asset-manifest";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";
import {
  ShelfPlacementError,
  applyProductShelfPlacement,
  serializeShelfPositions,
  upsertProductThreeDAsset,
  type ApplyShelfPlacementInput,
  type ShelfPositionWithHierarchy,
} from "@/lib/product-placement";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import { isMissingTwinTables } from "@/services/digital-twin.service";

const MAX_MONEY = new Prisma.Decimal("99999999.99");

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return badRequest("Invalid product ID.");

  try {
    await ensureDigitalTwinSchema().catch(() => undefined);
    const [product, barcodes, movements, shelfPositions] = await Promise.all([
      prisma.product
        .findUnique({
          where: { id: productId },
          include: {
            category: true,
            supplier: true,
            modelAsset: { select: { assetKey: true, version: true } },
          },
        })
        .catch((err) => {
          if (!isMissingTwinTables(err)) throw err;
          return prisma.product.findUnique({
            where: { id: productId },
            include: { category: true, supplier: true },
          });
        }),
      listProductBarcodes(productId),
      prisma.stockMovement.findMany({
        where: { productId },
        include: { saleItem: { select: { saleId: true } } },
        orderBy: { date: "desc" },
        take: 25,
      }),
      prisma.shelfPosition
        .findMany({
          where: { productId },
          include: {
            shelf: {
              include: {
                department: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
          orderBy: { slotIndex: "asc" },
        })
        .catch((err): ShelfPositionWithHierarchy[] => {
          if (isMissingTwinTables(err)) return [];
          throw err;
        }),
    ]);

    if (!product) {
      return notFound("Product not found.");
    }

    const storedModelAsset =
      "modelAsset" in product
        ? (product.modelAsset as { assetKey: string; version: string } | null)
        : null;
    const effectiveAsset = resolveEffectiveProductAsset({
      name: product.name,
      categoryName: product.category?.name ?? null,
      storedAssetKey: storedModelAsset?.assetKey ?? null,
      storedAssetVersion: storedModelAsset?.version ?? null,
    });

    return json({
      id: product.id.toString(),
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      costPrice: Number(product.costPrice),
      quantity: product.quantity,
      barcode: product.barcode,
      description: product.description,
      isActive: product.isActive,
      category: product.category
        ? { id: product.category.id.toString(), name: product.category.name }
        : null,
      supplier: product.supplier
        ? {
            id: product.supplier.id.toString(),
            companyName: product.supplier.companyName,
          }
        : null,
      image_available: Boolean(product.imageData),
      assetKey: effectiveAsset.entry.key,
      assetAutoDetected: !effectiveAsset.isExplicit,
      shelfPlacements: serializeShelfPositions(shelfPositions),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      barcodes: barcodes.map((b) => ({
        id: b.id,
        barcode: b.barcode,
        barcodeType: b.barcodeType,
        unitId: b.unitId,
        quantityMultiplier: b.quantityMultiplier.toFixed(3),
        isPrimary: b.isPrimary,
        createdAt: b.createdAt,
      })),
      recentMovements: movements.map((m) => ({
        id: m.id.toString(),
        quantity: m.quantity,
        movementType: m.movementType,
        date: m.date,
        saleId: m.saleItem ? m.saleItem.saleId.toString() : null,
      })),
    });
  } catch (error) {
    console.error("Get product failed:", error);
    return serverError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireProductManager(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return badRequest("Invalid product ID.");

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return badRequest("A JSON body is required.");
    body = raw as Record<string, unknown>;
  } catch {
    return badRequest("A JSON body is required.");
  }

  const data: Prisma.ProductUpdateInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return validationError({ name: ["Product name is required."] });
    if (name.length > 255) {
      return validationError({ name: ["Product name must be 255 characters or fewer."] });
    }
    data.name = name;
  }

  if (body.price !== undefined) {
    let price: Prisma.Decimal;
    try {
      price = new Prisma.Decimal(String(body.price));
    } catch {
      return validationError({ price: ["Enter a valid selling price."] });
    }
    if (!price.isFinite() || price.lt(0) || price.gt(MAX_MONEY)) {
      return validationError({ price: ["Price must be between 0 and 99,999,999.99."] });
    }
    data.price = price;
  }

  if (body.costPrice !== undefined) {
    let costPrice: Prisma.Decimal;
    try {
      costPrice = new Prisma.Decimal(String(body.costPrice));
    } catch {
      return validationError({ costPrice: ["Enter a valid cost price."] });
    }
    if (!costPrice.isFinite() || costPrice.lt(0) || costPrice.gt(MAX_MONEY)) {
      return validationError({ costPrice: ["Cost price must be between 0 and 99,999,999.99."] });
    }
    data.costPrice = costPrice;
  }

  if (body.description !== undefined) {
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 5000) {
      return validationError({ description: ["Description is too long."] });
    }
    data.description = description;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      data.category = { disconnect: true };
    } else {
      const catId = parseProductId(String(body.categoryId));
      if (!catId) return validationError({ categoryId: ["Invalid category."] });
      data.category = { connect: { id: catId } };
    }
  }

  if (body.supplierId !== undefined) {
    if (body.supplierId === null || body.supplierId === "") {
      data.supplier = { disconnect: true };
    } else {
      const supId = parseProductId(String(body.supplierId));
      if (!supId) return validationError({ supplierId: ["Invalid supplier."] });
      data.supplier = { connect: { id: supId } };
    }
  }

  const hasAssetKeyField = body.assetKey !== undefined;
  let explicitAssetKey: string | null = null;
  if (hasAssetKeyField) {
    const rawKey =
      typeof body.assetKey === "string" ? body.assetKey.trim() : "";
    if (rawKey && !isValidProductAssetKey(rawKey)) {
      return validationError({
        assetKey: ["Selected 3D product shape is not valid."],
      });
    }
    explicitAssetKey = rawKey || null;
  }

  const shelfPlacementInput: ApplyShelfPlacementInput | null =
    body.shelfPlacement && typeof body.shelfPlacement === "object"
      ? (body.shelfPlacement as ApplyShelfPlacementInput)
      : null;

  try {
    if (shelfPlacementInput || hasAssetKeyField) {
      await ensureDigitalTwinSchema().catch(() => undefined);
    }

    const { updated, placementResult } = await prisma.$transaction(
      async (tx) => {
        let upsertedAssetId: string | null = null;
        if (hasAssetKeyField) {
          if (explicitAssetKey) {
            const upserted = await upsertProductThreeDAsset(
              tx,
              explicitAssetKey,
            );
            upsertedAssetId = upserted?.id ?? null;
            if (upsertedAssetId) {
              data.modelAsset = { connect: { id: upsertedAssetId } };
            }
          } else {
            data.modelAsset = { disconnect: true };
          }
        }

        const nextProduct = await tx.product.update({
          where: { id: productId },
          data,
          include: {
            category: true,
            supplier: true,
            modelAsset: { select: { assetKey: true, version: true } },
          },
        });

        const nextEffective = resolveEffectiveProductAsset({
          name: nextProduct.name,
          categoryName: nextProduct.category?.name ?? null,
          storedAssetKey: nextProduct.modelAsset?.assetKey ?? null,
          storedAssetVersion: nextProduct.modelAsset?.version ?? null,
        });

        // Keep existing ThreeDObjectMapping records synced with the product's 3D shape.
        if (hasAssetKeyField) {
          const mappingAsset =
            upsertedAssetId !== null
              ? { id: upsertedAssetId }
              : await upsertProductThreeDAsset(tx, nextEffective.entry.key);
          await tx.threeDObjectMapping.updateMany({
            where: {
              linkedEntityType: "PRODUCT",
              linkedEntityId: nextProduct.id.toString(),
            },
            data: { assetId: mappingAsset?.id ?? null },
          });
        }

        let result: Awaited<ReturnType<typeof applyProductShelfPlacement>> = {
          changed: false,
        };
        if (shelfPlacementInput) {
          result = await applyProductShelfPlacement(tx, {
            productId: nextProduct.id,
            productName: nextProduct.name,
            categoryName: nextProduct.category?.name ?? null,
            productQuantity: nextProduct.quantity,
            assetKey: nextEffective.entry.key,
            placement: shelfPlacementInput,
          });
        }

        return { updated: nextProduct, placementResult: result };
      },
    );

    if (placementResult.changed || hasAssetKeyField) {
      publishInventoryEvent({
        type: "shelf_updated",
        shelfId: placementResult.shelfId,
        shelfCode: placementResult.shelfCode,
        positionId: placementResult.positionId,
        productId: updated.id.toString(),
        quantity: placementResult.quantity,
        updates: placementResult.positionId
          ? [
              {
                productId: updated.id.toString(),
                shelfCode: placementResult.shelfCode,
                positionId: placementResult.positionId,
                quantity: placementResult.quantity ?? 0,
              },
            ]
          : undefined,
        summary: placementResult.changed
          ? `Updated shelf placement for ${updated.name}`
          : `Updated 3D product shape for ${updated.name}`,
      });
    }

    const shelfPositions = await prisma.shelfPosition
      .findMany({
        where: { productId },
        include: {
          shelf: {
            include: {
              department: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { slotIndex: "asc" },
      })
      .catch((err): ShelfPositionWithHierarchy[] => {
        if (isMissingTwinTables(err)) return [];
        throw err;
      });

    const updatedEffective = resolveEffectiveProductAsset({
      name: updated.name,
      categoryName: updated.category?.name ?? null,
      storedAssetKey: updated.modelAsset?.assetKey ?? null,
      storedAssetVersion: updated.modelAsset?.version ?? null,
    });

    return json({
      id: updated.id.toString(),
      name: updated.name,
      slug: updated.slug,
      price: Number(updated.price),
      costPrice: Number(updated.costPrice),
      quantity: updated.quantity,
      barcode: updated.barcode,
      description: updated.description,
      isActive: updated.isActive,
      category: updated.category
        ? { id: updated.category.id.toString(), name: updated.category.name }
        : null,
      supplier: updated.supplier
        ? {
            id: updated.supplier.id.toString(),
            companyName: updated.supplier.companyName,
          }
        : null,
      image_available: Boolean(updated.imageData),
      assetKey: updatedEffective.entry.key,
      assetAutoDetected: !updatedEffective.isExplicit,
      shelfPlacements: serializeShelfPositions(shelfPositions),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    if (error instanceof ShelfPlacementError) {
      return json({ detail: error.message }, { status: error.status });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound("Product not found.");
    }
    console.error("Update product failed:", error);
    return serverError("Unable to update product.");
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
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
    return json({ detail: "Product archived." });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFound("Product not found.");
    }
    console.error("Archive product failed:", error);
    return serverError("Unable to archive product.");
  }
}
