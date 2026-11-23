// GET /api/public/digital-twin — Read-only sanitized 3D Store layout for guest
// visitors (`/` and `/store-3d`). Strips internal cost prices, warehouse stock & PII.
// Includes real product photos, descriptions, and ProductBarcode pack/carton
// variants. When the 3D layout tables have not yet been initialized by an admin,
// projects live active Product rows from PostgreSQL onto the 18 retail fixtures.

import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/http";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { resolveEffectiveProductAsset } from "@/lib/digital-twin/asset-manifest";
import { classifyInventoryState } from "@/lib/digital-twin/inventory-state";
import {
  PHYSICAL_AREAS,
  SHELF_FIXTURES,
} from "@/lib/digital-twin/spatial-plan";
import { getDigitalTwinSnapshot } from "@/services/digital-twin.service";
import type {
  DigitalTwinSnapshot,
  ProductPackOption,
  TwinDepartmentNode,
  TwinShelfNode,
  TwinShelfPositionNode,
} from "@/types/digital-twin";

export const dynamic = "force-dynamic";

function departmentCodeForProduct(
  name: string,
  categoryName?: string | null,
): string {
  const s = `${name} ${categoryName ?? ""}`.toLowerCase();
  if (/\b(cola|coke|soda|water|juice|drink|beverage|fanta|sprite)\b/.test(s)) {
    return "BEV";
  }
  if (/\b(milk|yogurt|cheese|butter|egg|dairy)\b/.test(s)) return "DAI";
  if (/\b(frozen|ice\s?cream)\b/.test(s)) return "FRZ";
  if (/\b(bread|cake|pastry|bakery|bun|croissant)\b/.test(s)) return "BAK";
  if (/\b(beef|chicken|meat|fish|seafood|tuna|mutton)\b/.test(s)) return "MEA";
  if (/\b(apple|banana|mango|tomato|onion|fruit|vegetable|produce)\b/.test(s)) {
    return "PRO";
  }
  if (/\b(soap|shampoo|toothpaste|lotion|cosmetic|perfume|cream)\b/.test(s)) {
    return "COS";
  }
  if (/\b(detergent|bleach|tissue|paper|clean|household)\b/.test(s)) {
    return "HSH";
  }
  if (/\b(battery|charger|cable|bulb|electronic|kettle)\b/.test(s)) {
    return "ELC";
  }
  return "GRO";
}

function buildPackOptions(
  unitPrice: number,
  primaryBarcode: string,
  barcodes: Array<{
    id: string;
    barcode: string;
    unitId: string | null;
    quantityMultiplier: unknown;
  }>,
): ProductPackOption[] {
  const options: ProductPackOption[] = [
    {
      id: "single",
      label: "Single (1×)",
      barcode: primaryBarcode,
      quantityMultiplier: 1,
      packPrice: unitPrice,
    },
  ];
  const seenMultipliers = new Set<number>([1]);
  for (const b of barcodes) {
    const mult = Math.round(Number(b.quantityMultiplier));
    if (!Number.isFinite(mult) || mult <= 1 || seenMultipliers.has(mult)) {
      continue;
    }
    seenMultipliers.add(mult);
    const labelBase =
      b.unitId && b.unitId !== "each" ? b.unitId : `${mult}-Pack`;
    options.push({
      id: b.id,
      label: `${labelBase} (${mult}×)`,
      barcode: b.barcode,
      quantityMultiplier: mult,
      packPrice: unitPrice * mult,
    });
  }
  return options.sort((a, b) => a.quantityMultiplier - b.quantityMultiplier);
}

interface PublicProductMeta {
  imageUrl: string | null;
  description: string;
  packOptions: ProductPackOption[];
}

