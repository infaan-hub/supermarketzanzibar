#!/usr/bin/env node
/**
 * Procedural glTF 2.0 binary (.glb) asset generator for Supermarket Zanzibar.
 *
 * Generates Khronos glTF 2.0 compliant .glb files using Three.js primitives
 * with PBR metallic-roughness materials, vertex normals, UVs, accurate
 * bounding boxes, and named child node hierarchies matching the Blender
 * authoring specification (`scripts/blender/build_supermarket_assets.py`).
 *
 * Usage: node scripts/generate_glb_assets.mjs
 */

import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

const ROOT = path.resolve(process.cwd(), "public", "models");

function hexToRgba(hex, alpha = 1) {
  const c = new THREE.Color(hex);
  return [
    Number(c.r.toFixed(4)),
    Number(c.g.toFixed(4)),
    Number(c.b.toFixed(4)),
    alpha,
  ];
}

function pad4(buf) {
  const rem = buf.length % 4;
  if (rem === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(4 - rem, 0)]);
}

/**
 * Pack an array of `{ name, geometry, position, rotation, scale, material }`
 * parts under a named root node into a spec-valid glTF 2.0 binary (.glb).
 */
function buildGlb(rootName, parts, emptyMarkers = []) {
  const binChunks = [];
  let byteOffset = 0;

  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const materialIndexByKey = new Map();
  const meshes = [];
  const nodes = [];

  function pushTypedArray(typedArray, target) {
    const raw = Buffer.from(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength,
    );
    const padded = pad4(raw);
    const viewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: raw.length,
      ...(target ? { target } : {}),
    });
    binChunks.push(padded);
    byteOffset += padded.length;
    return viewIndex;
  }

  function getMaterialIndex(matSpec) {
    const key = JSON.stringify(matSpec);
    if (materialIndexByKey.has(key)) return materialIndexByKey.get(key);
    const idx = materials.length;
    const mat = {
      name: matSpec.name || `Mat_${idx}`,
      pbrMetallicRoughness: {
        baseColorFactor: hexToRgba(matSpec.color, matSpec.alpha ?? 1),
        metallicFactor: matSpec.metallic ?? 0.05,
        roughnessFactor: matSpec.roughness ?? 0.65,
      },
    };
    if ((matSpec.alpha ?? 1) < 1) {
      mat.alphaMode = "BLEND";
      mat.doubleSided = true;
    }
    if (matSpec.emissive) {
      const e = new THREE.Color(matSpec.emissive);
      mat.emissiveFactor = [
        Number(e.r.toFixed(4)),
        Number(e.g.toFixed(4)),
        Number(e.b.toFixed(4)),
      ];
    }
    materials.push(mat);
    materialIndexByKey.set(key, idx);
    return idx;
  }

  const childNodeIndices = [];

  // Root node will live at index 0.
  nodes.push({ name: rootName, children: childNodeIndices });

  for (const part of parts) {
    const geom = part.geometry;
    geom.computeVertexNormals();
    const posAttr = geom.getAttribute("position");
    const normAttr = geom.getAttribute("normal");
    const uvAttr = geom.getAttribute("uv");
    const indexAttr = geom.getIndex();

    const posArray = new Float32Array(posAttr.array);
    const normArray = new Float32Array(normAttr.array);
    const uvArray = uvAttr
      ? new Float32Array(uvAttr.array)
      : new Float32Array((posArray.length / 3) * 2);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posArray.length; i += 3) {
      for (let a = 0; a < 3; a += 1) {
        const v = posArray[i + a];
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }

    const posView = pushTypedArray(posArray, 34962);
    const posAccessor = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: posAttr.count,
      type: "VEC3",
      min,
      max,
    });

    const normView = pushTypedArray(normArray, 34962);
    const normAccessor = accessors.length;
    accessors.push({
      bufferView: normView,
      componentType: 5126,
      count: normAttr.count,
      type: "VEC3",
    });

    const uvView = pushTypedArray(uvArray, 34962);
    const uvAccessor = accessors.length;
    accessors.push({
      bufferView: uvView,
      componentType: 5126,
      count: posAttr.count,
      type: "VEC2",
    });

    const primitive = {
      attributes: {
        POSITION: posAccessor,
        NORMAL: normAccessor,
        TEXCOORD_0: uvAccessor,
      },
      material: getMaterialIndex(part.material),
    };

    if (indexAttr) {
      const idxArray =
        posAttr.count > 65535
          ? new Uint32Array(indexAttr.array)
          : new Uint16Array(indexAttr.array);
      const idxView = pushTypedArray(idxArray, 34963);
      const idxAccessor = accessors.length;
      accessors.push({
        bufferView: idxView,
        componentType: posAttr.count > 65535 ? 5125 : 5123,
        count: indexAttr.count,
        type: "SCALAR",
      });
      primitive.indices = idxAccessor;
    }

    const meshIndex = meshes.length;
    meshes.push({ name: `${part.name}_Mesh`, primitives: [primitive] });

    const node = { name: part.name, mesh: meshIndex };
    if (part.position) node.translation = part.position;
    if (part.rotation) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...part.rotation),
      );
      node.rotation = [q.x, q.y, q.z, q.w];
    }
    if (part.scale) node.scale = part.scale;

    const nodeIndex = nodes.length;
    nodes.push(node);
    childNodeIndices.push(nodeIndex);
    geom.dispose();
  }

  for (const marker of emptyMarkers) {
    const nodeIndex = nodes.length;
    nodes.push({
      name: marker.name,
      translation: marker.position,
    });
    childNodeIndices.push(nodeIndex);
  }

  const binBuffer = pad4(Buffer.concat(binChunks));

  const gltf = {
    asset: {
      version: "2.0",
      generator: "SupermarketZanzibar-ProceduralGLB-1.0",
    },
    scene: 0,
    scenes: [{ name: rootName, nodes: [0] }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.length }],
  };

  let jsonBuf = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonRem = jsonBuf.length % 4;
  if (jsonRem !== 0) {
    jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - jsonRem, 0x20)]);
  }

  const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4); // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binBuffer]);
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}
function cyl(rt, rb, h, seg = 28) {
  return new THREE.CylinderGeometry(rt, rb, h, seg);
}
function latheProfile(points, seg = 28) {
  const vecs = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(vecs, seg);
}

