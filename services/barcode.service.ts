// Barcode service: resolve scanned Code 128 labels to products and packaging.
//
// `Product.barcode` remains the primary scan code for backwards compatibility.
// `ProductBarcode` adds pack/unit labels (a carton of 12, a shelf label, ...).
// Lookup checks the dedicated table first and falls back to the product table so
// scanners keep working before/without the barcode migration.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeBarcode } from "@/lib/barcodes";

export type BarcodeSource = "product_barcodes" | "product";

export interface BarcodeLookupResult {
  barcode: string;
  barcodeType: string;
  source: BarcodeSource;
  packaging: {
    /** Packaging label, e.g. `each`, `pack`, `carton`. */
    unitId: string;
    /** Base units represented by one scan. */
    quantityMultiplier: number;
    isPrimary: boolean;
  };
  product: {
    id: string;
    name: string;
    slug: string;
    category: { id: string; name: string } | null;
    /** Price of one base unit (the product's current branch price). */
    unitPrice: string;
    /** Price of one scanned package. */
    price: string;
    /** Base units available at the current branch. */
    stock: number;
    isActive: boolean;
  };
  /** Price of one scanned package. */
  price: string;
  /** Base units available at the current branch. */
  stock: number;
  /** Whole packages that can still be sold. */
  availableUnits: number;
  inStock: boolean;
}

export class BarcodeError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "conflict" | "unavailable",
  ) {
    super(message);
    this.name = "BarcodeError";
  }
}

export function isMissingBarcodeTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function toUnitId(unitId: string | null | undefined): string {
  return unitId?.trim() || "each";
}

type ProductBarcodeWithProduct = Prisma.ProductBarcodeGetPayload<{
  include: { product: { include: { category: true } } };
}>;

/** Resolve a scanned barcode to a sellable product line. */
export async function resolveBarcode(
  rawBarcode: string,
): Promise<BarcodeLookupResult | null> {
  const barcode = normalizeBarcode(rawBarcode);

  let record: ProductBarcodeWithProduct | null = null;

  try {
    record = await prisma.productBarcode.findUnique({
      where: { barcode },
      include: { product: { include: { category: true } } },
    });
  } catch (error) {
    // Before the migration is applied the table does not exist yet. The
    // legacy Product.barcode path below still resolves primary labels.
    if (!isMissingBarcodeTable(error)) throw error;
  }

  const product =
    record?.product ??
    (await prisma.product.findUnique({
      where: { barcode },
      include: { category: true },
    }));

  if (!product) return null;

  const quantityMultiplier = record?.quantityMultiplier ?? new Prisma.Decimal(1);
  const unitPrice = new Prisma.Decimal(product.price);
  const packagePrice = unitPrice.times(quantityMultiplier);
  const availableUnits = quantityMultiplier.gt(0)
    ? new Prisma.Decimal(product.quantity)
        .div(quantityMultiplier)
        .floor()
        .toNumber()
    : 0;

  return {
    barcode,
    barcodeType: record?.barcodeType ?? "code128",
    source: record ? "product_barcodes" : "product",
    packaging: {
      unitId: toUnitId(record?.unitId),
      quantityMultiplier: quantityMultiplier.toNumber(),
      isPrimary: record?.isPrimary ?? true,
    },
    product: {
      id: product.id.toString(),
      name: product.name,
      slug: product.slug,
      category: product.category
        ? { id: product.category.id.toString(), name: product.category.name }
        : null,
      unitPrice: unitPrice.toFixed(2),
      price: packagePrice.toFixed(2),
      stock: product.quantity,
      isActive: product.isActive,
    },
    price: packagePrice.toFixed(2),
    stock: product.quantity,
    availableUnits,
    inStock: product.isActive && availableUnits > 0,
  };
}

const barcodeSelect = {
  id: true,
  barcode: true,
  barcodeType: true,
  unitId: true,
  quantityMultiplier: true,
  isPrimary: true,
  createdAt: true,
} satisfies Prisma.ProductBarcodeSelect;

/** List all labels attached to a product, primary label first. */
export async function listProductBarcodes(productId: bigint) {
  try {
    return await prisma.productBarcode.findMany({
      where: { productId },
      select: barcodeSelect,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
  } catch (error) {
    if (isMissingBarcodeTable(error)) return [];
    throw error;
  }
}

export interface CreateProductBarcodeInput {
  productId: bigint;
  barcode: string;
  barcodeType?: string;
  unitId?: string | null;
  quantityMultiplier?: Prisma.Decimal | number | string;
  isPrimary?: boolean;
}

/** Attach a new Code 128 label (pack size or internal shelf label). */
export async function createProductBarcode(input: CreateProductBarcodeInput) {
  const barcode = normalizeBarcode(input.barcode);
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, barcode: true },
  });

  if (!product) {
    throw new BarcodeError("Product not found.", "not_found");
  }

  const [existingLabel, existingProduct] = await Promise.allSettled([
    prisma.productBarcode.findUnique({ where: { barcode } }),
    prisma.product.findUnique({ where: { barcode } }),
  ]);

  if (existingLabel.status === "rejected") {
    if (isMissingBarcodeTable(existingLabel.reason)) {
      throw new BarcodeError(
        "Barcode labels are not available yet. Run the database migration.",
        "unavailable",
      );
    }
    throw existingLabel.reason;
  }
  if (existingProduct.status === "rejected") {
    throw existingProduct.reason;
  }

  if (existingLabel.value) {
    throw new BarcodeError("This barcode is already assigned.", "conflict");
  }
  if (existingProduct.value && existingProduct.value.id !== input.productId) {
    throw new BarcodeError(
      "This barcode already belongs to another product.",
      "conflict",
    );
  }

  const isPrimary = input.isPrimary ?? barcode === product.barcode;
  const quantityMultiplier = new Prisma.Decimal(
    input.quantityMultiplier ?? 1,
  );

  try {
    return await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.productBarcode.updateMany({
          where: { productId: input.productId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.productBarcode.create({
        data: {
          productId: input.productId,
          barcode,
          barcodeType: input.barcodeType ?? "code128",
          unitId: input.unitId?.trim() || null,
          quantityMultiplier,
          isPrimary,
        },
        select: barcodeSelect,
      });
    });
  } catch (error) {
    if (isMissingBarcodeTable(error)) {
      throw new BarcodeError(
        "Barcode labels are not available yet. Run the database migration.",
        "unavailable",
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BarcodeError("This barcode is already assigned.", "conflict");
    }
    throw error;
  }
}