async function loadPublicProductMetaMap(
  productIds: string[],
): Promise<Map<string, PublicProductMeta>> {
  const bigIds = productIds
    .filter((id) => /^\d+$/.test(id))
    .map((id) => BigInt(id));
  if (bigIds.length === 0) return new Map();

  const rows = await prisma.product.findMany({
    where: { id: { in: bigIds } },
    select: {
      id: true,
      price: true,
      barcode: true,
      imageName: true,
      description: true,
      updatedAt: true,
      barcodes: {
        select: {
          id: true,
          barcode: true,
          unitId: true,
          quantityMultiplier: true,
        },
        orderBy: { quantityMultiplier: "asc" },
      },
    },
  });

  const map = new Map<string, PublicProductMeta>();
  for (const row of rows) {
    const idStr = row.id.toString();
    map.set(idStr, {
      imageUrl: row.imageName
        ? `/api/public/products/${idStr}/image?v=${row.updatedAt.getTime()}`
        : null,
      description: row.description ?? "",
      packOptions: buildPackOptions(
        Number(row.price),
        row.barcode,
        row.barcodes,
      ),
    });
  }
  return map;
}

async function buildLiveReadOnlyRetailProjection(): Promise<DigitalTwinSnapshot> {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      price: true,
      quantity: true,
      barcode: true,
      sku: true,
      imageName: true,
      description: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      modelAsset: { select: { assetKey: true, version: true } },
      barcodes: {
        select: {
          id: true,
          barcode: true,
          unitId: true,
          quantityMultiplier: true,
        },
        orderBy: { quantityMultiplier: "asc" },
      },
    },
    orderBy: [{ quantity: "desc" }, { name: "asc" }],
    take: 140,
  });

  const retailAreas = PHYSICAL_AREAS.filter((a) => a.category === "retail");
  const areaByCode = new Map(retailAreas.map((a) => [a.code, a]));

  const shelfBuckets = SHELF_FIXTURES.map((fixture) => {
    const area = areaByCode.get(fixture.departmentCode);
    const isZLong = fixture.size[2] >= fixture.size[0];
    const isDoubleSided =
      isZLong && fixture.kind !== "refrigerator" && fixture.kind !== "meat_counter";
    const columnCount = isDoubleSided
      ? fixture.slotsPerTier * 2
      : fixture.slotsPerTier;
    const maxCap = Math.max(
      24,
      Math.floor(fixture.capacity / Math.max(1, columnCount)),
    );
    const positions: TwinShelfPositionNode[] = Array.from(
      { length: columnCount },
      (_, colIdx) => {
        const positionCode = `COL_${String(colIdx + 1).padStart(2, "0")}`;
        return {
          id: `proj-${fixture.code}-${colIdx}`,
          shelfId: `proj-shelf-${fixture.code}`,
          shelfCode: fixture.code,
          positionCode,
          objectName: `${fixture.code}_${positionCode}`,
          slotIndex: colIdx,
          quantity: 0,
          maximumCapacity: maxCap,
          reservedQuantity: 0,
          warehouseQuantity: 0,
          reorderLevel: LOW_STOCK_THRESHOLD,
          visualState: "out",
          nearestExpiryDate: null,
          product: null,
        };
      },
    );

    return {
      fixture,
      area,
      positions,
      cursor: 0,
    };
  });

  // Track overflow units for high-stock products whose quantity exceeds 1 full 4-row column
  const overflowQueue: Array<{
    bucket: (typeof shelfBuckets)[number];
    remaining: number;
    productPayload: NonNullable<TwinShelfPositionNode["product"]>;
  }> = [];

  for (const product of products) {
    const deptCode = departmentCodeForProduct(
      product.name,
      product.category?.name,
    );
    const preferred = shelfBuckets.find(
      (b) =>
        b.fixture.departmentCode === deptCode && b.cursor < b.positions.length,
    );
    const targetBucket =
      preferred ?? shelfBuckets.find((b) => b.cursor < b.positions.length);
    if (!targetBucket) break;

    const slot = targetBucket.positions[targetBucket.cursor];
    targetBucket.cursor += 1;
    const asset = resolveEffectiveProductAsset({
      name: product.name,
      categoryName: product.category?.name ?? null,
      storedAssetKey: product.modelAsset?.assetKey ?? null,
      storedAssetVersion: product.modelAsset?.version ?? null,
    }).entry;
    const totalQty = Math.max(0, product.quantity);
    const inFirstColumn = Math.min(totalQty, slot.maximumCapacity);
    const overflowQty = Math.max(0, totalQty - inFirstColumn);
    const idStr = product.id.toString();

    const productPayload: NonNullable<TwinShelfPositionNode["product"]> = {
      id: idStr,
      name: product.name,
      sku: product.sku ?? `SKU-${idStr}`,
      barcode: product.barcode ?? "",
      categoryId: product.category ? product.category.id.toString() : null,
      categoryName: product.category?.name ?? null,
      price: Number(product.price),
      costPrice: 0,
      totalStock: totalQty,
      assetKey: asset.key,
      assetPath: asset.path,
      imageUrl: product.imageName
        ? `/api/public/products/${idStr}/image?v=${product.updatedAt.getTime()}`
        : null,
      description: product.description ?? "",
      packOptions: buildPackOptions(
        Number(product.price),
        product.barcode,
        product.barcodes,
      ),
    };

    slot.quantity = inFirstColumn;
    slot.visualState = classifyInventoryState({
      quantity: inFirstColumn,
      reorderLevel: LOW_STOCK_THRESHOLD,
    });
    slot.product = productPayload;

    if (overflowQty > 0) {
      overflowQueue.push({
        bucket: targetBucket,
        remaining: overflowQty,
        productPayload,
      });
    }
  }

  // When a product's 4-row column is full, allocate an extra column on the same
  // shelf for the SAME product (never mixing different products into one column).
  for (const ov of overflowQueue) {
    let rem = ov.remaining;
    while (rem > 0 && ov.bucket.positions.length < 10) {
      const targetCol =
        ov.bucket.cursor < ov.bucket.positions.length
          ? ov.bucket.positions[ov.bucket.cursor++]
          : (() => {
              const colIdx = ov.bucket.positions.length;
              const colCap = ov.bucket.positions[0]?.maximumCapacity ?? 24;
              const code = `COL_${String(colIdx + 1).padStart(2, "0")}`;
              const added: TwinShelfPositionNode = {
                id: `proj-${ov.bucket.fixture.code}-${colIdx}`,
                shelfId: `proj-shelf-${ov.bucket.fixture.code}`,
                shelfCode: ov.bucket.fixture.code,
                positionCode: code,
                objectName: `${ov.bucket.fixture.code}_${code}`,
                slotIndex: colIdx,
                quantity: 0,
                maximumCapacity: colCap,
                reservedQuantity: 0,
                warehouseQuantity: 0,
                reorderLevel: LOW_STOCK_THRESHOLD,
                visualState: "out",
                nearestExpiryDate: null,
                product: null,
              };
              ov.bucket.positions.push(added);
              ov.bucket.cursor = ov.bucket.positions.length;
              return added;
            })();

      const take = Math.min(rem, targetCol.maximumCapacity);
      targetCol.quantity = take;
      targetCol.visualState = classifyInventoryState({
        quantity: take,
        reorderLevel: LOW_STOCK_THRESHOLD,
      });
      targetCol.product = ov.productPayload;
      rem -= take;
    }
  }

  let totalShelfUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const shelves: TwinShelfNode[] = shelfBuckets.map(
    ({ fixture, area, positions }) => {
      const placed = positions.filter((p) => p.product !== null);
      const shelfUnits = placed.reduce((s, p) => s + p.quantity, 0);
      const shelfLow = placed.filter((p) => p.visualState === "low").length;
      const shelfOut = placed.filter((p) => p.visualState === "out").length;
      totalShelfUnits += shelfUnits;
      lowStockCount += shelfLow;
      outOfStockCount += shelfOut;

      return {
        id: `proj-shelf-${fixture.code}`,
        code: fixture.code,
        name: fixture.name,
        departmentId: `proj-dept-${fixture.departmentCode}`,
        departmentCode: fixture.departmentCode,
        departmentName: area?.name ?? fixture.departmentCode,
        kind: fixture.kind,
        capacity: fixture.capacity,
        status: "active",
        objectName: `Shelf_${fixture.code}`,
        position: fixture.position,
        rotationY: fixture.rotationY,
        size: fixture.size,
        tiers: fixture.tiers,
        slotsPerTier: fixture.slotsPerTier,
        totalUnits: shelfUnits,
        productCount: placed.length,
        lowStockCount: shelfLow,
        emptyPositions: positions.length - placed.length,
        restockNeeded: shelfLow > 0 || shelfOut > 0,
        visualState:
          shelfOut > 0 ? "out" : shelfLow > 0 ? "low" : "normal",
        positions,
      };
    },
  );

  const departments: TwinDepartmentNode[] = retailAreas.map((area) => {
    const deptShelves = shelves.filter((s) => s.departmentCode === area.code);
    const deptPositions = deptShelves
      .flatMap((s) => s.positions)
      .filter((p) => p.product !== null);
    return {
      id: `proj-dept-${area.code}`,
      code: area.code,
      name: area.name,
      description: area.description,
      status: "active",
      shelvesCount: deptShelves.length,
      productCount: deptPositions.length,
      totalUnits: deptShelves.reduce((sum, s) => sum + s.totalUnits, 0),
      lowStockCount: deptPositions.filter((p) => p.visualState === "low").length,
      outOfStockCount: deptPositions.filter((p) => p.visualState === "out")
        .length,
      expiredCount: 0,
    };
  });

  return {
    initialized: true,
    generatedAt: now.toISOString(),
    store: {
      id: "proj-store",
      name: "Supermarket Zanzibar",
      address: "Stone Town Main Road, Zanzibar",
      location: "Zanzibar, Tanzania",
      status: "active",
    },
    departments,
    shelves,
    warehouseRacks: [],
    mappings: [],
    summary: {
      totalProducts: products.length,
      totalShelfUnits,
      totalWarehouseUnits: 0,
      lowStockCount,
      outOfStockCount,
      expiringSoonCount: 0,
      expiredCount: 0,
    },
  };
}