const ASSETS = [
  // ---- Supermarket Structural Assets ----
  {
    rel: "supermarket/building.glb",
    root: "Supermarket_Building",
    parts: [
      { name: "North_Wall", geometry: box(38, 5.2, 0.35), position: [0, 2.6, -14], material: { name: "WallPlaster", color: "#eef5f4", roughness: 0.85 } },
      { name: "West_Wall", geometry: box(0.35, 5.2, 28), position: [-19, 2.6, 0], material: { name: "WallPlaster", color: "#eef5f4", roughness: 0.85 } },
      { name: "East_Wall", geometry: box(0.35, 5.2, 28), position: [19, 2.6, 0], material: { name: "WallPlaster", color: "#eef5f4", roughness: 0.85 } },
      { name: "Glass_Facade_Left", geometry: box(14.5, 4.4, 0.14), position: [-11.5, 2.2, 14], material: { name: "StoreGlass", color: "#c8ecec", alpha: 0.38, roughness: 0.12, metallic: 0.1 } },
      { name: "Glass_Facade_Right", geometry: box(14.5, 4.4, 0.14), position: [11.5, 2.2, 14], material: { name: "StoreGlass", color: "#c8ecec", alpha: 0.38, roughness: 0.12, metallic: 0.1 } },
      { name: "Entrance_Header", geometry: box(38.4, 0.9, 0.8), position: [0, 4.85, 14.1], material: { name: "FasciaTeal", color: "#0f766e", roughness: 0.35, metallic: 0.2 } },
    ],
  },
  {
    rel: "supermarket/floor.glb",
    root: "Supermarket_Floor",
    parts: [
      { name: "Retail_Floor_Slab", geometry: box(38, 0.12, 28), position: [0, -0.06, 0], material: { name: "TerrazzoTile", color: "#f3f8f7", roughness: 0.32, metallic: 0.05 } },
      { name: "Warehouse_Floor_Slab", geometry: box(38, 0.12, 16), position: [0, -0.06, -22], material: { name: "EpoxyConcrete", color: "#dde4e4", roughness: 0.72 } },
    ],
  },
  {
    rel: "supermarket/ceiling.glb",
    root: "Supermarket_Ceiling",
    parts: [
      { name: "Ceiling_Beam_01", geometry: box(38, 0.25, 0.3), position: [0, 5.1, -8], material: { name: "SteelTruss", color: "#cbd5e1", metallic: 0.55, roughness: 0.45 } },
      { name: "Ceiling_Beam_02", geometry: box(38, 0.25, 0.3), position: [0, 5.1, 0], material: { name: "SteelTruss", color: "#cbd5e1", metallic: 0.55, roughness: 0.45 } },
      { name: "Ceiling_Beam_03", geometry: box(38, 0.25, 0.3), position: [0, 5.1, 8], material: { name: "SteelTruss", color: "#cbd5e1", metallic: 0.55, roughness: 0.45 } },
    ],
  },
  {
    rel: "supermarket/lighting.glb",
    root: "Supermarket_Lighting",
    parts: [
      { name: "LED_Strip_Housing", geometry: box(2.4, 0.08, 0.28), position: [0, 0, 0], material: { name: "Aluminium", color: "#e2e8f0", metallic: 0.7, roughness: 0.3 } },
      { name: "LED_Diffuser", geometry: box(2.3, 0.03, 0.22), position: [0, -0.05, 0], material: { name: "WarmLED", color: "#ffffff", emissive: "#f0fdfa", roughness: 0.2 } },
    ],
  },

  // ---- Department Specialty Fixtures ----
  {
    rel: "departments/beverages.glb",
    root: "Department_Beverages",
    parts: [
      { name: "Sign_Board", geometry: box(3.4, 0.55, 0.12), position: [0, 3.6, 0], material: { name: "BevSign", color: "#0e7490", roughness: 0.4 } },
      { name: "Endcap_Base", geometry: box(1.2, 0.3, 1.0), position: [0, 0.15, 0], material: { name: "SteelDark", color: "#334155", metallic: 0.5, roughness: 0.45 } },
    ],
  },
  {
    rel: "departments/groceries.glb",
    root: "Department_Groceries",
    parts: [
      { name: "Sign_Board", geometry: box(3.4, 0.55, 0.12), position: [0, 3.6, 0], material: { name: "GroSign", color: "#15803d", roughness: 0.4 } },
      { name: "Endcap_Base", geometry: box(1.2, 0.3, 1.0), position: [0, 0.15, 0], material: { name: "SteelDark", color: "#334155", metallic: 0.5, roughness: 0.45 } },
    ],
  },
  {
    rel: "departments/bakery.glb",
    root: "Department_Bakery",
    parts: [
      { name: "Wood_Counter", geometry: box(2.4, 0.9, 1.0), position: [0, 0.45, 0], material: { name: "WarmOak", color: "#b68049", roughness: 0.65 } },
      { name: "Glass_Canopy", geometry: box(2.36, 0.65, 0.92), position: [0, 1.22, 0], material: { name: "DisplayGlass", color: "#e0f2fe", alpha: 0.35, roughness: 0.1 } },
      { name: "Bakery_Tray_01", geometry: box(2.1, 0.04, 0.72), position: [0, 1.05, 0], material: { name: "BrassTray", color: "#d4a359", metallic: 0.5, roughness: 0.35 } },
    ],
  },
  {
    rel: "departments/cosmetics.glb",
    root: "Department_Cosmetics",
    parts: [
      { name: "Boutique_Frame", geometry: box(2.0, 1.95, 0.75), position: [0, 0.975, 0], material: { name: "PearlWhite", color: "#f8fafc", roughness: 0.25 } },
      { name: "LED_Header", geometry: box(2.02, 0.16, 0.78), position: [0, 1.95, 0], material: { name: "RoseAccent", color: "#db2777", roughness: 0.35 } },
    ],
  },
  {
    rel: "departments/electronics.glb",
    root: "Department_Electronics",
    parts: [
      { name: "Cabinet_Base", geometry: box(2.2, 0.85, 0.8), position: [0, 0.425, 0], material: { name: "SlateMetal", color: "#1e293b", metallic: 0.6, roughness: 0.35 } },
      { name: "Security_Glass", geometry: box(2.16, 0.95, 0.76), position: [0, 1.325, 0], material: { name: "DisplayGlass", color: "#cffafe", alpha: 0.32, roughness: 0.1 } },
    ],
  },
  {
    rel: "departments/frozen-food.glb",
    root: "Department_Frozen",
    parts: [
      { name: "Freezer_Body", geometry: box(2.4, 0.92, 1.3), position: [0, 0.46, 0], material: { name: "WhiteEnamel", color: "#f1f5f9", roughness: 0.3, metallic: 0.15 } },
      { name: "Sliding_Glass_Lid", geometry: box(2.28, 0.05, 1.18), position: [0, 0.94, 0], material: { name: "FrostGlass", color: "#bae6fd", alpha: 0.4, roughness: 0.12 } },
      { name: "Bumper_Rail", geometry: box(2.46, 0.08, 1.36), position: [0, 0.22, 0], material: { name: "CyanBumper", color: "#0284c7", roughness: 0.45 } },
    ],
  },

  // ---- Furniture & Equipment ----
  {
    rel: "furniture/shelf.glb",
    root: "Shelf_Gondola",
    parts: [
      { name: "Frame", geometry: box(1.0, 2.1, 0.08), position: [0, 1.05, -0.46], material: { name: "PowderSteel", color: "#e2e8f0", metallic: 0.45, roughness: 0.4 } },
      { name: "Upright_Left", geometry: box(0.07, 2.1, 0.94), position: [-0.465, 1.05, 0], material: { name: "PowderSteel", color: "#cbd5e1", metallic: 0.5, roughness: 0.4 } },
      { name: "Upright_Right", geometry: box(0.07, 2.1, 0.94), position: [0.465, 1.05, 0], material: { name: "PowderSteel", color: "#cbd5e1", metallic: 0.5, roughness: 0.4 } },
      { name: "Bottom_Shelf", geometry: box(0.96, 0.06, 0.92), position: [0, 0.2, 0], material: { name: "ShelfDeck", color: "#f8fafc", metallic: 0.25, roughness: 0.35 } },
      { name: "Middle_Shelf_Lower", geometry: box(0.96, 0.045, 0.86), position: [0, 0.78, 0], material: { name: "ShelfDeck", color: "#f8fafc", metallic: 0.25, roughness: 0.35 } },
      { name: "Middle_Shelf_Upper", geometry: box(0.96, 0.045, 0.86), position: [0, 1.34, 0], material: { name: "ShelfDeck", color: "#f8fafc", metallic: 0.25, roughness: 0.35 } },
      { name: "Top_Shelf", geometry: box(0.96, 0.045, 0.84), position: [0, 1.9, 0], material: { name: "ShelfDeck", color: "#f8fafc", metallic: 0.25, roughness: 0.35 } },
      { name: "Shelf_Labels", geometry: box(0.96, 0.04, 0.02), position: [0, 1.32, 0.44], material: { name: "PriceRailTeal", color: "#0f766e", roughness: 0.4 } },
    ],
    markers: [
      { name: "Product_Position_01", position: [-0.3, 0.23, 0.22] },
      { name: "Product_Position_02", position: [0.0, 0.23, 0.22] },
      { name: "Product_Position_03", position: [0.3, 0.23, 0.22] },
      { name: "Product_Position_04", position: [-0.3, 0.81, 0.22] },
      { name: "Product_Position_05", position: [0.0, 0.81, 0.22] },
      { name: "Product_Position_06", position: [0.3, 0.81, 0.22] },
    ],
  },
  {
    rel: "furniture/refrigerator.glb",
    root: "Chiller_Refrigerator",
    parts: [
      { name: "Cabinet_Shell", geometry: box(1.8, 2.2, 0.95), position: [0, 1.1, 0], material: { name: "BrushedSteel", color: "#dbe5ea", metallic: 0.6, roughness: 0.3 } },
      { name: "Glass_Door_Left", geometry: box(0.84, 1.72, 0.04), position: [-0.43, 1.15, 0.48], material: { name: "CoolerGlass", color: "#d8f3f8", alpha: 0.34, roughness: 0.08 } },
      { name: "Glass_Door_Right", geometry: box(0.84, 1.72, 0.04), position: [0.43, 1.15, 0.48], material: { name: "CoolerGlass", color: "#d8f3f8", alpha: 0.34, roughness: 0.08 } },
      { name: "Header_Canopy", geometry: box(1.82, 0.24, 0.98), position: [0, 2.1, 0], material: { name: "ChillerBlue", color: "#0284c7", roughness: 0.35 } },
    ],
  },
  {
    rel: "furniture/checkout.glb",
    root: "Checkout_Counter",
    parts: [
      { name: "Kickplate_Base", geometry: box(1.36, 0.14, 2.54), position: [0, 0.07, 0], material: { name: "KickplateCharcoal", color: "#1e293b", metallic: 0.45, roughness: 0.5 } },
      { name: "Counter_Body", geometry: box(1.42, 0.78, 2.62), position: [0, 0.53, 0], material: { name: "CounterWhite", color: "#f1f5f9", roughness: 0.32 } },
      { name: "Side_Accent_Panel", geometry: box(1.45, 0.22, 2.58), position: [0, 0.42, 0], material: { name: "LaneTeal", color: "#0f766e", roughness: 0.35 } },
      { name: "Stainless_BagWell", geometry: box(1.38, 0.04, 0.75), position: [0, 0.93, -0.92], material: { name: "BrushedSteel", color: "#cbd5e1", metallic: 0.85, roughness: 0.24 } },
      { name: "Conveyor_Belt", geometry: box(0.56, 0.045, 1.56), position: [-0.28, 0.945, 0.42], material: { name: "RubberBelt", color: "#1e293b", roughness: 0.88 } },
      { name: "Belt_Chrome_Trim", geometry: box(0.62, 0.05, 0.04), position: [-0.28, 0.945, 1.2], material: { name: "Chrome", color: "#cbd5e1", metallic: 0.85, roughness: 0.2 } },
      { name: "POS_Stand", geometry: cyl(0.03, 0.04, 0.24, 16), position: [0.35, 1.04, -0.35], material: { name: "ScreenDark", color: "#1e293b", metallic: 0.5, roughness: 0.3 } },
      { name: "POS_Monitor", geometry: box(0.38, 0.28, 0.045), position: [0.35, 1.24, -0.35], rotation: [-0.15, 0, 0], material: { name: "ScreenDark", color: "#0f172a", metallic: 0.3, roughness: 0.18 } },
      { name: "POS_Screen_Glow", geometry: box(0.34, 0.23, 0.01), position: [0.35, 1.24, -0.32], rotation: [-0.15, 0, 0], material: { name: "PosGlow", color: "#38bdf8", emissive: "#0284c7", roughness: 0.15 } },
      { name: "Card_Terminal", geometry: box(0.11, 0.07, 0.16), position: [0.42, 0.98, 0.12], rotation: [-0.3, -0.3, 0], material: { name: "ScreenDark", color: "#1e293b", metallic: 0.25, roughness: 0.35 } },
      { name: "Barcode_Scanner", geometry: box(0.26, 0.03, 0.26), position: [-0.28, 0.945, -0.48], material: { name: "ScannerGlass", color: "#14b8a6", emissive: "#0f766e", roughness: 0.12 } },
      { name: "Lane_Sign_Pole", geometry: cyl(0.024, 0.024, 1.38, 16), position: [0.55, 1.61, -0.9], material: { name: "Chrome", color: "#cbd5e1", metallic: 0.88, roughness: 0.18 } },
      { name: "Lane_Sign_Box", geometry: box(0.36, 0.26, 0.1), position: [0.55, 2.28, -0.9], material: { name: "LaneTeal", color: "#0f766e", roughness: 0.32 } },
      { name: "Lane_Status_Beacon", geometry: cyl(0.045, 0.045, 0.07, 16), position: [0.55, 2.45, -0.9], material: { name: "OpenGreen", color: "#22c55e", emissive: "#16a34a", roughness: 0.2 } },
    ],
  },
  {
    rel: "furniture/shopping-cart.glb",
    root: "Shopping_Cart",
    parts: [
      // Tapered steel chassis + 4 rubber caster wheels
      { name: "Chassis_Frame", geometry: box(0.54, 0.055, 0.88), position: [0, 0.14, 0], material: { name: "ChromeWire", color: "#94a3b8", metallic: 0.85, roughness: 0.22 } },
      { name: "Wheel_FL", geometry: cyl(0.055, 0.055, 0.028, 16), position: [-0.24, 0.055, -0.34], rotation: [0, 0, Math.PI / 2], material: { name: "RubberWheel", color: "#1e293b", roughness: 0.85 } },
      { name: "Wheel_FR", geometry: cyl(0.055, 0.055, 0.028, 16), position: [0.24, 0.055, -0.34], rotation: [0, 0, Math.PI / 2], material: { name: "RubberWheel", color: "#1e293b", roughness: 0.85 } },
      { name: "Wheel_RL", geometry: cyl(0.055, 0.055, 0.028, 16), position: [-0.24, 0.055, 0.34], rotation: [0, 0, Math.PI / 2], material: { name: "RubberWheel", color: "#1e293b", roughness: 0.85 } },
      { name: "Wheel_RR", geometry: cyl(0.055, 0.055, 0.028, 16), position: [0.24, 0.055, 0.34], rotation: [0, 0, Math.PI / 2], material: { name: "RubberWheel", color: "#1e293b", roughness: 0.85 } },
      // Rear tubular frame uprights
      { name: "Upright_Rear_L", geometry: cyl(0.015, 0.015, 0.82, 12), position: [-0.26, 0.55, 0.42], rotation: [0.12, 0, 0], material: { name: "ChromeWire", color: "#cbd5e1", metallic: 0.88, roughness: 0.2 } },
      { name: "Upright_Rear_R", geometry: cyl(0.015, 0.015, 0.82, 12), position: [0.26, 0.55, 0.42], rotation: [0.12, 0, 0], material: { name: "ChromeWire", color: "#cbd5e1", metallic: 0.88, roughness: 0.2 } },
      // Open-top wire basket shell (bottom + 4 slim rails + perforated walls)
      { name: "Basket_Body", geometry: box(0.56, 0.03, 0.84), position: [0, 0.44, -0.02], material: { name: "ChromeWire", color: "#94a3b8", metallic: 0.84, roughness: 0.24 } },
      { name: "Basket_Wall_L", geometry: box(0.022, 0.42, 0.84), position: [-0.28, 0.66, -0.02], material: { name: "ChromeMesh", color: "#cbd5e1", metallic: 0.82, roughness: 0.26, alpha: 0.68 } },
      { name: "Basket_Wall_R", geometry: box(0.022, 0.42, 0.84), position: [0.28, 0.66, -0.02], material: { name: "ChromeMesh", color: "#cbd5e1", metallic: 0.82, roughness: 0.26, alpha: 0.68 } },
      { name: "Basket_Wall_Front", geometry: box(0.56, 0.38, 0.022), position: [0, 0.64, -0.44], material: { name: "ChromeMesh", color: "#cbd5e1", metallic: 0.82, roughness: 0.26, alpha: 0.68 } },
      { name: "Basket_Rim_Top", geometry: box(0.58, 0.028, 0.86), position: [0, 0.87, -0.02], material: { name: "TealTrim", color: "#0f766e", roughness: 0.4 } },
      { name: "Child_Seat", geometry: box(0.52, 0.025, 0.22), position: [0, 0.68, 0.28], material: { name: "TealGrip", color: "#0d9488", roughness: 0.45 } },
      { name: "Handle_Bar", geometry: cyl(0.022, 0.022, 0.58, 16), position: [0, 0.96, 0.46], rotation: [0, 0, Math.PI / 2], material: { name: "TealGrip", color: "#0f766e", roughness: 0.42 } },
    ],
  },
  {
    rel: "furniture/basket.glb",
    root: "Shopping_Basket",
    parts: [
      { name: "Basket_Tub", geometry: box(0.44, 0.22, 0.31), position: [0, 0.11, 0], material: { name: "TealPlastic", color: "#0f766e", roughness: 0.42 } },
      { name: "Basket_Rim", geometry: box(0.47, 0.032, 0.34), position: [0, 0.23, 0], material: { name: "TealRim", color: "#115e59", roughness: 0.38 } },
      { name: "Handle_Grip", geometry: box(0.36, 0.028, 0.036), position: [0, 0.255, 0.06], material: { name: "DarkPlastic", color: "#1e293b", roughness: 0.45 } },
      { name: "Handle_Grip_Back", geometry: box(0.36, 0.028, 0.036), position: [0, 0.255, -0.06], material: { name: "DarkPlastic", color: "#1e293b", roughness: 0.45 } },
    ],
  },
  {
    rel: "furniture/warehouse-rack.glb",
    root: "Warehouse_Rack",
    parts: [
      { name: "Upright_Left", geometry: box(0.1, 4.2, 1.15), position: [-2.25, 2.1, 0], material: { name: "RackBlue", color: "#1d4ed8", metallic: 0.5, roughness: 0.45 } },
      { name: "Upright_Right", geometry: box(0.1, 4.2, 1.15), position: [2.25, 2.1, 0], material: { name: "RackBlue", color: "#1d4ed8", metallic: 0.5, roughness: 0.45 } },
      { name: "Level_01", geometry: box(4.5, 0.12, 1.1), position: [0, 0.45, 0], material: { name: "BeamOrange", color: "#ea580c", metallic: 0.45, roughness: 0.4 } },
      { name: "Level_02", geometry: box(4.5, 0.12, 1.1), position: [0, 1.85, 0], material: { name: "BeamOrange", color: "#ea580c", metallic: 0.45, roughness: 0.4 } },
      { name: "Level_03", geometry: box(4.5, 0.12, 1.1), position: [0, 3.25, 0], material: { name: "BeamOrange", color: "#ea580c", metallic: 0.45, roughness: 0.4 } },
    ],
    markers: [
      { name: "Position_001", position: [-1.45, 0.52, 0] },
      { name: "Position_002", position: [0, 0.52, 0] },
      { name: "Position_003", position: [1.45, 0.52, 0] },
    ],
  },

  // ---- HD Contoured Procedural Supermarket Product Models ----
  {
    rel: "products/beverages/soda-can.glb",
    root: "Product_Soda_Can",
    parts: [
      {
        name: "Can_Body",
        geometry: latheProfile([
          [0.027, 0.0],
          [0.033, 0.008],
          [0.033, 0.11],
          [0.0285, 0.122],
          [0.027, 0.122],
        ], 28),
        position: [0, 0, 0],
        material: { name: "CanRed", color: "#dc2626", metallic: 0.74, roughness: 0.22 },
      },
      { name: "Can_Rim", geometry: cyl(0.029, 0.0295, 0.006, 28), position: [0, 0.123, 0], material: { name: "CanSilver", color: "#e2e8f0", metallic: 0.92, roughness: 0.16 } },
      { name: "Pull_Tab", geometry: box(0.011, 0.003, 0.02), position: [0, 0.127, 0.004], material: { name: "CanSilver", color: "#cbd5e1", metallic: 0.9, roughness: 0.2 } },
    ],
  },
  {
    rel: "products/beverages/soda-bottle.glb",
    root: "Product_Soda_Bottle",
    parts: [
      {
        name: "Bottle_Body",
        geometry: latheProfile([
          [0.036, 0.0],
          [0.046, 0.014],
          [0.046, 0.175],
          [0.043, 0.205],
          [0.024, 0.245],
          [0.016, 0.278],
          [0.0155, 0.292],
        ], 28),
        position: [0, 0, 0],
        material: { name: "DarkSoda", color: "#2e1209", roughness: 0.12, metallic: 0.06 },
      },
      { name: "Bottle_Neck_Collar", geometry: cyl(0.0185, 0.0185, 0.008, 24), position: [0, 0.285, 0], material: { name: "CapRed", color: "#dc2626", roughness: 0.4 } },
      { name: "Bottle_Label", geometry: cyl(0.0468, 0.0468, 0.088, 28), position: [0, 0.118, 0], material: { name: "BrandRed", color: "#b91c1c", roughness: 0.34 } },
      { name: "Bottle_Cap", geometry: cyl(0.0175, 0.0175, 0.02, 24), position: [0, 0.302, 0], material: { name: "CapRed", color: "#dc2626", roughness: 0.42 } },
    ],
  },
  {
    rel: "products/beverages/water-bottle.glb",
    root: "Product_Water_Bottle",
    parts: [
      {
        name: "Water_Body",
        geometry: latheProfile([
          [0.035, 0.0],
          [0.042, 0.012],
          [0.042, 0.07],
          [0.039, 0.085],
          [0.042, 0.10],
          [0.042, 0.185],
          [0.036, 0.215],
          [0.018, 0.252],
          [0.015, 0.27],
        ], 28),
        position: [0, 0, 0],
        material: { name: "AquaPET", color: "#cdeefe", alpha: 0.72, roughness: 0.06, metallic: 0.05 },
      },
      { name: "Water_Label", geometry: cyl(0.0426, 0.0426, 0.075, 28), position: [0, 0.128, 0], material: { name: "LabelBlue", color: "#0284c7", roughness: 0.32 } },
      { name: "Water_Cap", geometry: cyl(0.0165, 0.0165, 0.019, 24), position: [0, 0.28, 0], material: { name: "CapBlue", color: "#0369a1", roughness: 0.4 } },
    ],
  },
  {
    rel: "products/beverages/juice-carton.glb",
    root: "Product_Juice_Carton",
    parts: [
      { name: "Carton_Box", geometry: box(0.076, 0.205, 0.076), position: [0, 0.1025, 0], material: { name: "JuiceOrange", color: "#f97316", roughness: 0.42 } },
      { name: "Carton_Top_Bevel", geometry: box(0.072, 0.014, 0.072), position: [0, 0.21, 0], material: { name: "JuiceTop", color: "#fb923c", roughness: 0.4 } },
      { name: "Spout_Collar", geometry: cyl(0.014, 0.015, 0.008, 18), position: [0.015, 0.219, 0.014], material: { name: "WhiteCap", color: "#f8fafc", roughness: 0.35 } },
      { name: "Spout_Cap", geometry: cyl(0.0125, 0.0125, 0.016, 18), position: [0.015, 0.228, 0.014], material: { name: "WhiteCap", color: "#ffffff", roughness: 0.35 } },
    ],
  },
  {
    rel: "products/groceries/rice-bag.glb",
    root: "Product_Rice_Bag",
    parts: [
      { name: "Sack_Body", geometry: box(0.24, 0.32, 0.115), position: [0, 0.16, 0], material: { name: "WovenSack", color: "#f5f0e1", roughness: 0.84 } },
      { name: "Sack_Top_Crimp", geometry: box(0.245, 0.032, 0.042), position: [0, 0.33, 0], material: { name: "SackCrimp", color: "#e9e0ca", roughness: 0.88 } },
      { name: "Brand_Stripe", geometry: box(0.244, 0.105, 0.119), position: [0, 0.19, 0], material: { name: "RiceGreen", color: "#15803d", roughness: 0.65 } },
    ],
  },
  {
    rel: "products/groceries/flour-bag.glb",
    root: "Product_Flour_Bag",
    parts: [
      { name: "Flour_Paper", geometry: box(0.16, 0.23, 0.096), position: [0, 0.115, 0], material: { name: "KraftPaper", color: "#fef3c7", roughness: 0.86 } },
      { name: "Flour_Fold_Top", geometry: box(0.162, 0.025, 0.048), position: [0, 0.24, 0], material: { name: "KraftFold", color: "#fde68a", roughness: 0.88 } },
      { name: "Flour_Band", geometry: box(0.164, 0.075, 0.1), position: [0, 0.135, 0], material: { name: "WheatGold", color: "#d97706", roughness: 0.65 } },
    ],
  },
  {
    rel: "products/groceries/oil-bottle.glb",
    root: "Product_Oil_Bottle",
    parts: [
      {
        name: "Oil_Body",
        geometry: latheProfile([
          [0.046, 0.0],
          [0.058, 0.015],
          [0.058, 0.20],
          [0.052, 0.235],
          [0.026, 0.28],
          [0.020, 0.305],
        ], 28),
        position: [0, 0, 0],
        material: { name: "GoldenOil", color: "#eab308", alpha: 0.88, roughness: 0.12, metallic: 0.04 },
      },
      { name: "Oil_Handle", geometry: box(0.018, 0.11, 0.028), position: [0.062, 0.17, 0], material: { name: "GoldenOil", color: "#facc15", alpha: 0.82, roughness: 0.16 } },
      { name: "Oil_Cap", geometry: cyl(0.022, 0.022, 0.022, 22), position: [0, 0.318, 0], material: { name: "CapGreen", color: "#16a34a", roughness: 0.38 } },
    ],
  },
  {
    rel: "products/groceries/cereal-box.glb",
    root: "Product_Cereal_Box",
    parts: [
      { name: "Cereal_Carton", geometry: box(0.2, 0.29, 0.068), position: [0, 0.145, 0], material: { name: "CerealAmber", color: "#f59e0b", roughness: 0.48 } },
      { name: "Cereal_Banner", geometry: box(0.203, 0.08, 0.071), position: [0, 0.215, 0], material: { name: "CerealTeal", color: "#0f766e", roughness: 0.42 } },
    ],
  },
  {
    rel: "products/groceries/biscuits-pack.glb",
    root: "Product_Biscuits_Pack",
    parts: [
      { name: "Biscuits_Wrap", geometry: box(0.18, 0.064, 0.074), position: [0, 0.032, 0], material: { name: "BiscuitBlue", color: "#2563eb", roughness: 0.36 } },
      { name: "Crimp_L", geometry: box(0.012, 0.048, 0.072), position: [-0.095, 0.032, 0], material: { name: "BiscuitEdge", color: "#1d4ed8", roughness: 0.4 } },
      { name: "Crimp_R", geometry: box(0.012, 0.048, 0.072), position: [0.095, 0.032, 0], material: { name: "BiscuitEdge", color: "#1d4ed8", roughness: 0.4 } },
    ],
  },
  {
    rel: "products/groceries/canned-food.glb",
    root: "Product_Canned_Food",
    parts: [
      { name: "Tin_Can", geometry: cyl(0.042, 0.042, 0.112, 28), position: [0, 0.056, 0], material: { name: "TinMetal", color: "#cbd5e1", metallic: 0.88, roughness: 0.22 } },
      { name: "Tin_Bead_Top", geometry: cyl(0.0435, 0.0435, 0.008, 28), position: [0, 0.109, 0], material: { name: "TinMetal", color: "#e2e8f0", metallic: 0.92, roughness: 0.18 } },
      { name: "Tin_Bead_Bot", geometry: cyl(0.0435, 0.0435, 0.008, 28), position: [0, 0.005, 0], material: { name: "TinMetal", color: "#e2e8f0", metallic: 0.92, roughness: 0.18 } },
      { name: "Can_Label", geometry: cyl(0.0426, 0.0426, 0.088, 28), position: [0, 0.056, 0], material: { name: "TomatoRed", color: "#ef4444", roughness: 0.48 } },
    ],
  },
  {
    rel: "products/dairy/milk-carton.glb",
    root: "Product_Milk_Carton",
    parts: [
      { name: "Carton_Body", geometry: box(0.074, 0.175, 0.074), position: [0, 0.0875, 0], material: { name: "MilkWhite", color: "#f8fafc", roughness: 0.4 } },
      { name: "Gable_Roof_Front", geometry: box(0.074, 0.042, 0.048), position: [0, 0.186, 0.016], rotation: [-0.55, 0, 0], material: { name: "MilkWhite", color: "#f1f5f9", roughness: 0.4 } },
      { name: "Gable_Roof_Back", geometry: box(0.074, 0.042, 0.048), position: [0, 0.186, -0.016], rotation: [0.55, 0, 0], material: { name: "MilkWhite", color: "#f1f5f9", roughness: 0.4 } },
      { name: "Gable_Ridge", geometry: box(0.074, 0.016, 0.008), position: [0, 0.212, 0], material: { name: "DairyBlue", color: "#0284c7", roughness: 0.38 } },
      { name: "Milk_Stripe", geometry: box(0.076, 0.06, 0.076), position: [0, 0.105, 0], material: { name: "DairyBlue", color: "#0284c7", roughness: 0.36 } },
      { name: "Milk_Cap", geometry: cyl(0.0115, 0.0115, 0.014, 18), position: [0.016, 0.194, 0.022], rotation: [0.52, 0, 0], material: { name: "DairyBlue", color: "#0369a1", roughness: 0.35 } },
    ],
  },
  {
    rel: "products/dairy/frozen-pack.glb",
    root: "Product_Frozen_Pack",
    parts: [
      { name: "Frozen_Tray", geometry: box(0.22, 0.056, 0.16), position: [0, 0.028, 0], material: { name: "IceBlue", color: "#0369a1", roughness: 0.3 } },
      { name: "Frozen_Label", geometry: box(0.19, 0.008, 0.13), position: [0, 0.058, 0], material: { name: "FrostWhite", color: "#e0f2fe", roughness: 0.26 } },
    ],
  },
  {
    rel: "products/cosmetics/soap-box.glb",
    root: "Product_Soap_Box",
    parts: [
      { name: "Soap_Carton", geometry: box(0.094, 0.038, 0.064), position: [0, 0.019, 0], material: { name: "SoapMint", color: "#2dd4bf", roughness: 0.36 } },
    ],
  },
  {
    rel: "products/cosmetics/toothpaste-box.glb",
    root: "Product_Toothpaste_Box",
    parts: [
      { name: "Paste_Box", geometry: box(0.175, 0.042, 0.04), position: [0, 0.021, 0], material: { name: "MintWhite", color: "#0d9488", roughness: 0.35 } },
    ],
  },
  {
    rel: "products/cosmetics/shampoo-bottle.glb",
    root: "Product_Shampoo_Bottle",
    parts: [
      {
        name: "Shampoo_Body",
        geometry: latheProfile([
          [0.031, 0.0],
          [0.038, 0.016],
          [0.040, 0.14],
          [0.035, 0.195],
          [0.023, 0.214],
        ], 28),
        position: [0, 0, 0],
        scale: [1.15, 1.0, 0.72],
        material: { name: "ShampooRose", color: "#ec4899", roughness: 0.24, metallic: 0.06 },
      },
      { name: "Shampoo_Cap", geometry: cyl(0.022, 0.024, 0.036, 22), position: [0, 0.23, 0], material: { name: "PearlCap", color: "#f8fafc", roughness: 0.26 } },
    ],
  },
];

let count = 0;
for (const asset of ASSETS) {
  const fullPath = path.join(ROOT, asset.rel);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const glb = buildGlb(asset.root, asset.parts, asset.markers ?? []);
  fs.writeFileSync(fullPath, glb);
  count += 1;
}

console.log(`Generated ${count} validated glTF 2.0 binary (.glb) assets under ${ROOT}`);
