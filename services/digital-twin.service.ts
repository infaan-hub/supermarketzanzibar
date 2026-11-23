// Digital Twin core service — connects 3D objects, shelves, departments, and
// warehouse racks strictly to PostgreSQL records (Phases 7, 8, 9, 10, 14, 15).
//
// Zero fabricated/random inventory quantities: every shelf slot and warehouse
// rack cell reflects real rows in PostgreSQL.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PHYSICAL_AREAS,
  SHELF_FIXTURES,
  WAREHOUSE_RACKS,
  findFixtureByCode,
  findRackByCode,
  shelfSlotWorldPosition,
  warehouseSlotWorldPosition,
} from "@/lib/digital-twin/spatial-plan";
import {
  ASSET_MANIFEST,
  resolveEffectiveProductAsset,
  resolveProductAsset,
} from "@/lib/digital-twin/asset-manifest";
import { classifyInventoryState } from "@/lib/digital-twin/inventory-state";
import { publishInventoryEvent } from "@/lib/realtime/event-bus";
import { recordAuditLog } from "@/lib/audit";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { ensureDigitalTwinSchema } from "@/lib/digital-twin/ensure-schema";
import type {
  DigitalTwinSnapshot,
  TwinDepartmentNode,
  TwinLocateResult,
  TwinShelfNode,
  TwinShelfPositionNode,
  TwinWarehousePositionNode,
  TwinWarehouseRackNode,
} from "@/types/digital-twin";

export const DEFAULT_STORE_CODE = "ZNZ-MAIN";

export class DigitalTwinError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "DigitalTwinError";
  }
}

