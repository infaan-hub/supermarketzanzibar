import { describe, expect, it } from "vitest";
import {
  INVENTORY_STATE_STYLES,
  classifyInventoryState,
  heatmapColorForState,
} from "../lib/digital-twin/inventory-state";
import {
  ASSET_MANIFEST,
  resolveProductAsset,
} from "../lib/digital-twin/asset-manifest";
import {
  publishInventoryEvent,
  subscribeInventoryEvents,
} from "../lib/realtime/event-bus";
import type { RealtimeInventoryEvent } from "../types/digital-twin";

describe("3D Digital Twin inventory state & heatmap classification", () => {
  it("classifies all 6 inventory states deterministically", () => {
    expect(
      classifyInventoryState({
        quantity: 20,
        reorderLevel: 5,
        isRestocking: true,
      }),
    ).toBe("restocking");

    expect(
      classifyInventoryState({
        quantity: 12,
        reorderLevel: 5,
        isExpired: true,
      }),
    ).toBe("expired");

    expect(
      classifyInventoryState({
        quantity: 0,
        reorderLevel: 5,
      }),
    ).toBe("out");

    expect(
      classifyInventoryState({
        quantity: 4,
        reorderLevel: 5,
      }),
    ).toBe("low");

    expect(
      classifyInventoryState({
        quantity: 10,
        reorderLevel: 5,
        reservedQuantity: 10,
      }),
    ).toBe("reserved");

    expect(
      classifyInventoryState({
        quantity: 18,
        reorderLevel: 5,
      }),
    ).toBe("normal");
  });

  it("maps every state to an accessible heatmap hex color", () => {
    const states = [
      "normal",
      "low",
      "out",
      "expired",
      "reserved",
      "restocking",
    ] as const;

    for (const s of states) {
      expect(INVENTORY_STATE_STYLES[s].label.length).toBeGreaterThan(0);
      expect(heatmapColorForState(s)).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(heatmapColorForState("normal")).toBe("#16a34a");
    expect(heatmapColorForState("low")).toBe("#f59e0b");
    expect(heatmapColorForState("out")).toBe("#dc2626");
    expect(heatmapColorForState("expired")).toBe("#dc2626");
    expect(heatmapColorForState("normal", false)).toBe("#94a3b8");
  });
});

describe("Product-to-GLB asset resolution", () => {
  it("resolves common supermarket products to registered GLB manifest entries", () => {
    const manifestKeys = new Set(ASSET_MANIFEST.map((a) => a.key));
    const samples = [
      ["Coca-Cola 330ml Can", "Beverages"],
      ["Kilimanjaro Mineral Water 1.5L", "Beverages"],
      ["Fresh Whole Milk 1L", "Dairy"],
      ["Mango Juice 1L", "Beverages"],
      ["Mbeya Super Rice 5kg", "Groceries"],
      ["Azam Wheat Flour 2kg", "Groceries"],
      ["Sunflower Cooking Oil 2L", "Groceries"],
      ["Corn Flakes Cereal", "Groceries"],
      ["Herbal Bath Soap", "Cosmetics"],
      ["Mint Toothpaste", "Personal Care"],
      ["Coconut Shampoo 400ml", "Cosmetics"],
      ["Unknown Generic Item", null],
    ] as const;

    for (const [name, category] of samples) {
      const entry = resolveProductAsset(name, category);
      expect(manifestKeys.has(entry.key)).toBe(true);
      expect(entry.path.startsWith("/models/")).toBe(true);
      expect(entry.path.endsWith(".glb")).toBe(true);
    }
  });
});

describe("Real-time SSE inventory event bus", () => {
  it("delivers post-commit events to active subscribers and cleans up on unsubscribe", () => {
    const receivedA: RealtimeInventoryEvent[] = [];
    const receivedB: RealtimeInventoryEvent[] = [];

    const unsubA = subscribeInventoryEvents((evt) => receivedA.push(evt));
    const unsubB = subscribeInventoryEvents((evt) => receivedB.push(evt));

    const published = publishInventoryEvent({
      type: "sale_completed",
      productId: "101",
      delta: -2,
      summary: "POS sale #10: -2 units",
    });

    expect(published.type).toBe("sale_completed");
    expect(published.timestamp).toBeTruthy();
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    expect(receivedA[0].summary).toBe("POS sale #10: -2 units");

    unsubA();

    publishInventoryEvent({
      type: "stock_transferred",
      shelfCode: "SH-BEV-01",
      delta: 12,
      summary: "Restocked +12 onto SH-BEV-01",
    });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(2);

    unsubB();
  });
});
