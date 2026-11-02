// GET  /api/products - List active products.
// POST /api/products - Register a product from the inventory terminal.
//
// Product registration is used by the stock page: scan a physical barcode,
// name the product, set its price/opening stock, and make it sellable at the POS.

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
import { isValidCode128, normalizeBarcode } from "@/lib/barcodes";
import { findManyProducts, countProducts, getProductById } from "@/lib/products";
import {
  BarcodeError,
  createProductBarcode,
  isMissingBarcodeTable,
} from "@/services/barcode.service";

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
    price: product.price,
    quantity: product.quantity,
    barcode: product.barcode,
    description: product.description,
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
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const take = searchParams.get("take");
    const page = searchParams.get("page");

    const where = {
      isActive: true,
      ...(categoryId ? { categoryId: BigInt(categoryId) } : {}),
    };

    const takeNum = take ? Math.min(Number(take), 100) : 20;
    const pageNum = page ? Math.max(Number(page), 1) : 1;

    const [products, total] = await Promise.all([
      findManyProducts({
        where,
        take: takeNum,
        skip: pageNum > 1 ? (pageNum - 1) * takeNum : undefined,
      }),
      countProducts(where),
    ]);

    return json({
      products: products.map((p) => ({
        id: p.id.toString(),
        name: p.name,
        slug: p.slug,
        price: p.price,
        quantity: p.quantity,
        barcode: p.barcode,
        description: p.description,
        category: p.category
          ? { id: p.category.id.toString(), name: p.category.name }
          : null,
        supplier: p.supplier
          ? { id: p.supplier.id.toString(), companyName: p.supplier.companyName }
          : null,
        image_available: Boolean(p.imageData),
        createdAt: p.createdAt,
      })),
      pagination: {
        page: pageNum,
        take: takeNum,
        total,
        pages: Math.ceil(total / takeNum),
      },
    });
  } catch (error) {
    console.error("List products failed:", error);
    return json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

  const barcode = normalizeBarcode(
    typeof input.barcode === "string" ? input.barcode : "",
  );
  if (!isValidCode128(barcode)) {
    return validation(
      "barcode",
      "Enter 1-80 printable ASCII characters (Code 128) or scan a product label.",
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

    const duplicateProduct = await prisma.product.findUnique({
      where: { barcode },
      select: { id: true },
    });
    if (duplicateProduct) {
      return conflict(`Barcode "${barcode}" is already assigned to a product.`);
    }

    try {
      const duplicateLabel = await prisma.productBarcode.findUnique({
        where: { barcode },
        select: { id: true },
      });
      if (duplicateLabel) {
        return conflict(`Barcode "${barcode}" is already assigned.`);
      }
    } catch (labelError) {
      // The barcode migration may not have been applied yet. The product's
      // own `barcode` column still supports lookups without that table.
      if (!isMissingBarcodeTable(labelError)) throw labelError;
    }

    const slug = await uniqueSlug(name, barcode);

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          name,
          slug,
          categoryId,
          price,
          costPrice,
          quantity,
          barcode,
          description,
          isActive: true,
        },
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

    // Mirror the product's primary barcode into the labels table when it is
    // available. Product.barcode remains the authoritative scan code.
    try {
      await createProductBarcode({
        productId: product.id,
        barcode,
        isPrimary: true,
      });
    } catch (labelError) {
      if (
        !(labelError instanceof BarcodeError && labelError.code === "unavailable")
      ) {
        console.error("Primary barcode sync failed:", labelError);
      }
    }

    const fullProduct = await getProductById(product.id);
    if (!fullProduct) {
      return serverError("The product was created but could not be loaded.");
    }

    return created(serializeProduct(fullProduct));
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