export function isMissingTwinTables(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

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

/**
 * Idempotently initialize the physical 3D Digital Twin layout in PostgreSQL:
 * Store, 10 Retail Departments, 18 Shelves + ShelfPositions, WarehouseLocations
 * (Zones A-D), all 31 ThreeDAssets, ThreeDObjectMappings, and map existing real
 * Product records using their actual `Product.quantity`.
 */
export async function initializeDigitalTwinLayout(actorId?: bigint | null) {
  // Automatically ensure all strictly additive Digital Twin tables & nullable
  // columns exist in PostgreSQL (safe & idempotent on existing Neon DBs).
  await ensureDigitalTwinSchema();

  const store = await prisma.store.upsert({
    where: { code: DEFAULT_STORE_CODE },
    update: {},
    create: {
      code: DEFAULT_STORE_CODE,
      name: "Supermarket Zanzibar — Flagship",
      address: "Stone Town Main Road, Zanzibar",
      location: "Zanzibar, Tanzania",
      status: "active",
    },
  });

  // 1. Bulk-register all 31 validated GLB assets (2 queries instead of 31).
  await prisma.threeDAsset.createMany({
    data: ASSET_MANIFEST.map((entry) => ({
      assetKey: entry.key,
      assetName: entry.name,
      assetType: entry.category,
      filePath: entry.path,
      format: entry.format,
      version: entry.version,
      metadata: { source: entry.source, defaultScale: entry.defaultScale },
    })),
    skipDuplicates: true,
  });
  const allAssets = await prisma.threeDAsset.findMany({
    select: { id: true, assetKey: true },
  });
  const assetIdByKey = new Map(allAssets.map((a) => [a.assetKey, a.id]));

  // 2. Bulk-register all 10 retail departments (2 queries instead of 10).
  const retailAreas = PHYSICAL_AREAS.filter((a) => a.category === "retail");
  await prisma.department.createMany({
    data: retailAreas.map((area) => ({
      storeId: store.id,
      code: area.code,
      name: area.name,
      description: area.description,
      status: "active",
    })),
    skipDuplicates: true,
  });
  const allDepts = await prisma.department.findMany({
    where: { storeId: store.id },
    select: { id: true, code: true },
  });
  const deptByCode = new Map(allDepts.map((d) => [d.code, d.id]));

  // 3. Bulk-register all 18 shelves + 108 shelf positions (4 queries instead of 126).
  await prisma.shelf.createMany({
    data: SHELF_FIXTURES.flatMap((fixture) => {
      const departmentId = deptByCode.get(fixture.departmentCode);
      if (!departmentId) return [];
      return [
        {
          storeId: store.id,
          departmentId,
          shelfCode: fixture.code,
          shelfName: fixture.name,
          fixtureKind: fixture.kind,
          capacity: fixture.capacity,
          status: "active",
        },
      ];
    }),
    skipDuplicates: true,
  });
  const allShelves = await prisma.shelf.findMany({
    where: { storeId: store.id },
    select: { id: true, shelfCode: true },
  });
  const shelfByCode = new Map(allShelves.map((s) => [s.shelfCode, s.id]));

  const positionSeedRows: Array<{
    shelfId: string;
    positionCode: string;
    slotIndex: number;
    quantity: number;
    maximumCapacity: number;
    reorderLevel: number;
  }> = [];
  const mappingSeedRows: Array<{
    objectName: string;
    objectType: string;
    linkedEntityType: string;
    linkedEntityId: string;
    assetId: string | null;
    posX: number;
    posY: number;
    posZ: number;
    rotY: number;
  }> = [];

  for (const fixture of SHELF_FIXTURES) {
    const shelfId = shelfByCode.get(fixture.code);
    if (!shelfId) continue;

    mappingSeedRows.push({
      objectName: fixture.code,
      objectType: "SHELF",
      linkedEntityType: "SHELF",
      linkedEntityId: shelfId,
      assetId: assetIdByKey.get(fixture.assetKey) ?? null,
      posX: fixture.position[0],
      posY: fixture.position[1],
      posZ: fixture.position[2],
      rotY: fixture.rotationY,
    });

    const isZLong = fixture.size[2] >= fixture.size[0];
    const isDoubleSided =
      isZLong && fixture.kind !== "refrigerator" && fixture.kind !== "meat_counter";
    const totalColumns = isDoubleSided
      ? fixture.slotsPerTier * 2
      : fixture.slotsPerTier;
    for (let col = 0; col < totalColumns; col += 1) {
      positionSeedRows.push({
        shelfId,
        positionCode: `COL_${String(col + 1).padStart(2, "0")}`,
        slotIndex: col,
        quantity: 0,
        maximumCapacity: 24,
        reorderLevel: 6,
      });
    }
  }

  await prisma.shelfPosition.createMany({
    data: positionSeedRows,
    skipDuplicates: true,
  });

  // 4. Bulk-register all 72 warehouse rack locations (Zones A-D) (2 queries instead of 144).
  const whSeedRows: Array<{
    storeId: string;
    warehouseCode: string;
    zoneCode: string;
    rackCode: string;
    levelCode: string;
    positionCode: string;
    locationType: string;
    capacity: number;
    status: string;
  }> = [];

  for (const rack of WAREHOUSE_RACKS) {
    for (let lvl = 0; lvl < rack.levels; lvl += 1) {
      const levelCode = `Level_${String(lvl + 1).padStart(2, "0")}`;
      for (let p = 0; p < rack.positionsPerLevel; p += 1) {
        whSeedRows.push({
          storeId: store.id,
          warehouseCode: "WH-MAIN",
          zoneCode: rack.zoneCode,
          rackCode: rack.rackCode,
          levelCode,
          positionCode: `Position_${String(p + 1).padStart(3, "0")}`,
          locationType: rack.locationType,
          capacity: 200,
          status: "active",
        });
      }
    }
  }

  await prisma.warehouseLocation.createMany({
    data: whSeedRows,
    skipDuplicates: true,
  });
  const whLocations = await prisma.warehouseLocation.findMany({
    where: { storeId: store.id },
    orderBy: [{ rackCode: "asc" }, { levelCode: "asc" }, { positionCode: "asc" }],
    select: {
      id: true,
      rackCode: true,
      zoneCode: true,
      levelCode: true,
      positionCode: true,
    },
  });

  const whRackAssetId = assetIdByKey.get("furniture/warehouse-rack") ?? null;
  for (const loc of whLocations) {
    const rack = findRackByCode(loc.rackCode);
    const lvlIdx = Math.max(0, Number(loc.levelCode.replace(/\D/g, "")) - 1);
    const posIdx = Math.max(0, Number(loc.positionCode.replace(/\D/g, "")) - 1);
    const coords = rack
      ? warehouseSlotWorldPosition(rack, lvlIdx, posIdx)
      : ([0, 1, -20] as [number, number, number]);
    mappingSeedRows.push({
      objectName: `${loc.rackCode}_${loc.levelCode}_${loc.positionCode}`,
      objectType: "WAREHOUSE_LOCATION",
      linkedEntityType: "WAREHOUSE_LOCATION",
      linkedEntityId: loc.id,
      assetId: whRackAssetId,
      posX: coords[0],
      posY: coords[1],
      posZ: coords[2],
      rotY: 0,
    });
  }

  // 5. Place existing real Products that do not yet have a shelf position,
  // splitting their REAL `product.quantity` between shelf capacity and warehouse reserve.
  const [products, emptySlots] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, shelfPositions: true, inventoryRecords: true },
      orderBy: { id: "asc" },
    }),
    prisma.shelfPosition.findMany({
      where: { shelf: { storeId: store.id }, productId: null },
      include: { shelf: { select: { shelfCode: true } } },
      orderBy: [{ shelf: { shelfCode: "asc" } }, { slotIndex: "asc" }],
    }),
  ]);

  const availableSlots = [...emptySlots];
  const productUpdates: Array<Promise<unknown>> = [];
  const slotUpdates: Array<Promise<unknown>> = [];
  const inventorySeedRows: Array<{
    productId: bigint;
    storeId: string;
    warehouseLocationId: string;
    quantityOnHand: number;
    reorderLevel: number;
  }> = [];

  let whCursor = 0;
  for (const product of products) {
    const assetEntry = resolveProductAsset(product.name, product.category?.name);
    const modelAssetId = assetIdByKey.get(assetEntry.key) ?? null;

    if (!product.sku) {
      productUpdates.push(
        prisma.product.update({
          where: { id: product.id },
          data: {
            sku: `SKU-${product.id.toString().padStart(5, "0")}`,
          },
        }),
      );
    }

    if (product.shelfPositions.length === 0 && availableSlots.length > 0) {
      const deptCode = departmentCodeForProduct(
        product.name,
        product.category?.name,
      );
      const preferredShelfIds = new Set(
        SHELF_FIXTURES.filter((f) => f.departmentCode === deptCode)
          .map((f) => shelfByCode.get(f.code))
          .filter((id): id is string => Boolean(id)),
      );

      let slotIdx = availableSlots.findIndex((s) =>
        preferredShelfIds.has(s.shelfId),
      );
      if (slotIdx === -1) slotIdx = 0;

      const [emptySlot] = availableSlots.splice(slotIdx, 1);
      if (emptySlot) {
        const onShelf = Math.min(product.quantity, emptySlot.maximumCapacity);
        const inWarehouse = Math.max(0, product.quantity - onShelf);

        slotUpdates.push(
          prisma.shelfPosition.update({
            where: { id: emptySlot.id },
            data: { productId: product.id, quantity: onShelf },
          }),
        );

        const fixture = findFixtureByCode(emptySlot.shelf.shelfCode);
        const slotCoords = fixture
          ? shelfSlotWorldPosition(fixture, emptySlot.slotIndex)
          : ([0, 1, 0] as [number, number, number]);

        mappingSeedRows.push({
          objectName: `${emptySlot.shelf.shelfCode}_${emptySlot.positionCode}`,
          objectType: "PRODUCT_POSITION",
          linkedEntityType: "PRODUCT",
          linkedEntityId: product.id.toString(),
          assetId: modelAssetId,
          posX: slotCoords[0],
          posY: slotCoords[1],
          posZ: slotCoords[2],
          rotY: 0,
        });

        if (product.inventoryRecords.length === 0 && whLocations.length > 0) {
          const whTarget = whLocations[whCursor % whLocations.length];
          whCursor += 1;
          inventorySeedRows.push({
            productId: product.id,
            storeId: store.id,
            warehouseLocationId: whTarget.id,
            quantityOnHand: inWarehouse,
            reorderLevel: LOW_STOCK_THRESHOLD,
          });
        }
      }
    }
  }

  // Execute product, shelf-slot, warehouse inventory, and 3D mapping writes in bulk.
  if (productUpdates.length > 0) {
    await Promise.all(productUpdates);
  }
  if (slotUpdates.length > 0) {
    await Promise.all(slotUpdates);
  }
  if (inventorySeedRows.length > 0) {
    await prisma.inventory.createMany({
      data: inventorySeedRows,
      skipDuplicates: true,
    });
  }
  if (mappingSeedRows.length > 0) {
    await prisma.threeDObjectMapping.createMany({
      data: mappingSeedRows,
      skipDuplicates: true,
    });
  }

  await recordAuditLog({
    actorId,
    action: "TWIN_INITIALIZED",
    entityType: "STORE",
    entityId: store.id,
    summary: `Initialized 3D Digital Twin layout for ${store.name} (${products.length} products mapped).`,
  });

  publishInventoryEvent({
    type: "twin_initialized",
    summary: `Digital Twin synchronized (${products.length} products mapped).`,
  });

  return getDigitalTwinSnapshot();
}

