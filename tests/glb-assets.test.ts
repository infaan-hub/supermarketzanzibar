import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
  PRODUCT_ASSET_GROUPS,
  PRODUCT_ASSET_MANIFEST,
  isValidProductAssetKey,
  resolveEffectiveProductAsset,
  resolveProductAsset,
} from "../lib/digital-twin/asset-manifest";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

function parseGlbJson(filePath: string) {
  const buf = fs.readFileSync(filePath);
  expect(buf.length).toBeGreaterThan(28);
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const totalLen = buf.readUInt32LE(8);
  expect(magic).toBe(0x46546c67); // 'glTF'
  expect(version).toBe(2);
  expect(totalLen).toBe(buf.length);

  const jsonLen = buf.readUInt32LE(12);
  const jsonType = buf.readUInt32LE(16);
  expect(jsonType).toBe(0x4e4f534a); // 'JSON'

  const jsonText = buf.subarray(20, 20 + jsonLen).toString("utf8");
  return JSON.parse(jsonText) as {
    asset: { version: string };
    nodes: Array<{ name: string }>;
    meshes: Array<{ primitives: unknown[] }>;
    materials: unknown[];
  };
}

describe("Validated GLB 3D asset catalog & per-product-type shapes", () => {
  it("contains all 57 catalogued GLB assets on disk with valid glTF 2.0 binary structure", () => {
    expect(ASSET_MANIFEST.length).toBe(57);
    expect(PRODUCT_ASSET_MANIFEST.length).toBe(41);
    expect(PRODUCT_ASSET_GROUPS.length).toBe(10);

    for (const entry of ASSET_MANIFEST) {
      const diskPath = path.join(PUBLIC_DIR, entry.path.replace(/^\//, ""));
      expect(fs.existsSync(diskPath), `Missing GLB file: ${entry.path}`).toBe(
        true,
      );

      const gltf = parseGlbJson(diskPath);
      expect(gltf.asset.version).toBe("2.0");
      expect(gltf.meshes.length).toBeGreaterThan(0);
      expect(gltf.materials.length).toBeGreaterThan(0);
      expect(gltf.nodes.length).toBeGreaterThan(1);

      if (entry.requiredNodes) {
        const nodeNames = new Set(gltf.nodes.map((n) => n.name));
        for (const required of entry.requiredNodes) {
          expect(
            nodeNames.has(required),
            `Missing node "${required}" in ${entry.path}`,
          ).toBe(true);
        }
      }

      if (entry.category === "product") {
        expect(entry.departmentCode).toBeTruthy();
        expect(entry.departmentLabel).toBeTruthy();
        expect(entry.shapeSummary).toBeTruthy();
        expect(entry.labelWrap).toBeDefined();
        expect(isValidProductAssetKey(entry.key)).toBe(true);
      }
    }
  });

  it("maps every supermarket department's product types to distinct real-world 3D shapes", () => {
    // Beverages
    expect(resolveProductAsset("Coca-Cola 330ml Can", "Beverages").key).toBe(
      "products/beverages/soda-can",
    );
    expect(resolveProductAsset("Red Bull Energy Drink 250ml", "Beverages").key).toBe(
      "products/beverages/energy-can",
    );
    expect(resolveProductAsset("Kilimanjaro Water 1.5L").key).toBe(
      "products/beverages/water-bottle",
    );
    expect(resolveProductAsset("Ceres Mango Juice 1L", "Beverages").key).toBe(
      "products/beverages/juice-carton",
    );
    expect(resolveProductAsset("Stoney Ginger Beer Glass Bottle").key).toBe(
      "products/beverages/glass-bottle",
    );

    // Groceries
    expect(resolveProductAsset("Basmati Rice 5kg", "Groceries").key).toBe(
      "products/groceries/rice-bag",
    );
    expect(resolveProductAsset("Azam Wheat Flour 2kg", "Groceries").key).toBe(
      "products/groceries/flour-bag",
    );
    expect(resolveProductAsset("Korie Cooking Oil 2L", "Groceries").key).toBe(
      "products/groceries/oil-bottle",
    );
    expect(resolveProductAsset("Strawberry Jam 450g", "Groceries").key).toBe(
      "products/groceries/glass-jar",
    );
    expect(resolveProductAsset("Zanzibar Pilau Masala Pouch", "Groceries").key).toBe(
      "products/groceries/snack-pouch",
    );
    expect(resolveProductAsset("Baked Beans Can 400g", "Groceries").key).toBe(
      "products/groceries/canned-food",
    );

    // Fruits & Vegetables (Produce)
    expect(resolveProductAsset("Fresh Red Apples 1kg", "Fruits & Vegetables").key).toBe(
      "products/produce/fruit-basket",
    );
    expect(resolveProductAsset("Fresh Zanzibar Bananas", "Fruits & Vegetables").key).toBe(
      "products/produce/banana-bunch",
    );
    expect(resolveProductAsset("Vine Tomatoes 1kg", "Fruits & Vegetables").key).toBe(
      "products/produce/vegetable-crate",
    );

    // Dairy
    expect(resolveProductAsset("Fresh Whole Milk 1L", "Dairy").key).toBe(
      "products/dairy/milk-carton",
    );
    expect(resolveProductAsset("Vanilla Yogurt 500ml", "Dairy").key).toBe(
      "products/dairy/yogurt-cup",
    );
    expect(resolveProductAsset("Blue Band Butter 500g", "Dairy").key).toBe(
      "products/dairy/butter-tub",
    );
    expect(resolveProductAsset("Cheddar Cheese Wedge 250g", "Dairy").key).toBe(
      "products/dairy/cheese-wedge",
    );
    expect(resolveProductAsset("Farm Fresh Eggs Tray", "Dairy").key).toBe(
      "products/dairy/egg-carton",
    );

    // Frozen
    expect(resolveProductAsset("Vanilla Ice Cream 1L", "Frozen Foods").key).toBe(
      "products/frozen/ice-cream-tub",
    );
    expect(resolveProductAsset("Frozen Chicken Nuggets", "Frozen Foods").key).toBe(
      "products/dairy/frozen-pack",
    );

    // Bakery
    expect(resolveProductAsset("Fresh White Bread Loaf", "Bakery").key).toBe(
      "products/bakery/bread-loaf",
    );
    expect(resolveProductAsset("Butter Croissant 4-Pack", "Bakery").key).toBe(
      "products/bakery/pastry-box",
    );
    expect(resolveProductAsset("Chocolate Birthday Cake", "Bakery").key).toBe(
      "products/bakery/cake-dome",
    );

    // Meat & Fish
    expect(resolveProductAsset("Halal Fresh Beef Steak 1kg", "Meat & Fish").key).toBe(
      "products/meat/meat-tray",
    );
    expect(resolveProductAsset("Fresh Indian Ocean Tilapia Fish", "Meat & Fish").key).toBe(
      "products/meat/fish-tray",
    );

    // Cosmetics & Personal Care
    expect(resolveProductAsset("Colgate Toothpaste", "Personal Care").key).toBe(
      "products/cosmetics/toothpaste-box",
    );
    expect(resolveProductAsset("Vaseline Body Lotion 400ml", "Cosmetics").key).toBe(
      "products/cosmetics/lotion-pump",
    );
    expect(resolveProductAsset("Nivea Face Cream 200ml", "Cosmetics").key).toBe(
      "products/cosmetics/cream-jar",
    );
    expect(resolveProductAsset("Zanzibar Oud Perfume 100ml", "Cosmetics").key).toBe(
      "products/cosmetics/perfume-bottle",
    );

    // Household
    expect(resolveProductAsset("Omo Laundry Detergent 2L", "Household").key).toBe(
      "products/household/detergent-jug",
    );
    expect(resolveProductAsset("Glass Surface Cleaner Spray", "Household").key).toBe(
      "products/household/spray-bottle",
    );
    expect(resolveProductAsset("Soft Toilet Tissue 8-Roll Pack", "Household").key).toBe(
      "products/household/tissue-pack",
    );

    // Electronics
    expect(resolveProductAsset("Stainless Electric Kettle 1.7L", "Electronics").key).toBe(
      "products/electronics/electric-kettle",
    );
    expect(resolveProductAsset("Duracell AA Batteries 4-Pack", "Electronics").key).toBe(
      "products/electronics/battery-pack",
    );
    expect(resolveProductAsset("USB-C Fast Charger Adapter", "Electronics").key).toBe(
      "products/electronics/electronics-box",
    );
  });

  it("respects explicit user-selected 3D shapes while upgrading legacy v1.0.0 fallbacks automatically", () => {
    // Explicit v2.0.0 custom choice overrides auto-detection
    const explicit = resolveEffectiveProductAsset({
      name: "Special Mango Drink",
      categoryName: "Beverages",
      storedAssetKey: "products/beverages/glass-bottle",
      storedAssetVersion: "2.0.0",
    });
    expect(explicit.isExplicit).toBe(true);
    expect(explicit.entry.key).toBe("products/beverages/glass-bottle");

    // Legacy v1.0.0 cereal-box fallback on Fresh Bananas upgrades seamlessly to banana-bunch
    const upgraded = resolveEffectiveProductAsset({
      name: "Fresh Zanzibar Bananas",
      categoryName: "Fruits & Vegetables",
      storedAssetKey: "products/groceries/cereal-box",
      storedAssetVersion: "1.0.0",
    });
    expect(upgraded.isExplicit).toBe(false);
    expect(upgraded.entry.key).toBe("products/produce/banana-bunch");

    // Non-product keys cannot be selected as product shapes
    expect(isValidProductAssetKey("furniture/shelf")).toBe(false);
    expect(isValidProductAssetKey("products/bakery/bread-loaf")).toBe(true);
  });
});
