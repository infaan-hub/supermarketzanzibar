import { describe, expect, it } from "vitest";
import {
  SHELF_FIXTURES,
  buildShoppingPathPoints,
  chillerDoorCountForFixture,
  findFixtureByCode,
  isPointInsideObstacle,
  resolveWalkCollision,
  shelfSlotDoorIndex,
  shelfSlotLocalLayout,
  shelfSlotWorldCamera,
} from "@/lib/digital-twin/spatial-plan";
import {
  computeSlotFacings,
  isCylindricalProductAsset,
} from "@/lib/digital-twin/product-layout";
import { applyPublicShelfEventToSnapshot } from "@/hooks/usePublicStorefrontRealtime";
import {
  decodePickupCode,
  encodePickupCode,
  isPickupCode,
} from "@/lib/storefront/pickup-code";
import type { DigitalTwinSnapshot } from "@/types/digital-twin";

describe("3D Live Shelf — Double-Sided Orientation, 18° Produce Tilt & Aisle-Side Auto-Framing", () => {
  it("orients double-sided gondola slots outward to both +X and -X aisles", () => {
    const gondola = findFixtureByCode("SH-GRO-01");
    expect(gondola).toBeDefined();

    const evenSlot = shelfSlotLocalLayout(gondola!, 0);
    const oddSlot = shelfSlotLocalLayout(gondola!, 1);

    expect(evenSlot.isDoubleSided).toBe(true);
    expect(evenSlot.sideSign).toBe(1);
    expect(evenSlot.localNormal).toEqual([1, 0, 0]);
    expect(evenSlot.localRotationY).toBeCloseTo(Math.PI / 2, 4);

    expect(oddSlot.sideSign).toBe(-1);
    expect(oddSlot.localNormal).toEqual([-1, 0, 0]);
    expect(oddSlot.localRotationY).toBeCloseTo(-Math.PI / 2, 4);

    // Camera framing lands on opposite sides of the shelf for even vs odd slots
    const camRight = shelfSlotWorldCamera(gondola!, 0, 2.0);
    const camLeft = shelfSlotWorldCamera(gondola!, 1, 2.0);
    expect(camRight.position[0]).toBeGreaterThan(gondola!.position[0] + 1.5);
    expect(camLeft.position[0]).toBeLessThan(gondola!.position[0] - 1.5);
  });

  it("frames rotated wall chillers along their true inward aisle normal", () => {
    const dairyChiller = findFixtureByCode("FR-DAI-01");
    expect(dairyChiller).toBeDefined();
    // FR-DAI-01 sits on the East wall (x = 17.4) with rotationY = -PI/2 -> faces West (-X)
    const cam = shelfSlotWorldCamera(dairyChiller!, 0, 2.0);
    expect(cam.worldNormal[0]).toBeCloseTo(-1, 3);
    expect(cam.position[0]).toBeLessThan(dairyChiller!.position[0]);
  });

  it("never places slot auto-framing camera inside any solid retail obstacle across all 18 fixtures", () => {
    for (const fixture of SHELF_FIXTURES) {
      const slotCount = Math.min(fixture.tiers * fixture.slotsPerTier, 6);
      for (let i = 0; i < slotCount; i += 1) {
        const cam = shelfSlotWorldCamera(fixture, i, 1.95);
        expect(
          isPointInsideObstacle(cam.position[0], cam.position[2], 0.28),
          `Camera for ${fixture.code} slot ${i} collided with obstacle`,
        ).toBe(false);
      }
    }
  });

  it("applies 18-degree presentation tilt on produce island crates and calculates multi-door chiller mapping", () => {
    const produce = findFixtureByCode("SH-PRO-01")!;
    const prodLayout = shelfSlotLocalLayout(produce, 0);
    expect(prodLayout.tiltX).toBeCloseTo(0.314, 2);

    const bevCooler = findFixtureByCode("FR-BEV-01")!;
    const doors = chillerDoorCountForFixture(bevCooler);
    expect(doors).toBeGreaterThanOrEqual(4);
    const firstDoor = shelfSlotDoorIndex(bevCooler, 0);
    const lastDoor = shelfSlotDoorIndex(bevCooler, 2);
    expect(firstDoor).toBeGreaterThanOrEqual(0);
    expect(firstDoor).toBeLessThan(doors);
    expect(lastDoor).toBeGreaterThanOrEqual(firstDoor);
  });
});

describe("3D Live Shelf — Real Back-to-Front Depth Depletion & Shape-Aware Labels", () => {
  it("progressively depletes depth rows back-to-front as stock sells down to 0", () => {
    const full = computeSlotFacings({
      quantity: 20,
      assetKey: "products/beverages/soda-bottle",
      maxDepthBack: 0.34,
    });
    const mid = computeSlotFacings({
      quantity: 7,
      assetKey: "products/beverages/soda-bottle",
      maxDepthBack: 0.34,
    });
    const low = computeSlotFacings({
      quantity: 2,
      assetKey: "products/beverages/soda-bottle",
      maxDepthBack: 0.34,
    });
    const empty = computeSlotFacings({
      quantity: 0,
      assetKey: "products/beverages/soda-bottle",
      maxDepthBack: 0.34,
    });

    expect(empty).toHaveLength(0);
    expect(low).toHaveLength(2);
    expect(Math.max(...low.map((f) => f.row))).toBe(0);
    expect(Math.max(...mid.map((f) => f.row))).toBe(1);
    expect(Math.max(...full.map((f) => f.row))).toBe(2);
    expect(full.filter((f) => f.isHero)).toHaveLength(1);
    expect(low.filter((f) => f.isHero)).toHaveLength(1);
  });

  it("distinguishes cylindrical bottles/cans from flat cartons for curved label sleeves", () => {
    expect(isCylindricalProductAsset("products/beverages/soda-bottle")).toBe(true);
    expect(isCylindricalProductAsset("products/beverages/soda-can")).toBe(true);
    expect(isCylindricalProductAsset("products/groceries/oil-bottle")).toBe(true);
    expect(isCylindricalProductAsset("products/dairy/milk-carton")).toBe(false);
    expect(isCylindricalProductAsset("products/groceries/cereal-box")).toBe(false);
  });
});