/** Build the complete live Digital Twin state directly from PostgreSQL. */
export async function getDigitalTwinSnapshot(): Promise<DigitalTwinSnapshot> {
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  let store;
  try {
    store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  } catch (error) {
    if (isMissingTwinTables(error)) {
      // Auto-create additive tables once on first access if deploy build skipped DB.
      try {
        await ensureDigitalTwinSchema(true);
        store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
      } catch (retryError) {
        if (isMissingTwinTables(retryError)) {
          return {
            initialized: false,
            generatedAt: now.toISOString(),
            store: null,
            departments: [],
            shelves: [],
            warehouseRacks: [],
            mappings: [],
            summary: {
              totalProducts: 0,
              totalShelfUnits: 0,
              totalWarehouseUnits: 0,
              lowStockCount: 0,
              outOfStockCount: 0,
              expiringSoonCount: 0,
              expiredCount: 0,
            },
          };
        }
        throw retryError;
      }
    } else {
      throw error;
    }
  }

  if (!store) {
    return {
      initialized: false,
      generatedAt: now.toISOString(),
      store: null,
      departments: [],
      shelves: [],
      warehouseRacks: [],
      mappings: [],
      summary: {
        totalProducts: 0,
        totalShelfUnits: 0,
        totalWarehouseUnits: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        expiringSoonCount: 0,
        expiredCount: 0,
      },
    };
  }

  const [departments, shelves, whLocations, inventories, batches, mappings, activeProductsCount] =
    await Promise.all([
      prisma.department.findMany({
        where: { storeId: store.id },
        orderBy: { code: "asc" },
      }),
      prisma.shelf.findMany({
        where: { storeId: store.id },
        include: {
          department: true,
          positions: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  categoryId: true,
                  price: true,
                  costPrice: true,
                  quantity: true,
                  imageName: true,
                  imageContentType: true,
                  description: true,
                  updatedAt: true,
                  category: { select: { id: true, name: true } },
                  modelAsset: { select: { assetKey: true, version: true } },
                },
              },
            },
            orderBy: { slotIndex: "asc" },
          },
        },
        orderBy: { shelfCode: "asc" },
      }),
      prisma.warehouseLocation.findMany({
        where: { storeId: store.id },
        orderBy: [{ rackCode: "asc" }, { levelCode: "asc" }, { positionCode: "asc" }],
      }),
      prisma.inventory.findMany({
        where: { storeId: store.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              price: true,
              costPrice: true,
              quantity: true,
              imageName: true,
              imageContentType: true,
              description: true,
              updatedAt: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.inventoryBatch.findMany({
        where: { storeId: store.id, quantity: { gt: 0 } },
        orderBy: { expiryDate: "asc" },
      }),
      prisma.threeDObjectMapping.findMany({
        include: { asset: true },
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);

  // Aggregate warehouse stock by productId and by warehouseLocationId.
  const whTotalByProduct = new Map<string, number>();
  const invByWhLocation = new Map<string, (typeof inventories)[number]>();
  for (const inv of inventories) {
    const pid = inv.productId.toString();
    whTotalByProduct.set(pid, (whTotalByProduct.get(pid) ?? 0) + inv.quantityOnHand);
    if (inv.warehouseLocationId) {
      const existing = invByWhLocation.get(inv.warehouseLocationId);
      if (!existing || inv.quantityOnHand > existing.quantityOnHand) {
        invByWhLocation.set(inv.warehouseLocationId, inv);
      }
    }
  }

  // Track expired & nearest-expiring batches per productId.
  const expiredProducts = new Set<string>();
  const nearestExpiryByProduct = new Map<string, string>();
  let expiringSoonCount = 0;
  let expiredCount = 0;

  for (const batch of batches) {
    const pid = batch.productId.toString();
    if (!batch.expiryDate) continue;
    if (!nearestExpiryByProduct.has(pid)) {
      nearestExpiryByProduct.set(pid, batch.expiryDate.toISOString());
    }
    if (batch.expiryDate.getTime() < now.getTime() || batch.status === "expired") {
      expiredProducts.add(pid);
      expiredCount += 1;
    } else if (batch.expiryDate.getTime() <= soonThreshold.getTime()) {
      expiringSoonCount += 1;
    }
  }

  let totalShelfUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const shelfNodes: TwinShelfNode[] = shelves.map((shelf) => {
    const fixture = findFixtureByCode(shelf.shelfCode);
    const positions: TwinShelfPositionNode[] = shelf.positions.map((pos) => {
      const prod = pos.product;
      const pid = prod?.id.toString() ?? null;
      const isExpired = pid ? expiredProducts.has(pid) : false;
      const visualState = prod
        ? classifyInventoryState({
            quantity: pos.quantity,
            reorderLevel: pos.reorderLevel,
            reservedQuantity: pos.reservedQuantity,
            isExpired,
          })
        : "out";

      if (prod) {
        totalShelfUnits += pos.quantity;
        if (pos.quantity <= 0) outOfStockCount += 1;
        else if (pos.quantity <= pos.reorderLevel) lowStockCount += 1;
      }

      const resolvedAsset = prod
        ? resolveEffectiveProductAsset({
            name: prod.name,
            categoryName: prod.category?.name ?? null,
            storedAssetKey: prod.modelAsset?.assetKey ?? null,
            storedAssetVersion: prod.modelAsset?.version ?? null,
          }).entry
        : null;

      return {
        id: pos.id,
        shelfId: shelf.id,
        shelfCode: shelf.shelfCode,
        positionCode: pos.positionCode,
        objectName: `${shelf.shelfCode}_${pos.positionCode}`,
        slotIndex: pos.slotIndex,
        quantity: pos.quantity,
        maximumCapacity: pos.maximumCapacity,
        reservedQuantity: pos.reservedQuantity,
        warehouseQuantity: pid ? (whTotalByProduct.get(pid) ?? 0) : 0,
        reorderLevel: pos.reorderLevel,
        visualState,
        nearestExpiryDate: pid ? (nearestExpiryByProduct.get(pid) ?? null) : null,
        product: prod
          ? {
              id: prod.id.toString(),
              name: prod.name,
              sku: prod.sku ?? `SKU-${prod.id.toString().padStart(5, "0")}`,
              barcode: prod.barcode,
              categoryId: prod.categoryId ? prod.categoryId.toString() : null,
              categoryName: prod.category?.name ?? null,
              price: Number(prod.price),
              costPrice: Number(prod.costPrice),
              totalStock: prod.quantity,
              assetKey: resolvedAsset?.key ?? "products/groceries/cereal-box",
              assetPath:
                resolvedAsset?.path ?? "/models/products/groceries/cereal-box.glb",
              imageUrl:
                prod.imageName || prod.imageContentType
                  ? `/api/products/${prod.id.toString()}/image?v=${prod.updatedAt.getTime()}`
                  : null,
              description: prod.description ?? "",
            }
          : null,
      };
    });

    const assignedPositions = positions.filter((p) => p.product !== null);
    const shelfUnits = positions.reduce((sum, p) => sum + p.quantity, 0);
    const shelfLow = assignedPositions.filter(
      (p) => p.visualState === "low" || p.visualState === "out",
    ).length;
    const hasExpired = assignedPositions.some(
      (p) => p.visualState === "expired",
    );
    const hasOut = assignedPositions.some((p) => p.visualState === "out");
    const shelfVisualState = hasExpired
      ? "expired"
      : assignedPositions.length > 0 && (hasOut || shelfUnits === 0)
        ? "out"
        : shelfLow > 0
          ? "low"
          : "normal";

    return {
      id: shelf.id,
      code: shelf.shelfCode,
      name: shelf.shelfName,
      departmentId: shelf.departmentId,
      departmentCode: shelf.department.code,
      departmentName: shelf.department.name,
      kind: fixture?.kind ?? "gondola",
      capacity: shelf.capacity,
      status: shelf.status,
      objectName: shelf.shelfCode,
      position: fixture?.position ?? [0, 0, 0],
      rotationY: fixture?.rotationY ?? 0,
      size: fixture?.size ?? [1.0, 2.1, 4.0],
      tiers: fixture?.tiers ?? 4,
      slotsPerTier: fixture?.slotsPerTier ?? 3,
      totalUnits: shelfUnits,
      productCount: assignedPositions.length,
      lowStockCount: shelfLow,
      emptyPositions: positions.length - assignedPositions.length,
      restockNeeded: shelfLow > 0 || hasOut,
      visualState: shelfVisualState,
      positions,
    };
  });

  // Department rollups from real shelf totals.
  const deptNodes: TwinDepartmentNode[] = departments.map((dept) => {
    const deptShelves = shelfNodes.filter((s) => s.departmentId === dept.id);
    const deptPositions = deptShelves
      .flatMap((s) => s.positions)
      .filter((p) => p.product !== null);
    return {
      id: dept.id,
      code: dept.code,
      name: dept.name,
      description: dept.description,
      status: dept.status,
      shelvesCount: deptShelves.length,
      productCount: deptPositions.length,
      totalUnits: deptShelves.reduce((sum, s) => sum + s.totalUnits, 0),
      lowStockCount: deptPositions.filter((p) => p.visualState === "low").length,
      outOfStockCount: deptPositions.filter((p) => p.visualState === "out").length,
      expiredCount: deptPositions.filter((p) => p.visualState === "expired").length,
    };
  });

  // Group warehouse locations by rackCode.
  const whByRack = new Map<string, TwinWarehousePositionNode[]>();
  let totalWarehouseUnits = 0;

  for (const loc of whLocations) {
    const inv = invByWhLocation.get(loc.id);
    const qty = inv?.quantityOnHand ?? 0;
    totalWarehouseUnits += qty;
    const pid = inv?.productId.toString() ?? null;
    const visualState = inv
      ? classifyInventoryState({
          quantity: qty,
          reorderLevel: inv.reorderLevel,
          reservedQuantity: inv.reservedQuantity,
          isExpired: pid ? expiredProducts.has(pid) : false,
        })
      : "normal";

    const node: TwinWarehousePositionNode = {
      id: loc.id,
      warehouseCode: loc.warehouseCode,
      zoneCode: loc.zoneCode,
      rackCode: loc.rackCode,
      levelCode: loc.levelCode,
      positionCode: loc.positionCode,
      locationType: loc.locationType,
      objectName: `${loc.rackCode}_${loc.levelCode}_${loc.positionCode}`,
      capacity: loc.capacity,
      quantityOnHand: qty,
      reservedQuantity: inv?.reservedQuantity ?? 0,
      reorderLevel: inv?.reorderLevel ?? LOW_STOCK_THRESHOLD,
      visualState,
      product: inv?.product
        ? {
            id: inv.product.id.toString(),
            name: inv.product.name,
            barcode: inv.product.barcode,
            categoryName: inv.product.category?.name ?? null,
            price: Number(inv.product.price),
          }
        : null,
    };

    const list = whByRack.get(loc.rackCode) ?? [];
    list.push(node);
    whByRack.set(loc.rackCode, list);
  }

  const warehouseRacks: TwinWarehouseRackNode[] = WAREHOUSE_RACKS.map((spec) => {
    const positions = whByRack.get(spec.rackCode) ?? [];
    const totalUnits = positions.reduce((sum, p) => sum + p.quantityOnHand, 0);
    const capacity = positions.reduce((sum, p) => sum + p.capacity, 0) || 600;
    const hasLow = positions.some(
      (p) => p.product && (p.visualState === "low" || p.visualState === "out"),
    );

    return {
      zoneCode: spec.zoneCode,
      rackCode: spec.rackCode,
      label: spec.label,
      locationType: spec.locationType,
      position: spec.position,
      size: spec.size,
      levels: spec.levels,
      positionsPerLevel: spec.positionsPerLevel,
      totalUnits,
      capacity,
      visualState: hasLow ? "low" : "normal",
      positions,
    };
  });

  return {
    initialized: true,
    generatedAt: now.toISOString(),
    store: {
      id: store.id,
      name: store.name,
      address: store.address,
      location: store.location,
      status: store.status,
    },
    departments: deptNodes,
    shelves: shelfNodes,
    warehouseRacks,
    mappings: mappings.map((m) => ({
      id: m.id,
      objectName: m.objectName,
      objectType: m.objectType,
      linkedEntityType: m.linkedEntityType,
      linkedEntityId: m.linkedEntityId,
      assetPath: m.asset?.filePath ?? null,
      position: [m.posX, m.posY, m.posZ],
      rotation: [m.rotX, m.rotY, m.rotZ],
      scale: [m.scaleX, m.scaleY, m.scaleZ],
    })),
    summary: {
      totalProducts: activeProductsCount,
      totalShelfUnits,
      totalWarehouseUnits,
      lowStockCount,
      outOfStockCount,
      expiringSoonCount,
      expiredCount,
    },
  };
}

/** Phase 15: Global 3D search across products, barcodes, SKUs, shelves & warehouse racks. */
export async function locateInDigitalTwin(
  rawQuery: string,
): Promise<TwinLocateResult> {
  const query = rawQuery.trim();
  if (!query) return { query: "", matches: [] };

  const snapshot = await getDigitalTwinSnapshot();
  const q = query.toLowerCase();

  const matchesByProduct = new Map<
    string,
    TwinLocateResult["matches"][number]
  >();

  // Search shelf positions (matches product name, barcode, SKU, category, or shelf code).
  for (const shelf of snapshot.shelves) {
    const shelfMatches =
      shelf.code.toLowerCase().includes(q) ||
      shelf.name.toLowerCase().includes(q) ||
      shelf.departmentName.toLowerCase().includes(q);

    for (const pos of shelf.positions) {
      if (!pos.product) continue;
      const productMatches =
        pos.product.name.toLowerCase().includes(q) ||
        pos.product.barcode.toLowerCase().includes(q) ||
        pos.product.sku.toLowerCase().includes(q) ||
        (pos.product.categoryName ?? "").toLowerCase().includes(q);

      if (!productMatches && !shelfMatches) continue;

      const fixture = findFixtureByCode(shelf.code);
      const target = fixture
        ? shelfSlotWorldPosition(fixture, pos.slotIndex)
        : shelf.position;
      const camPos: [number, number, number] = [
        target[0] + (fixture?.cameraOffset[0] ?? 3.2) * 0.72,
        target[1] + 1.4,
        target[2] + (fixture?.cameraOffset[2] ?? 3.2) * 0.72,
      ];

      let entry = matchesByProduct.get(pos.product.id);
      if (!entry) {
        entry = {
          productId: pos.product.id,
          productName: pos.product.name,
          barcode: pos.product.barcode,
          categoryName: pos.product.categoryName,
          price: pos.product.price,
          totalStock: pos.product.totalStock,
          locations: [],
        };
        matchesByProduct.set(pos.product.id, entry);
      }

      entry.locations.push({
        kind: "shelf",
        id: pos.id,
        code: `${shelf.code} / ${pos.positionCode}`,
        label: shelf.name,
        departmentOrZone: shelf.departmentName,
        quantity: pos.quantity,
        cameraPosition: camPos,
        cameraTarget: target,
        selection: {
          type: "product",
          productId: pos.product.id,
          positionId: pos.id,
          shelfCode: shelf.code,
          objectName: pos.objectName,
        },
      });
    }
  }

  // Search warehouse rack locations.
  for (const rack of snapshot.warehouseRacks) {
    const rackMatches =
      rack.rackCode.toLowerCase().includes(q) ||
      rack.zoneCode.toLowerCase().includes(q) ||
      rack.label.toLowerCase().includes(q);

    for (const loc of rack.positions) {
      if (!loc.product) continue;
      const productMatches =
        loc.product.name.toLowerCase().includes(q) ||
        loc.product.barcode.toLowerCase().includes(q) ||
        (loc.product.categoryName ?? "").toLowerCase().includes(q);

      if (!productMatches && !rackMatches) continue;

      const spec = findRackByCode(rack.rackCode);
      const target: [number, number, number] = [
        rack.position[0],
        1.6,
        rack.position[2],
      ];
      const camPos: [number, number, number] = [
        rack.position[0] + (spec ? 4.2 : 3.5),
        4.4,
        rack.position[2] + 5.2,
      ];

      let entry = matchesByProduct.get(loc.product.id);
      if (!entry) {
        entry = {
          productId: loc.product.id,
          productName: loc.product.name,
          barcode: loc.product.barcode,
          categoryName: loc.product.categoryName,
          price: loc.product.price,
          totalStock: loc.quantityOnHand,
          locations: [],
        };
        matchesByProduct.set(loc.product.id, entry);
      }

      entry.locations.push({
        kind: "warehouse",
        id: loc.id,
        code: `${loc.rackCode} / ${loc.levelCode} / ${loc.positionCode}`,
        label: rack.label,
        departmentOrZone: loc.zoneCode,
        quantity: loc.quantityOnHand,
        cameraPosition: camPos,
        cameraTarget: target,
        selection: {
          type: "warehouse_position",
          locationId: loc.id,
          rackCode: loc.rackCode,
          objectName: loc.objectName,
        },
      });
    }
  }

  return {
    query,
    matches: Array.from(matchesByProduct.values()).slice(0, 15),
  };
}

/**
 * Atomic Warehouse -> Shelf transfer (Phases 8 & 13).
 * Decrements warehouse `Inventory`, increments `ShelfPosition.quantity`,
 * records a `TRANSFER` StockMovement + AuditLog, and emits SSE ONLY post-commit.
 *
 * When a 4-row product column is full (`availableSpace < quantity`) and
 * `allowAddColumn` is true, automatically fills any other same-product column
 * on that shelf first and then adds a new 4-row overflow column for the SAME
 * product (never mixing different products in one column).
 */
export async function transferWarehouseToShelf(input: {
  shelfPositionId: string;
  warehouseLocationId?: string;
  quantity: number;
  allowAddColumn?: boolean;
  actorId?: bigint | null;
  notes?: string;
}) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new DigitalTwinError("Transfer quantity must be a positive integer.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const position = await tx.shelfPosition.findUnique({
      where: { id: input.shelfPositionId },
      include: {
        shelf: {
          include: {
            positions: {
              orderBy: { slotIndex: "asc" },
            },
          },
        },
        product: { include: { category: { select: { name: true } } } },
      },
    });
    if (!position) {
      throw new DigitalTwinError("Shelf column not found.", 404);
    }
    if (!position.productId || !position.product) {
      throw new DigitalTwinError(
        "Assign a product to this shelf column before restocking.",
        400,
      );
    }

    const availableSpace = Math.max(
      0,
      position.maximumCapacity - position.quantity,
    );

    // Check existing same-product columns on this shelf for overflow capacity
    const sameProductSiblings = position.shelf.positions.filter(
      (p) =>
        p.id !== position.id &&
        p.productId === position.productId &&
        p.quantity < p.maximumCapacity,
    );
    const totalSameProductFree =
      availableSpace +
      sameProductSiblings.reduce(
        (sum, p) => sum + Math.max(0, p.maximumCapacity - p.quantity),
        0,
      );

    if (input.quantity > totalSameProductFree && !input.allowAddColumn) {
      throw new DigitalTwinError(
        availableSpace === 0
          ? `All 4 rows in column ${position.shelf.shelfCode}/${position.positionCode} are full (${position.quantity}/${position.maximumCapacity}). Add another column for "${position.product.name}" instead of mixing products.`
          : `Column ${position.shelf.shelfCode}/${position.positionCode} has room for ${availableSpace} more unit(s). Enable overflow column creation to place additional "${position.product.name}" units in a new 4-row column.`,
        409,
      );
    }

    const invRecord = input.warehouseLocationId
      ? await tx.inventory.findFirst({
          where: {
            productId: position.productId,
            warehouseLocationId: input.warehouseLocationId,
          },
          include: { warehouseLocation: true },
        })
      : await tx.inventory.findFirst({
          where: {
            productId: position.productId,
            quantityOnHand: { gte: input.quantity },
          },
          include: { warehouseLocation: true },
          orderBy: { quantityOnHand: "desc" },
        });

    if (!invRecord || invRecord.quantityOnHand < input.quantity) {
      throw new DigitalTwinError(
        `Insufficient warehouse stock for "${position.product.name}". Available in warehouse: ${invRecord?.quantityOnHand ?? 0}.`,
        409,
      );
    }

    // Conditional atomic decrement to prevent concurrent over-transfers.
    const dec = await tx.inventory.updateMany({
      where: {
        id: invRecord.id,
        quantityOnHand: { gte: input.quantity },
      },
      data: { quantityOnHand: { decrement: input.quantity } },
    });
    if (dec.count === 0) {
      throw new DigitalTwinError(
        "Warehouse stock changed concurrently. Please retry.",
        409,
      );
    }

    let remaining = input.quantity;
    let primaryUpdatedQty = position.quantity;
    const positionUpdates: Array<{
      productId: string;
      shelfCode: string;
      positionId: string;
      quantity: number;
    }> = [];
    const addedColumnCodes: string[] = [];

    // 1. Fill target column up to its 4-row capacity
    if (availableSpace > 0 && remaining > 0) {
      const take = Math.min(availableSpace, remaining);
      const updated = await tx.shelfPosition.update({
        where: { id: position.id },
        data: { quantity: { increment: take } },
      });
      primaryUpdatedQty = updated.quantity;
      positionUpdates.push({
        productId: position.productId.toString(),
        shelfCode: position.shelf.shelfCode,
        positionId: updated.id,
        quantity: updated.quantity,
      });
      remaining -= take;
    }

    // 2. Overflow into any existing same-product columns on the same shelf
    for (const sibling of sameProductSiblings) {
      if (remaining <= 0) break;
      const free = Math.max(0, sibling.maximumCapacity - sibling.quantity);
      if (free <= 0) continue;
      const take = Math.min(free, remaining);
      const updated = await tx.shelfPosition.update({
        where: { id: sibling.id },
        data: { quantity: { increment: take } },
      });
      positionUpdates.push({
        productId: position.productId.toString(),
        shelfCode: position.shelf.shelfCode,
        positionId: updated.id,
        quantity: updated.quantity,
      });
      remaining -= take;
    }

    // 3. Still overflowing & allowAddColumn enabled -> add new 4-row column(s) for the SAME product!
    let currentCols = position.shelf.positions.length;
    let nextSlotIndex =
      currentCols > 0
        ? Math.max(...position.shelf.positions.map((p) => p.slotIndex)) + 1
        : 0;
    const existingCodes = new Set(
      position.shelf.positions.map((p) => p.positionCode),
    );
    const colCap = Math.max(4, position.maximumCapacity || 24);
    const fixture = findFixtureByCode(position.shelf.shelfCode);
    const assetEntry = resolveProductAsset(
      position.product.name,
      position.product.category?.name,
    );
    const asset = await tx.threeDAsset.findUnique({
      where: { assetKey: assetEntry.key },
      select: { id: true },
    });

    while (remaining > 0) {
      if (currentCols >= 12) {
        throw new DigitalTwinError(
          `Shelf ${position.shelf.shelfCode} reached maximum 12 columns. Transfer remaining ${remaining} unit(s) to another shelf.`,
          409,
        );
      }

      let codeNum = nextSlotIndex + 1;
      let newCode = `COL_${String(codeNum).padStart(2, "0")}`;
      while (existingCodes.has(newCode)) {
        codeNum += 1;
        newCode = `COL_${String(codeNum).padStart(2, "0")}`;
      }
      existingCodes.add(newCode);

      const take = Math.min(colCap, remaining);
      const createdCol = await tx.shelfPosition.create({
        data: {
          shelfId: position.shelfId,
          productId: position.productId,
          positionCode: newCode,
          slotIndex: nextSlotIndex,
          quantity: take,
          maximumCapacity: colCap,
          reorderLevel: position.reorderLevel,
        },
      });
      await tx.shelf.update({
        where: { id: position.shelfId },
        data: { capacity: { increment: colCap } },
      });

      currentCols += 1;
      const coords = fixture
        ? shelfSlotWorldPosition(fixture, nextSlotIndex, currentCols)
        : ([0, 1, 0] as [number, number, number]);

      await tx.threeDObjectMapping.upsert({
        where: { objectName: `${position.shelf.shelfCode}_${newCode}` },
        update: {
          linkedEntityType: "PRODUCT",
          linkedEntityId: position.productId.toString(),
          assetId: asset?.id ?? null,
          posX: coords[0],
          posY: coords[1],
          posZ: coords[2],
        },
        create: {
          objectName: `${position.shelf.shelfCode}_${newCode}`,
          objectType: "PRODUCT_POSITION",
          linkedEntityType: "PRODUCT",
          linkedEntityId: position.productId.toString(),
          assetId: asset?.id ?? null,
          posX: coords[0],
          posY: coords[1],
          posZ: coords[2],
        },
      });

      addedColumnCodes.push(newCode);
      positionUpdates.push({
        productId: position.productId.toString(),
        shelfCode: position.shelf.shelfCode,
        positionId: createdCol.id,
        quantity: createdCol.quantity,
      });
      nextSlotIndex += 1;
      remaining -= take;
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: position.productId,
        quantity: input.quantity,
        movementType: "TRANSFER",
        sourceLocationId: invRecord.warehouseLocationId ?? undefined,
        destinationLocationId: position.id,
        performedById: input.actorId ?? undefined,
        reference: `${invRecord.warehouseLocation?.rackCode ?? "WH"} -> ${position.shelf.shelfCode}/${position.positionCode}${addedColumnCodes.length > 0 ? ` (+${addedColumnCodes.join(",")})` : ""}`,
        notes:
          input.notes ??
          (addedColumnCodes.length > 0
            ? `Warehouse restock with same-product overflow column(s): ${addedColumnCodes.join(", ")}`
            : "Warehouse to shelf restock"),
      },
    });

    return {
      movementId: movement.id.toString(),
      productId: position.productId.toString(),
      productName: position.product.name,
      shelfId: position.shelfId,
      shelfCode: position.shelf.shelfCode,
      positionId: position.id,
      positionCode: position.positionCode,
      newShelfQuantity: primaryUpdatedQty,
      warehouseLocationId: invRecord.warehouseLocationId,
      newWarehouseQuantity: invRecord.quantityOnHand - input.quantity,
      addedColumnCodes,
      positionUpdates,
    };
  });

  await recordAuditLog({
    actorId: input.actorId,
    action: "SHELF_RESTOCK_TRANSFER",
    entityType: "SHELF_POSITION",
    entityId: result.positionId,
    summary:
      result.addedColumnCodes.length > 0
        ? `Transferred ${input.quantity}× ${result.productName} to ${result.shelfCode} (added overflow column ${result.addedColumnCodes.join(", ")}).`
        : `Transferred ${input.quantity}× ${result.productName} to ${result.shelfCode}/${result.positionCode}.`,
    metadata: result,
  });

  publishInventoryEvent({
    type: "stock_transferred",
    productId: result.productId,
    shelfId: result.shelfId,
    shelfCode: result.shelfCode,
    positionId: result.positionId,
    warehouseLocationId: result.warehouseLocationId ?? undefined,
    quantity: result.newShelfQuantity,
    delta: input.quantity,
    updates: result.positionUpdates,
    summary:
      result.addedColumnCodes.length > 0
        ? `Restocked +${input.quantity} ${result.productName} onto ${result.shelfCode} (+column ${result.addedColumnCodes.join(",")})`
        : `Restocked +${input.quantity} ${result.productName} onto ${result.shelfCode}`,
  });

  return result;
}

