// GET /api/public/digital-twin — Read-only sanitized 3D Store layout for guest
// visitors (`/` and `/store-3d`). Strips internal cost prices, warehouse stock & PII.
// When the 3D layout tables have not yet been initialized by an admin, projects
// live active Product rows from PostgreSQL onto the 18 retail fixtures read-only
// so customers can immediately explore and pick real products off 3D shelves.

import { prisma } from "@/lib/db";
import { json, serverError } from "@/lib/http";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { resolveProductAsset } from "@/lib/digital-twin/asset-manifest";
import { classifyInventoryState } from "@/lib/digital-twin/inventory-state";
import {
  PHYSICAL_AREAS,
  SHELF_FIXTURES,
} from "@/lib/digital-twin/spatial-plan";
import { getDigitalTwinSnapshot } from "@/services/digital-twin.service";
import type {
  DigitalTwinSnapshot,
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
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ quantity: "desc" }, { name: "asc" }],
    take: 140,
  });

  const retailAreas = PHYSICAL_AREAS.filter((a) => a.category === "retail");
  const areaByCode = new Map(retailAreas.map((a) => [a.code, a]));

  // Prepare fixture slot buckets deterministically.
  const shelfBuckets = SHELF_FIXTURES.map((fixture) => {
    const area = areaByCode.get(fixture.departmentCode);
    const slotCount = Math.min(fixture.tiers * fixture.slotsPerTier, 12);
    const maxCap = Math.max(
      12,
      Math.floor(fixture.capacity / Math.max(1, slotCount)),
    );
    const positions: TwinShelfPositionNode[] = Array.from(
      { length: slotCount },
      (_, slotIdx) => {
        const tierNum = Math.floor(slotIdx / fixture.slotsPerTier) + 1;
        const posNum = (slotIdx % fixture.slotsPerTier) + 1;
        const positionCode = `T${tierNum}-P${posNum}`;
        return {
          id: `proj-${fixture.code}-${slotIdx}`,
          shelfId: `proj-shelf-${fixture.code}`,
          shelfCode: fixture.code,
          positionCode,
          objectName: `${fixture.code}_${positionCode}`,
          slotIndex: slotIdx,
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

  // Assign real active database products onto matching department fixtures.
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
    const asset = resolveProductAsset(product.name, product.category?.name);
    const onShelf = Math.max(0, product.quantity);

    slot.quantity = onShelf;
    slot.visualState = classifyInventoryState({
      quantity: onShelf,
      reorderLevel: LOW_STOCK_THRESHOLD,
    });
    slot.product = {
      id: product.id.toString(),
      name: product.name,
      sku: product.sku ?? `SKU-${product.id.toString()}`,
      barcode: product.barcode ?? "",
      categoryId: product.category ? product.category.id.toString() : null,
      categoryName: product.category?.name ?? null,
      price: Number(product.price),
      costPrice: 0,
      totalStock: onShelf,
      assetKey: asset.key,
      assetPath: asset.path,
    };
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

    // Return ONLY customer-facing retail floor data; strip internal warehouse & cost fields.
    const sanitized: DigitalTwinSnapshot = {
      initialized: snapshot.initialized,
      generatedAt: snapshot.generatedAt,
      store: snapshot.store,
      departments: snapshot.departments,
      shelves: snapshot.shelves.map((shelf) => ({
        ...shelf,
        positions: shelf.positions.map((pos) => ({
          ...pos,
          warehouseQuantity: 0,
          reservedQuantity: 0,
          nearestExpiryDate: null,
          product: pos.product
            ? {
                ...pos.product,
                costPrice: 0,
              }
            : null,
        })),
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
