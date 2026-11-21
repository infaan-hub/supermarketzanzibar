import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
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

describe("Phase 3 — Validated GLB 3D asset catalog", () => {
  it("contains all 31 catalogued GLB assets on disk with valid glTF 2.0 binary structure", () => {
    expect(ASSET_MANIFEST.length).toBe(31);

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
    }
  });

  it("maps diverse supermarket products to recognizable reusable product models", () => {
    expect(resolveProductAsset("Coca-Cola 330ml Can", "Beverages").key).toBe(
      "products/beverages/soda-can",
    );
    expect(resolveProductAsset("Kilimanjaro Water 1.5L").key).toBe(
      "products/beverages/water-bottle",
    );
    expect(resolveProductAsset("Basmati Rice 5kg", "Groceries").key).toBe(
      "products/groceries/rice-bag",
    );
    expect(resolveProductAsset("Fresh Whole Milk 1L", "Dairy").key).toBe(
      "products/dairy/milk-carton",
    );
    expect(resolveProductAsset("Colgate Toothpaste", "Personal Care").key).toBe(
      "products/cosmetics/toothpaste-box",
    );
  });
});
