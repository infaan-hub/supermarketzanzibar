import { describe, expect, it } from "vitest";
import {
  BUILDING_DIMENSIONS,
  CHECKOUT_LANES,
  PHYSICAL_AREAS,
  SHELF_FIXTURES,
  WAREHOUSE_RACKS,
  shelfSlotWorldPosition,
  warehouseSlotWorldPosition,
} from "../lib/digital-twin/spatial-plan";

describe("Phase 2 — Supermarket 3D spatial design integrity", () => {
  it("defines all 18 required physical areas with unique codes", () => {
    expect(PHYSICAL_AREAS).toHaveLength(18);
    const codes = new Set(PHYSICAL_AREAS.map((a) => a.code));
    expect(codes.size).toBe(18);
  });

  it("keeps all physical areas strictly inside total building envelope", () => {
    const { minX, maxX, minZ, maxZ } = BUILDING_DIMENSIONS.totalBounds;
    for (const area of PHYSICAL_AREAS) {
      expect(area.bounds.minX).toBeGreaterThanOrEqual(minX);
      expect(area.bounds.maxX).toBeLessThanOrEqual(maxX);
      expect(area.bounds.minZ).toBeGreaterThanOrEqual(minZ);
      expect(area.bounds.maxZ).toBeLessThanOrEqual(maxZ);
      expect(area.bounds.maxX).toBeGreaterThan(area.bounds.minX);
      expect(area.bounds.maxZ).toBeGreaterThan(area.bounds.minZ);
    }
  });

  it("places every retail shelf fixture inside the retail hall with unique codes", () => {
    const { minX, maxX, minZ, maxZ } = BUILDING_DIMENSIONS.retail.bounds;
    const codes = new Set<string>();
    for (const fixture of SHELF_FIXTURES) {
      expect(codes.has(fixture.code)).toBe(false);
      codes.add(fixture.code);
      const [x, y, z] = fixture.position;
      expect(y).toBe(0);
      expect(x).toBeGreaterThan(minX);
      expect(x).toBeLessThan(maxX);
      expect(z).toBeGreaterThan(minZ);
      expect(z).toBeLessThan(maxZ);
    }
  });

  it("maintains walkable aisle width (>= 2.0m clear) between parallel grocery and beverage gondolas", () => {
    const gro1 = SHELF_FIXTURES.find((f) => f.code === "SH-GRO-01")!;
    const gro2 = SHELF_FIXTURES.find((f) => f.code === "SH-GRO-02")!;
    const gro3 = SHELF_FIXTURES.find((f) => f.code === "SH-GRO-03")!;
    const bev1 = SHELF_FIXTURES.find((f) => f.code === "SH-BEV-01")!;
    const bev2 = SHELF_FIXTURES.find((f) => f.code === "SH-BEV-02")!;

    const clearance = (a: typeof gro1, b: typeof gro2) =>
      Math.abs(b.position[0] - a.position[0]) - (a.size[0] + b.size[0]) / 2;

    expect(clearance(gro1, gro2)).toBeGreaterThanOrEqual(2.0);
    expect(clearance(gro2, gro3)).toBeGreaterThanOrEqual(2.0);
    expect(clearance(gro3, bev1)).toBeGreaterThanOrEqual(2.0);
    expect(clearance(bev1, bev2)).toBeGreaterThanOrEqual(2.0);
  });

  it("places all checkout lanes and warehouse racks in their respective halls", () => {
    for (const lane of CHECKOUT_LANES) {
      expect(lane.position[2]).toBeGreaterThan(5);
      expect(lane.position[2]).toBeLessThan(12);
    }
    const rackCodes = new Set<string>();
    for (const rack of WAREHOUSE_RACKS) {
      expect(rackCodes.has(rack.rackCode)).toBe(false);
      rackCodes.add(rack.rackCode);
      expect(rack.position[2]).toBeLessThan(-14);
      expect(rack.position[2]).toBeGreaterThan(-30);
    }
  });

  it("computes valid above-floor slot coordinates for shelves and warehouse racks", () => {
    const shelf = SHELF_FIXTURES[0];
    const slot0 = shelfSlotWorldPosition(shelf, 0);
    const slot5 = shelfSlotWorldPosition(shelf, 5);
    expect(slot0[1]).toBeGreaterThan(0);
    expect(slot5[1]).toBeGreaterThan(slot0[1]);

    const rack = WAREHOUSE_RACKS[0];
    const whSlot0 = warehouseSlotWorldPosition(rack, 0, 0);
    const whSlot2 = warehouseSlotWorldPosition(rack, 2, 2);
    expect(whSlot0[1]).toBeGreaterThan(0);
    expect(whSlot2[1]).toBeGreaterThan(whSlot0[1]);
  });
});