/**
 * Synchronize shelf positions & warehouse reserve inside an active POS checkout
 * transaction (Phase 9). Deducts from retail ShelfPositions first, then spills
 * over into warehouse Inventory if needed, never allowing negative balances.
 */
export async function syncTwinDeductionInTx(
  tx: Prisma.TransactionClient,
  productId: bigint,
  quantitySold: number,
): Promise<{
  touchedShelfIds: string[];
  touchedPositionIds: string[];
  positionUpdates: Array<{
    productId: string;
    shelfCode: string;
    positionId: string;
    quantity: number;
  }>;
}> {
  const touchedShelfIds: string[] = [];
  const touchedPositionIds: string[] = [];
  const positionUpdates: Array<{
    productId: string;
    shelfCode: string;
    positionId: string;
    quantity: number;
  }> = [];
  let remaining = quantitySold;

  try {
    const positions = await tx.shelfPosition.findMany({
      where: { productId, quantity: { gt: 0 } },
      include: { shelf: { select: { shelfCode: true } } },
      orderBy: { quantity: "desc" },
    });

    for (const pos of positions) {
      if (remaining <= 0) break;
      const take = Math.min(pos.quantity, remaining);
      const nextQty = Math.max(0, pos.quantity - take);
      await tx.shelfPosition.update({
        where: { id: pos.id },
        data: { quantity: { decrement: take } },
      });
      touchedShelfIds.push(pos.shelfId);
      touchedPositionIds.push(pos.id);
      positionUpdates.push({
        productId: productId.toString(),
        shelfCode: pos.shelf.shelfCode,
        positionId: pos.id,
        quantity: nextQty,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      const whRecords = await tx.inventory.findMany({
        where: { productId, quantityOnHand: { gt: 0 } },
        orderBy: { quantityOnHand: "desc" },
      });
      for (const inv of whRecords) {
        if (remaining <= 0) break;
        const take = Math.min(inv.quantityOnHand, remaining);
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantityOnHand: { decrement: take } },
        });
        remaining -= take;
      }
    }
  } catch (error) {
    if (!isMissingTwinTables(error)) throw error;
  }

  return { touchedShelfIds, touchedPositionIds, positionUpdates };
}