export async function GET() {
  try {
    const snapshot = await getDigitalTwinSnapshot();

    const placedCount = snapshot.shelves.reduce(
      (sum, shelf) => sum + shelf.productCount,
      0,
    );

    if (
      !snapshot.initialized ||
      snapshot.shelves.length === 0 ||
      placedCount === 0
    ) {
      const liveProjection = await buildLiveReadOnlyRetailProjection();
      return json(liveProjection);
    }

    const placedIds = Array.from(
      new Set(
        snapshot.shelves
          .flatMap((s) => s.positions)
          .map((p) => p.product?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const metaById = await loadPublicProductMetaMap(placedIds);

    // Return ONLY customer-facing retail floor data; strip internal warehouse & cost fields.
    const sanitized: DigitalTwinSnapshot = {
      initialized: snapshot.initialized,
      generatedAt: snapshot.generatedAt,
      store: snapshot.store,
      departments: snapshot.departments,
      shelves: snapshot.shelves.map((shelf) => ({
        ...shelf,
        positions: shelf.positions.map((pos) => {
          const meta = pos.product ? metaById.get(pos.product.id) : undefined;
          return {
            ...pos,
            warehouseQuantity: 0,
            reservedQuantity: 0,
            nearestExpiryDate: null,
            product: pos.product
              ? {
                  ...pos.product,
                  costPrice: 0,
                  imageUrl: meta?.imageUrl ?? null,
                  description: meta?.description ?? "",
                  packOptions: meta?.packOptions ?? [
                    {
                      id: "single",
                      label: "Single (1×)",
                      barcode: pos.product.barcode,
                      quantityMultiplier: 1,
                      packPrice: pos.product.price,
                    },
                  ],
                }
              : null,
          };
        }),
      })),
      warehouseRacks: [],
      mappings: [],
      summary: {
        totalProducts: snapshot.summary.totalProducts,
        totalShelfUnits: snapshot.summary.totalShelfUnits,
        totalWarehouseUnits: 0,
        lowStockCount: snapshot.summary.lowStockCount,
        outOfStockCount: snapshot.summary.outOfStockCount,
        expiringSoonCount: 0,
        expiredCount: 0,
      },
    };

    return json(sanitized);
  } catch (error) {
    console.error("Load public 3D store failed:", error);
    return serverError("Unable to load public 3D store view.");
  }
}