describe("3D Live Shelf — AABB Collision Detection & Smooth Sliding", () => {
  it("blocks walking straight through a solid gondola while allowing aisle sliding", () => {
    const gondola = findFixtureByCode("SH-GRO-02")!; // at x = -6.8, z = 0.3, w = 1.0, d = 7.2
    const aisleX = gondola.position[0] + 1.1; // clear aisle to the east of gondola
    expect(isPointInsideObstacle(aisleX, 0.3, 0.45)).toBe(false);

    // Attempt diagonal walk into the gondola + forward along Z
    const [resX, resZ] = resolveWalkCollision(
      aisleX,
      0.3,
      gondola.position[0], // inside shelf X
      1.2, // forward along aisle Z
      0.45,
    );

    // Should slide cleanly forward in Z while staying outside the gondola in X
    expect(resX).toBeCloseTo(aisleX, 3);
    expect(resZ).toBeCloseTo(1.2, 3);
    expect(isPointInsideObstacle(resX, resZ, 0.45)).toBe(false);
  });
});

describe("3D Live Shelf — Sanitized Public SSE Instant Snapshot Patching", () => {
  it("patches shelf position quantity and visual state immediately in memory without full reload", () => {
    const mockSnapshot: DigitalTwinSnapshot = {
      initialized: true,
      generatedAt: "2026-11-23T09:00:00.000Z",
      store: null,
      departments: [],
      warehouseRacks: [],
      mappings: [],
      summary: {
        totalProducts: 1,
        totalShelfUnits: 14,
        totalWarehouseUnits: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        expiringSoonCount: 0,
        expiredCount: 0,
      },
      shelves: [
        {
          id: "sh-1",
          code: "SH-BEV-01",
          name: "Beverages Aisle 4",
          departmentId: "d-1",
          departmentCode: "BEV",
          departmentName: "Beverages",
          kind: "gondola",
          capacity: 120,
          status: "active",
          objectName: "Shelf_SH-BEV-01",
          position: [0.4, 0, 0.3],
          rotationY: 0,
          size: [1.0, 2.1, 7.2],
          tiers: 4,
          slotsPerTier: 3,
          totalUnits: 14,
          productCount: 1,
          lowStockCount: 0,
          emptyPositions: 11,
          restockNeeded: false,
          visualState: "normal",
          positions: [
            {
              id: "pos-1",
              shelfId: "sh-1",
              shelfCode: "SH-BEV-01",
              positionCode: "T1-P1",
              objectName: "SH-BEV-01_T1-P1",
              slotIndex: 0,
              quantity: 14,
              maximumCapacity: 24,
              reservedQuantity: 0,
              warehouseQuantity: 0,
              reorderLevel: 5,
              visualState: "normal",
              nearestExpiryDate: null,
              product: {
                id: "42",
                name: "Kilimanjaro Water 1.5L",
                sku: "WAT-15",
                barcode: "6201001",
                categoryId: null,
                categoryName: "Beverages",
                price: 1500,
                costPrice: 0,
                totalStock: 14,
                assetKey: "products/beverages/water-bottle",
                assetPath: "/models/products/beverages/water-bottle.glb",
              },
            },
          ],
        },
      ],
    };

    const patched = applyPublicShelfEventToSnapshot(mockSnapshot, {
      timestamp: "2026-11-23T09:05:00.000Z",
      productId: "42",
      shelfCode: "SH-BEV-01",
      positionId: "pos-1",
      quantity: 3,
    });

    expect(patched).not.toBeNull();
    expect(patched!.shelves[0].positions[0].quantity).toBe(3);
    expect(patched!.shelves[0].positions[0].visualState).toBe("low");
    expect(patched!.shelves[0].totalUnits).toBe(3);
    expect(patched!.summary.totalShelfUnits).toBe(3);
    expect(patched!.summary.lowStockCount).toBe(1);
  });
});

describe("3D Live Shelf — Guided Shopping Route & Express POS Pickup Code", () => {
  it("builds an ordered floor path from entrance through basket shelves to checkout", () => {
    const path = buildShoppingPathPoints([
      { shelfCode: "SH-GRO-01", slotIndex: 0 },
      { shelfCode: "FR-DAI-01", slotIndex: 2 },
    ]);
    expect(path.length).toBeGreaterThanOrEqual(4);
    expect(path[0][2]).toBeGreaterThan(10); // starts near main entrance
    expect(path[path.length - 1][2]).toBeCloseTo(7.6, 1); // ends at checkout
  });

  it("round-trips Express POS Pickup Codes safely and rejects invalid tokens", () => {
    const code = encodePickupCode([
      { productId: "12", quantity: 2 },
      { productId: "45", quantity: 3 },
      { productId: "12", quantity: 1 }, // merges duplicate product ID
      { productId: "bad", quantity: 5 }, // ignored
    ]);
    expect(isPickupCode(code)).toBe(true);
    expect(code).toBe("SZPICK1:12x3,45x3");
    expect(decodePickupCode(code)).toEqual([
      { productId: "12", quantity: 3 },
      { productId: "45", quantity: 3 },
    ]);
    expect(isPickupCode("1234567890")).toBe(false);
    expect(decodePickupCode("1234567890")).toEqual([]);
  });
});
