// GET  /api/products - List products with search, category, supplier, and stock filters.
// POST /api/products - Register a product from the inventory terminal.

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import {
  badRequest,
  conflict,
  created,
  json,
  serverError,
  validationError,
} from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireExplorer, requireProductManager } from "@/lib/auth/request";
import { isValidCode128, normalizeBarcode } from "@/lib/barcodes";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { getProductById } from "@/lib/products";
import {
  BarcodeError,
  createProductBarcode,
  isMissingBarcodeTable,
} from "@/services/barcode.service";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";

const MAX_MONEY = new Prisma.Decimal("99999999.99");

function validation(field: string, message: string) {
  return validationError({ [field]: [message] });
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

async function uniqueSlug(name: string, barcode: string): Promise<string> {
  const barcodeSlug = slugify(barcode);
  const base = slugify(name) || (barcodeSlug ? `product-${barcodeSlug}` : "product");

  let candidate = base;
  let counter = 2;
  while (
    await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

type ProductWithRelations = NonNullable<
  Awaited<ReturnType<typeof getProductById>>
>;

function serializeProduct(product: ProductWithRelations) {
  return {
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
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireExplorer(request);
  if (!guard.ok) return guard.response;

  try {
    await ensureDigitalTwinSchema().catch(() => undefined);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const categoryId = searchParams.get("categoryId")?.trim();
    const supplierId = searchParams.get("supplierId")?.trim();
    const lowStock = searchParams.get("lowStock") === "true";
    const includeInactive = searchParams.get("includeInactive") === "true";
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where: Prisma.ProductWhereInput = {};
    if (!includeInactive) where.isActive = true;
    if (categoryId && /^\d+$/.test(categoryId)) {
      where.categoryId = BigInt(categoryId);
    }
    if (supplierId && /^\d+$/.test(supplierId)) {
      where.supplierId = BigInt(supplierId);
    }
    if (lowStock) {
      where.quantity = { lte: LOW_STOCK_THRESHOLD };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const takeNum = take ? Math.min(Math.max(Number(take), 1), 200) : 50;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, supplier: true },
        orderBy: { name: "asc" },
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      prisma.product.count({ where }),
    ]);

    return json({
      products: products.map(serializeProduct),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.max(1, Math.ceil(total / takeNum)),
      },
    });
  } catch (error) {
    console.error("List products failed:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireProductManager(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("A JSON body is required.");
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("A JSON body is required.");
  }

  const input = body as Record<string, unknown>;

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return validation("name", "Product name is required.");
  if (name.length > 255) {
    return validation("name", "Product name must be 255 characters or fewer.");
  }

  const sourceBarcode = normalizeBarcode(
    typeof input.sourceBarcode === "string"
      ? input.sourceBarcode
      : typeof input.barcode === "string"
        ? input.barcode
        : "",
  );
  if (sourceBarcode && !isValidCode128(sourceBarcode)) {
    return validation(
      "sourceBarcode",
      "Scanned barcode must be 1-80 printable ASCII characters.",
    );
  }

  let price: Prisma.Decimal;
  try {
    price = new Prisma.Decimal(String(input.price ?? ""));
  } catch {
    return validation("price", "A valid selling price is required.");
  }
  if (!price.isFinite() || price.lt(0) || price.gt(MAX_MONEY)) {
    return validation("price", "Selling price must be between 0 and 99,999,999.99.");
  }

  const rawCostPrice = input.costPrice;
  let costPrice: Prisma.Decimal;
  try {
    costPrice =
      rawCostPrice === undefined || rawCostPrice === null || rawCostPrice === ""
        ? new Prisma.Decimal(0)
        : new Prisma.Decimal(String(rawCostPrice));
  } catch {
    return validation("costPrice", "Cost price must be a number.");
  }
  if (!costPrice.isFinite() || costPrice.lt(0) || costPrice.gt(MAX_MONEY)) {
    return validation("costPrice", "Cost price must be between 0 and 99,999,999.99.");
  }

  const rawQuantity = input.quantity ?? 0;
  if (typeof rawQuantity !== "number" && typeof rawQuantity !== "string") {
    return validation("quantity", "Opening stock must be a whole number.");
  }
  const quantity = Number(rawQuantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) {
    return validation("quantity", "Opening stock must be a whole number from 0 to 1,000,000.");
  }

  let categoryId: bigint | null = null;
  if (
    input.categoryId !== undefined &&
    input.categoryId !== null &&
    input.categoryId !== ""
  ) {
    try {
      categoryId = BigInt(String(input.categoryId));
    } catch {
      return validation("categoryId", "Category must be a numeric id.");
    }
    if (categoryId <= 0n) {
      return validation("categoryId", "Category must be a numeric id.");
    }
  }

  let supplierId: bigint | null = null;
  if (
    input.supplierId !== undefined &&
    input.supplierId !== null &&
    input.supplierId !== ""
  ) {
    try {
      supplierId = BigInt(String(input.supplierId));
    } catch {
      return validation("supplierId", "Supplier must be a numeric id.");
    }
    if (supplierId <= 0n) {
      return validation("supplierId", "Supplier must be a numeric id.");
    }
  }

  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > 5000) {
    return validation("description", "Description must be 5,000 characters or fewer.");
  }

  try {
    if (categoryId !== null) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) return validation("categoryId", "Category not found.");
    }

    if (supplierId !== null) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true },
      });
      if (!supplier) return validation("supplierId", "Supplier not found.");
    }

    if (sourceBarcode) {
      const duplicateProduct = await prisma.product.findUnique({
        where: { barcode: sourceBarcode },
        select: { id: true },
      });
      if (duplicateProduct) {
        return conflict(
          `Barcode "${sourceBarcode}" is already assigned to a product.`,
        );
      }

      try {
        const duplicateLabel = await prisma.productBarcode.findUnique({
          where: { barcode: sourceBarcode },
          select: { id: true },
        });
        if (duplicateLabel) {
          return conflict(`Barcode "${sourceBarcode}" is already assigned.`);
        }
      } catch (labelError) {
        if (!isMissingBarcodeTable(labelError)) throw labelError;
      }
    }

    const slug = await uniqueSlug(name, sourceBarcode || "product");

    const product = await prisma.$transaction(async (tx) => {
      const inserted = await tx.product.create({
        data: {
          name,
          slug,
          categoryId,
          supplierId,
          price,
          costPrice,
          quantity,
          barcode: `TMP-${randomUUID()}`,
          description,
          isActive: true,
        },
      });

      let systemBarcode = `ZN${inserted.id.toString().padStart(8, "0")}`;
      const collision = await tx.product.findUnique({
        where: { barcode: systemBarcode },
        select: { id: true },
      });
      if (collision) {
        systemBarcode = `${systemBarcode}-${randomUUID().slice(0, 6).toUpperCase()}`;
      }

      const createdProduct = await tx.product.update({
        where: { id: inserted.id },
        data: { barcode: systemBarcode },
      });

      if (quantity > 0) {
        await tx.stockMovement.create({
          data: {
            productId: createdProduct.id,
            quantity,
            movementType: "IN",
          },
        });
      }

      return createdProduct;
    });

    const syncLabel = async (
      barcodeToSync: string,
      isPrimary: boolean,
      unitId?: string,
    ) => {
      try {
        await createProductBarcode({
          productId: product.id,
          barcode: barcodeToSync,
          isPrimary,
          unitId: unitId ?? null,
        });
      } catch (labelError) {
        if (
          !(labelError instanceof BarcodeError && labelError.code === "unavailable")
        ) {
          console.error("Barcode label sync failed:", labelError);
        }
      }
    };

    await syncLabel(product.barcode, true);
    if (sourceBarcode && sourceBarcode !== product.barcode) {
      await syncLabel(sourceBarcode, false, "scanned");
    }

    const fullProduct = await getProductById(product.id);
    if (!fullProduct) {
      return serverError("The product was created but could not be loaded.");
    }

    return created({
      ...serializeProduct(fullProduct),
      sourceBarcode: sourceBarcode || null,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("A product with this barcode or slug already exists.");
    }

    console.error("Create product failed:", error);
    return serverError("Unable to create this product.");
  }
}
