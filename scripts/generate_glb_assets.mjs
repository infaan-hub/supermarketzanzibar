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
function sphere(r, wSeg = 20, hSeg = 14) {
  return new THREE.SphereGeometry(r, wSeg, hSeg);
}
function torus(r, tube, rSeg = 12, tSeg = 24, arc = Math.PI * 2) {
  return new THREE.TorusGeometry(r, tube, rSeg, tSeg, arc);
}
function latheProfile(points, seg = 28) {
  const vecs = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(vecs, seg);
}
function extrudeShape(shape, depth, bevel = false) {
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel,
    bevelThickness: bevel ? 0.004 : 0,
    bevelSize: bevel ? 0.004 : 0,
    bevelSegments: bevel ? 2 : 1,
    curveSegments: 10,
  });
  geom.translate(0, 0, -depth / 2);
  return geom;
}
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.min(r, hw, hh);
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad);
  s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad);
  s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}
function breadLoafGeom(length, height, depth) {
  // Cross-section in YZ plane (extruded along X via rotation)
  const s = new THREE.Shape();
  const hd = depth / 2;
  const baseH = height * 0.56;
  s.moveTo(-hd * 0.9, 0);
  s.lineTo(hd * 0.9, 0);
  s.quadraticCurveTo(hd, baseH * 0.4, hd, baseH);
  s.bezierCurveTo(hd, height * 1.04, -hd, height * 1.04, -hd, baseH);
  s.quadraticCurveTo(-hd, baseH * 0.4, -hd * 0.9, 0);
  const geom = extrudeShape(s, length, true);
  geom.rotateY(Math.PI / 2);
  return geom;
}
function cheeseWedgeGeom(radius, height, angle = Math.PI * 0.36) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(radius, 0);
  s.absarc(0, 0, radius, 0, angle, false);
  s.lineTo(0, 0);
  const geom = extrudeShape(s, height, true);
  geom.rotateX(-Math.PI / 2);
  geom.translate(-radius * 0.42, height / 2, radius * 0.24);
  return geom;
}
function cheeseWedgeRindGeom(radius, height, angle = Math.PI * 0.36) {
  const s = new THREE.Shape();
  const rIn = radius - 0.006;
  const rOut = radius + 0.004;
  s.moveTo(rIn, 0);
  s.lineTo(rOut, 0);
  s.absarc(0, 0, rOut, 0, angle, false);
  s.lineTo(Math.cos(angle) * rIn, Math.sin(angle) * rIn);
  s.absarc(0, 0, rIn, angle, 0, true);
  const geom = extrudeShape(s, height + 0.004, false);
  geom.rotateX(-Math.PI / 2);
  geom.translate(-radius * 0.42, height / 2, radius * 0.24);
  return geom;
}
function curvedTube(points, radius, segs = 18, radSegs = 12) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  return new THREE.TubeGeometry(curve, segs, radius, radSegs, false);
}
function taperedBanana(curvePoints, maxR = 0.0155) {
  const curve = new THREE.CatmullRomCurve3(
    curvePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const segs = 18;
  const radSegs = 10;
  const geom = new THREE.TubeGeometry(curve, segs, maxR, radSegs, false);
  const pos = geom.getAttribute("position");
  const centers = curve.getSpacedPoints(segs);
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    // Taper sharply at stem and tip, plump in middle
    const profile = Math.max(0.24, Math.sin(Math.PI * (0.08 + t * 0.84)));
    const center = centers[i];
    for (let j = 0; j <= radSegs; j += 1) {
      const idx = i * (radSegs + 1) + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(center).multiplyScalar(profile).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}
function pillowSackGeom(w, h, d) {
  // Sculpted bulging woven sack: plump bottom, softer pinched shoulders
  const geom = new THREE.BoxGeometry(w, h, d, 10, 14, 6);
  const pos = geom.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / (w / 2); // -1..1
    const ny = (y + h / 2) / h; // 0..1 bottom..top
    // Bulge outward near lower-middle, pinch cleanly at top and bottom seams
    const vertBulge = Math.sin(Math.PI * ny);
    const horizBulge = Math.cos((nx * Math.PI) / 2.35);
    const zScale = 0.42 + 0.72 * vertBulge * horizBulge;
    const xScale = 0.94 + 0.08 * Math.sin(Math.PI * ny) - 0.04 * ny;
    pos.setXYZ(i, x * xScale, y, z * zScale);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}
function standupPouchGeom(w, h, d) {
  // Gusseted Doypack stand-up pouch: wide oval base tapering smoothly to a sealed zip-top
  const geom = new THREE.BoxGeometry(w, h, d, 10, 14, 4);
  const pos = geom.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / (w / 2);
    const ny = (y + h / 2) / h; // 0..1
    const horizCurve = 0.65 + 0.35 * Math.cos((nx * Math.PI) / 2.2);
    // Thick gusseted bottom, sleek thin zip-lock top
    const zFactor = Math.max(0.14, (1.08 - ny * 0.92) * horizCurve);
    const xFactor = 1.0 - ny * 0.08;
    pos.setXYZ(i, x * xFactor, y, z * zFactor);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}
function taperedKraftBagGeom(w, h, d) {
  // Flat-bottomed folded kraft flour/sugar bag: crisp rectangular base tapering up to pinched top
  const geom = new THREE.BoxGeometry(w, h, d, 8, 12, 4);
  const pos = geom.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = (y + h / 2) / h; // 0..1
    const zFactor = 1.04 - Math.pow(ny, 1.35) * 0.56;
    const xFactor = 1.0 - ny * 0.04;
    pos.setXYZ(i, x * xFactor, y, z * zFactor);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
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

  // ---- HD Sculpted Procedural Supermarket Product Models (41 distinct shapes across all 10 departments) ----

  // === 1. BEVERAGES (BEV) ===
  {
    rel: "products/beverages/soda-can.glb",
    root: "Product_Soda_Can",
    parts: [
      {
        name: "Can_Body",
        geometry: latheProfile([
          [0.025, 0.0],
          [0.0325, 0.008],
          [0.033, 0.108],
          [0.029, 0.121],
          [0.027, 0.122],
        ], 32),
        position: [0, 0, 0],
        material: { name: "CanRed", color: "#dc2626", metallic: 0.76, roughness: 0.2 },
      },
      { name: "Can_Top_Dome", geometry: cyl(0.027, 0.027, 0.003, 28), position: [0, 0.121, 0], material: { name: "CanSilver", color: "#dbe4ee", metallic: 0.92, roughness: 0.16 } },
      { name: "Can_Rim", geometry: torus(0.028, 0.0022, 10, 28), position: [0, 0.1235, 0], rotation: [Math.PI / 2, 0, 0], material: { name: "CanSilver", color: "#e2e8f0", metallic: 0.94, roughness: 0.14 } },
      { name: "Pull_Tab", geometry: box(0.011, 0.0028, 0.021), position: [0, 0.1255, 0.004], material: { name: "CanSilver", color: "#cbd5e1", metallic: 0.9, roughness: 0.18 } },
    ],
  },
  {
    rel: "products/beverages/energy-can.glb",
    root: "Product_Energy_Can",
    parts: [
      {
        name: "Slim_Can_Body",
        geometry: latheProfile([
          [0.021, 0.0],
          [0.0265, 0.009],
          [0.0265, 0.145],
          [0.0225, 0.158],
          [0.021, 0.159],
        ], 32),
        position: [0, 0, 0],
        material: { name: "EnergyNavy", color: "#0f172a", metallic: 0.82, roughness: 0.18 },
      },
      { name: "Slim_Rim", geometry: torus(0.022, 0.002, 10, 28), position: [0, 0.16, 0], rotation: [Math.PI / 2, 0, 0], material: { name: "CanSilver", color: "#e2e8f0", metallic: 0.94, roughness: 0.14 } },
      { name: "Slim_Pull_Tab", geometry: box(0.0095, 0.0025, 0.017), position: [0, 0.1615, 0.003], material: { name: "NeonLime", color: "#84cc16", metallic: 0.72, roughness: 0.25 } },
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
          [0.046, 0.068],
          [0.0415, 0.092],
          [0.046, 0.118],
          [0.046, 0.175],
          [0.042, 0.205],
          [0.023, 0.246],
          [0.016, 0.278],
          [0.0155, 0.292],
        ], 32),
        position: [0, 0, 0],
        material: { name: "DarkSoda", color: "#2e1209", roughness: 0.1, metallic: 0.06 },
      },
      { name: "Bottle_Neck_Collar", geometry: cyl(0.019, 0.019, 0.008, 24), position: [0, 0.286, 0], material: { name: "CapRed", color: "#dc2626", roughness: 0.38 } },
      { name: "Bottle_Cap", geometry: cyl(0.0178, 0.0178, 0.021, 24), position: [0, 0.302, 0], material: { name: "CapRed", color: "#dc2626", roughness: 0.4 } },
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
          [0.042, 0.056],
          [0.0392, 0.064],
          [0.042, 0.072],
          [0.0392, 0.082],
          [0.042, 0.092],
          [0.042, 0.184],
          [0.036, 0.215],
          [0.018, 0.252],
          [0.015, 0.27],
        ], 32),
        position: [0, 0, 0],
        material: { name: "AquaPET", color: "#cdeefe", alpha: 0.72, roughness: 0.06, metallic: 0.05 },
      },
      { name: "Water_Collar", geometry: cyl(0.0175, 0.0175, 0.006, 22), position: [0, 0.268, 0], material: { name: "CapBlue", color: "#0284c7", roughness: 0.36 } },
      { name: "Water_Cap", geometry: cyl(0.0165, 0.0165, 0.019, 24), position: [0, 0.28, 0], material: { name: "CapBlue", color: "#0369a1", roughness: 0.38 } },
    ],
  },
  {
    rel: "products/beverages/juice-carton.glb",
    root: "Product_Juice_Carton",
    parts: [
      { name: "Carton_Box", geometry: box(0.076, 0.195, 0.076), position: [0, 0.0975, 0], material: { name: "JuiceOrange", color: "#f97316", roughness: 0.4 } },
      { name: "Carton_Sloped_Top", geometry: box(0.075, 0.022, 0.078), position: [0, 0.203, 0], rotation: [0.18, 0, 0], material: { name: "JuiceTop", color: "#fb923c", roughness: 0.38 } },
      { name: "Spout_Collar", geometry: cyl(0.0135, 0.0145, 0.008, 18), position: [0.015, 0.214, 0.016], rotation: [0.18, 0, 0], material: { name: "WhiteCap", color: "#f8fafc", roughness: 0.32 } },
      { name: "Spout_Cap", geometry: cyl(0.0125, 0.0125, 0.016, 18), position: [0.015, 0.223, 0.018], rotation: [0.18, 0, 0], material: { name: "WhiteCap", color: "#ffffff", roughness: 0.32 } },
    ],
  },
  {
    rel: "products/beverages/glass-bottle.glb",
    root: "Product_Glass_Bottle",
    parts: [
      {
        name: "Glass_Body",
        geometry: latheProfile([
          [0.032, 0.0],
          [0.037, 0.012],
          [0.037, 0.145],
          [0.033, 0.175],
          [0.017, 0.215],
          [0.0135, 0.268],
          [0.015, 0.282],
          [0.0135, 0.288],
        ], 32),
        position: [0, 0, 0],
        material: { name: "EmeraldGlass", color: "#14532d", alpha: 0.86, roughness: 0.08, metallic: 0.08 },
      },
      { name: "Neck_Foil", geometry: cyl(0.0142, 0.0158, 0.044, 24), position: [0, 0.258, 0], material: { name: "GoldFoil", color: "#eab308", metallic: 0.78, roughness: 0.25 } },
      { name: "Crown_Cap", geometry: cyl(0.0155, 0.0165, 0.011, 20), position: [0, 0.292, 0], material: { name: "GoldFoil", color: "#facc15", metallic: 0.85, roughness: 0.2 } },
    ],
  },

  // === 2. GROCERIES (GRO) ===
  {
    rel: "products/groceries/rice-bag.glb",
    root: "Product_Rice_Bag",
    parts: [
      { name: "Sack_Body", geometry: pillowSackGeom(0.24, 0.31, 0.13), position: [0, 0.155, 0], material: { name: "WovenSack", color: "#f5f0e1", roughness: 0.84 } },
      { name: "Sack_Bottom_Seam", geometry: box(0.225, 0.012, 0.046), position: [0, 0.006, 0], material: { name: "SackCrimp", color: "#e5dac0", roughness: 0.88 } },
      { name: "Sack_Top_Crimp", geometry: box(0.22, 0.028, 0.032), position: [0, 0.316, 0], material: { name: "SackCrimp", color: "#e9e0ca", roughness: 0.88 } },
      { name: "Stitch_Thread", geometry: box(0.224, 0.006, 0.035), position: [0, 0.31, 0], material: { name: "RiceGreen", color: "#15803d", roughness: 0.65 } },
    ],
  },
  {
    rel: "products/groceries/flour-bag.glb",
    root: "Product_Flour_Bag",
    parts: [
      { name: "Flour_Paper", geometry: taperedKraftBagGeom(0.16, 0.23, 0.105), position: [0, 0.115, 0], material: { name: "KraftPaper", color: "#fef3c7", roughness: 0.86 } },
      { name: "Flour_Fold_Top", geometry: box(0.156, 0.022, 0.044), position: [0, 0.234, 0], material: { name: "KraftFold", color: "#fde68a", roughness: 0.88 } },
      { name: "Kraft_Tape_Seal", geometry: box(0.158, 0.011, 0.047), position: [0, 0.244, 0], material: { name: "WheatGold", color: "#d97706", roughness: 0.65 } },
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
          [0.058, 0.195],
          [0.054, 0.215],
          [0.058, 0.225],
          [0.048, 0.25],
          [0.024, 0.284],
          [0.020, 0.306],
        ], 32),
        position: [0, 0, 0],
        material: { name: "GoldenOil", color: "#eab308", alpha: 0.86, roughness: 0.1, metallic: 0.04 },
      },
      // Real curved ergonomic D-handle on +X side
      {
        name: "Oil_Curved_Handle",
        geometry: curvedTube([
          [0.042, 0.252, 0],
          [0.082, 0.232, 0],
          [0.086, 0.175, 0],
          [0.080, 0.125, 0],
          [0.054, 0.105, 0],
        ], 0.011, 18, 12),
        position: [0, 0, 0],
        material: { name: "GoldenOilHandle", color: "#facc15", alpha: 0.86, roughness: 0.14 },
      },
      { name: "Oil_Neck_Ring", geometry: cyl(0.0235, 0.0235, 0.008, 22), position: [0, 0.304, 0], material: { name: "CapGreen", color: "#15803d", roughness: 0.36 } },
      { name: "Oil_Cap", geometry: cyl(0.022, 0.022, 0.022, 24), position: [0, 0.318, 0], material: { name: "CapGreen", color: "#16a34a", roughness: 0.36 } },
    ],
  },
  {
    rel: "products/groceries/cereal-box.glb",
    root: "Product_Cereal_Box",
    parts: [
      { name: "Cereal_Carton", geometry: box(0.2, 0.29, 0.068), position: [0, 0.145, 0], material: { name: "CerealAmber", color: "#f59e0b", roughness: 0.44 } },
      { name: "Cereal_Top_Flap", geometry: box(0.196, 0.006, 0.064), position: [0, 0.292, 0], material: { name: "CerealTeal", color: "#0f766e", roughness: 0.42 } },
    ],
  },
  {
    rel: "products/groceries/biscuits-pack.glb",
    root: "Product_Biscuits_Pack",
    parts: [
      // Rounded horizontal cylindrical biscuit roll pack with serrated fin-seal ends
      { name: "Biscuit_Roll", geometry: cyl(0.036, 0.036, 0.175, 28), position: [0, 0.036, 0], rotation: [0, 0, Math.PI / 2], scale: [1, 1, 1.08], material: { name: "BiscuitBlue", color: "#2563eb", roughness: 0.32 } },
      { name: "Crimp_L", geometry: box(0.018, 0.056, 0.008), position: [-0.095, 0.036, 0], material: { name: "BiscuitEdge", color: "#1d4ed8", roughness: 0.38 } },
      { name: "Crimp_R", geometry: box(0.018, 0.056, 0.008), position: [0.095, 0.036, 0], material: { name: "BiscuitEdge", color: "#1d4ed8", roughness: 0.38 } },
    ],
  },
  {
    rel: "products/groceries/canned-food.glb",
    root: "Product_Canned_Food",
    parts: [
      {
        name: "Tin_Can",
        geometry: latheProfile([
          [0.041, 0.0],
          [0.0435, 0.004],
          [0.042, 0.009],
          [0.042, 0.032],
          [0.0432, 0.036],
          [0.042, 0.040],
          [0.042, 0.054],
          [0.0432, 0.058],
          [0.042, 0.062],
          [0.042, 0.076],
          [0.0432, 0.080],
          [0.042, 0.084],
          [0.042, 0.106],
          [0.0435, 0.111],
          [0.041, 0.114],
        ], 32),
        position: [0, 0, 0],
        material: { name: "TinMetal", color: "#cbd5e1", metallic: 0.88, roughness: 0.2 },
      },
      { name: "Tin_Lid", geometry: cyl(0.0405, 0.0405, 0.003, 28), position: [0, 0.112, 0], material: { name: "TinLid", color: "#e2e8f0", metallic: 0.92, roughness: 0.18 } },
      { name: "Ring_Pull", geometry: torus(0.0085, 0.002, 8, 18), position: [0, 0.1155, 0.014], rotation: [Math.PI / 2, 0, 0], material: { name: "TinLid", color: "#94a3b8", metallic: 0.92, roughness: 0.2 } },
    ],
  },
  {
    rel: "products/groceries/glass-jar.glb",
    root: "Product_Glass_Jar",
    parts: [
      {
        name: "Jar_Glass_Outer",
        geometry: latheProfile([
          [0.038, 0.0],
          [0.046, 0.012],
          [0.046, 0.098],
          [0.042, 0.116],
          [0.036, 0.126],
          [0.036, 0.136],
        ], 32),
        position: [0, 0, 0],
        material: { name: "ClearGlass", color: "#f8fafc", alpha: 0.42, roughness: 0.08, metallic: 0.06 },
      },
      { name: "Jar_Inner_Preserve", geometry: cyl(0.041, 0.041, 0.096, 28), position: [0, 0.056, 0], material: { name: "BerryJam", color: "#b91c1c", roughness: 0.28 } },
      { name: "Jar_Twist_Lid", geometry: cyl(0.0385, 0.0385, 0.016, 28), position: [0, 0.142, 0], material: { name: "GoldLugLid", color: "#d97706", metallic: 0.72, roughness: 0.24 } },
    ],
  },
  {
    rel: "products/groceries/snack-pouch.glb",
    root: "Product_Snack_Pouch",
    parts: [
      { name: "Doypack_Body", geometry: standupPouchGeom(0.165, 0.235, 0.088), position: [0, 0.1175, 0], material: { name: "PouchFoil", color: "#dc2626", roughness: 0.34, metallic: 0.18 } },
      { name: "Zip_Header_Band", geometry: box(0.154, 0.016, 0.014), position: [0, 0.226, 0], material: { name: "PouchSeal", color: "#991b1b", roughness: 0.32, metallic: 0.24 } },
    ],
  },

  // === 3. FRUITS & VEGETABLES (PRO) ===
  {
    rel: "products/produce/fruit-basket.glb",
    root: "Product_Fruit_Basket",
    parts: [
      // Warm woven/slatted produce display punnet
      { name: "Basket_Base", geometry: box(0.22, 0.016, 0.17), position: [0, 0.008, 0], material: { name: "WarmOak", color: "#b68049", roughness: 0.72 } },
      { name: "Basket_Front", geometry: box(0.224, 0.072, 0.012), position: [0, 0.044, 0.082], material: { name: "WarmOak", color: "#c28e56", roughness: 0.68 } },
      { name: "Basket_Back", geometry: box(0.224, 0.072, 0.012), position: [0, 0.044, -0.082], material: { name: "WarmOak", color: "#c28e56", roughness: 0.68 } },
      { name: "Basket_Left", geometry: box(0.012, 0.072, 0.17), position: [-0.106, 0.044, 0], material: { name: "WarmOakDark", color: "#a46d39", roughness: 0.72 } },
      { name: "Basket_Right", geometry: box(0.012, 0.072, 0.17), position: [0.106, 0.044, 0], material: { name: "WarmOakDark", color: "#a46d39", roughness: 0.72 } },
      // 6 sculpted glossy 3D fruits mounded naturally inside the basket
      { name: "Fruit_01", geometry: sphere(0.036, 20, 14), position: [-0.056, 0.082, 0.032], scale: [1.0, 0.94, 1.0], material: { name: "AppleRed", color: "#dc2626", roughness: 0.22 } },
      { name: "Fruit_02", geometry: sphere(0.036, 20, 14), position: [0.006, 0.084, 0.036], scale: [1.02, 0.94, 1.0], material: { name: "OrangeBright", color: "#f97316", roughness: 0.36 } },
      { name: "Fruit_03", geometry: sphere(0.035, 20, 14), position: [0.062, 0.081, 0.028], scale: [1.0, 0.95, 1.0], material: { name: "AppleGreen", color: "#65a30d", roughness: 0.24 } },
      { name: "Fruit_04", geometry: sphere(0.035, 20, 14), position: [-0.048, 0.082, -0.032], scale: [1.0, 0.96, 1.0], material: { name: "MangoGold", color: "#eab308", roughness: 0.26 } },
      { name: "Fruit_05", geometry: sphere(0.036, 20, 14), position: [0.016, 0.084, -0.034], scale: [1.0, 0.94, 1.0], material: { name: "AppleRed", color: "#b91c1c", roughness: 0.22 } },
      { name: "Fruit_06", geometry: sphere(0.035, 20, 14), position: [0.066, 0.08, -0.028], scale: [1.0, 0.94, 1.0], material: { name: "OrangeBright", color: "#ea580c", roughness: 0.34 } },
      // Top pyramid hero fruits + stems & green leaves
      { name: "Fruit_Top_L", geometry: sphere(0.035, 20, 14), position: [-0.024, 0.126, 0.0], scale: [1.0, 0.94, 1.0], material: { name: "AppleRed", color: "#ef4444", roughness: 0.2 } },
      { name: "Fruit_Top_R", geometry: sphere(0.035, 20, 14), position: [0.036, 0.124, -0.004], scale: [1.02, 0.95, 1.0], material: { name: "MangoGold", color: "#f59e0b", roughness: 0.25 } },
      { name: "Stem_01", geometry: cyl(0.0025, 0.003, 0.016, 8), position: [-0.024, 0.162, 0.0], rotation: [0.15, 0, 0.2], material: { name: "StemWood", color: "#573a20", roughness: 0.85 } },
      { name: "Leaf_01", geometry: sphere(0.016, 12, 8), position: [-0.012, 0.164, 0.006], scale: [1.3, 0.22, 0.65], rotation: [0.2, 0.4, -0.3], material: { name: "FreshLeaf", color: "#16a34a", roughness: 0.45 } },
    ],
  },
  {
    rel: "products/produce/vegetable-crate.glb",
    root: "Product_Vegetable_Crate",
    parts: [
      // Market green & natural wood produce crate
      { name: "Crate_Base", geometry: box(0.23, 0.016, 0.175), position: [0, 0.008, 0], material: { name: "CrateGreen", color: "#15803d", roughness: 0.58 } },
      { name: "Crate_Front", geometry: box(0.234, 0.072, 0.012), position: [0, 0.044, 0.084], material: { name: "CrateGreen", color: "#166534", roughness: 0.55 } },
      { name: "Crate_Back", geometry: box(0.234, 0.072, 0.012), position: [0, 0.044, -0.084], material: { name: "CrateGreen", color: "#166534", roughness: 0.55 } },
      { name: "Crate_Left", geometry: box(0.012, 0.072, 0.175), position: [-0.112, 0.044, 0], material: { name: "CrateGreen", color: "#14532d", roughness: 0.58 } },
      { name: "Crate_Right", geometry: box(0.012, 0.072, 0.175), position: [0.112, 0.044, 0], material: { name: "CrateGreen", color: "#14532d", roughness: 0.58 } },
      // Sculpted vegetables: vine tomatoes, red onions, bell peppers & crisp greens
      { name: "Tomato_01", geometry: sphere(0.032, 18, 14), position: [-0.065, 0.08, 0.032], scale: [1.05, 0.85, 1.05], material: { name: "TomatoRed", color: "#dc2626", roughness: 0.2 } },
      { name: "Tomato_02", geometry: sphere(0.031, 18, 14), position: [-0.008, 0.082, 0.038], scale: [1.05, 0.86, 1.05], material: { name: "TomatoRed", color: "#ef4444", roughness: 0.2 } },
      { name: "Pepper_Green", geometry: cyl(0.025, 0.022, 0.068, 16), position: [0.056, 0.095, 0.026], rotation: [0.2, 0.2, -0.35], material: { name: "BellGreen", color: "#16a34a", roughness: 0.24 } },
      { name: "Onion_Red_01", geometry: sphere(0.032, 18, 14), position: [-0.054, 0.082, -0.032], scale: [1.0, 0.9, 1.0], material: { name: "RedOnion", color: "#881337", roughness: 0.42 } },
      { name: "Pepper_Yellow", geometry: cyl(0.025, 0.022, 0.068, 16), position: [0.012, 0.098, -0.028], rotation: [-0.15, 0, 0.28], material: { name: "BellYellow", color: "#eab308", roughness: 0.24 } },
      { name: "Cabbage_Leaf", geometry: sphere(0.04, 18, 14), position: [0.064, 0.088, -0.03], scale: [1.08, 0.92, 1.02], material: { name: "CabbageGreen", color: "#4ade80", roughness: 0.48 } },
      { name: "Tomato_Top", geometry: sphere(0.031, 18, 14), position: [-0.032, 0.12, 0.0], scale: [1.05, 0.85, 1.05], material: { name: "TomatoRed", color: "#dc2626", roughness: 0.18 } },
    ],
  },
  {
    rel: "products/produce/banana-bunch.glb",
    root: "Product_Banana_Bunch",
    parts: [
      // Shallow natural produce display tray
      { name: "Produce_Tray", geometry: box(0.22, 0.044, 0.15), position: [0, 0.022, 0], material: { name: "KraftTray", color: "#15803d", roughness: 0.62 } },
      // Crown stem binding all 5 curved bananas together
      { name: "Banana_Crown", geometry: cyl(0.016, 0.022, 0.028, 14), position: [-0.068, 0.132, 0], rotation: [0, 0, 0.52], material: { name: "CrownGreen", color: "#65a30d", roughness: 0.68 } },
      // 5 real curved tapered yellow bananas fanned naturally in a hand
      { name: "Banana_01", geometry: taperedBanana([[-0.062, 0.125, -0.042], [-0.01, 0.132, -0.046], [0.048, 0.104, -0.042], [0.084, 0.056, -0.034]], 0.015), material: { name: "BananaYellow", color: "#facc15", roughness: 0.34 } },
      { name: "Banana_02", geometry: taperedBanana([[-0.064, 0.128, -0.02], [-0.008, 0.138, -0.022], [0.052, 0.108, -0.02], [0.088, 0.058, -0.016]], 0.0155), material: { name: "BananaYellow", color: "#fde047", roughness: 0.32 } },
      { name: "Banana_03", geometry: taperedBanana([[-0.065, 0.13, 0.002], [-0.006, 0.142, 0.002], [0.055, 0.112, 0.003], [0.092, 0.06, 0.004]], 0.016), material: { name: "BananaYellow", color: "#facc15", roughness: 0.34 } },
      { name: "Banana_04", geometry: taperedBanana([[-0.064, 0.128, 0.024], [-0.008, 0.138, 0.026], [0.052, 0.108, 0.025], [0.088, 0.058, 0.022]], 0.0155), material: { name: "BananaYellow", color: "#eab308", roughness: 0.36 } },
      { name: "Banana_05", geometry: taperedBanana([[-0.062, 0.124, 0.044], [-0.01, 0.13, 0.048], [0.048, 0.102, 0.044], [0.082, 0.056, 0.038]], 0.0148), material: { name: "BananaYellow", color: "#facc15", roughness: 0.34 } },
      { name: "Tip_03", geometry: sphere(0.0055, 10, 8), position: [0.093, 0.056, 0.004], material: { name: "BananaTip", color: "#451a03", roughness: 0.85 } },
    ],
  },

  // === 4. DAIRY PRODUCTS (DAI) ===
  {
    rel: "products/dairy/milk-carton.glb",
    root: "Product_Milk_Carton",
    parts: [
      { name: "Carton_Body", geometry: box(0.074, 0.175, 0.074), position: [0, 0.0875, 0], material: { name: "MilkWhite", color: "#f8fafc", roughness: 0.38 } },
      { name: "Gable_Roof_Front", geometry: box(0.074, 0.042, 0.048), position: [0, 0.186, 0.016], rotation: [-0.55, 0, 0], material: { name: "MilkWhite", color: "#f1f5f9", roughness: 0.38 } },
      { name: "Gable_Roof_Back", geometry: box(0.074, 0.042, 0.048), position: [0, 0.186, -0.016], rotation: [0.55, 0, 0], material: { name: "MilkWhite", color: "#f1f5f9", roughness: 0.38 } },
      { name: "Gable_Ridge", geometry: box(0.074, 0.016, 0.008), position: [0, 0.212, 0], material: { name: "DairyBlue", color: "#0284c7", roughness: 0.36 } },
      { name: "Milk_Cap", geometry: cyl(0.0115, 0.0115, 0.014, 18), position: [0.016, 0.194, 0.022], rotation: [0.52, 0, 0], material: { name: "DairyBlue", color: "#0369a1", roughness: 0.34 } },
    ],
  },
  {
    rel: "products/dairy/yogurt-cup.glb",
    root: "Product_Yogurt_Cup",
    parts: [
      {
        name: "Cup_Body",
        geometry: latheProfile([
          [0.028, 0.0],
          [0.032, 0.006],
          [0.043, 0.092],
          [0.0465, 0.095],
          [0.0465, 0.102],
          [0.043, 0.102],
        ], 32),
        position: [0, 0, 0],
        material: { name: "YogurtWhite", color: "#f8fafc", roughness: 0.24 },
      },
      { name: "Foil_Lid", geometry: cyl(0.046, 0.046, 0.003, 32), position: [0, 0.1035, 0], material: { name: "FoilSilver", color: "#e2e8f0", metallic: 0.78, roughness: 0.2 } },
      { name: "Peel_Tab", geometry: box(0.016, 0.0025, 0.018), position: [0.046, 0.103, 0], rotation: [0, 0, -0.15], material: { name: "FoilSilver", color: "#cbd5e1", metallic: 0.82, roughness: 0.2 } },
    ],
  },
  {
    rel: "products/dairy/butter-tub.glb",
    root: "Product_Butter_Tub",
    parts: [
      { name: "Tub_Lower", geometry: extrudeShape(roundedRectShape(0.142, 0.096, 0.028), 0.052, true), position: [0, 0.028, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "ButterGold", color: "#facc15", roughness: 0.28 } },
      { name: "Tub_Lid", geometry: extrudeShape(roundedRectShape(0.154, 0.108, 0.032), 0.014, true), position: [0, 0.058, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "ButterLid", color: "#fef08a", roughness: 0.24 } },
    ],
  },
  {
    rel: "products/dairy/cheese-wedge.glb",
    root: "Product_Cheese_Wedge",
    parts: [
      { name: "Cheese_Base_Tray", geometry: box(0.175, 0.014, 0.125), position: [0, 0.007, 0], material: { name: "ChillerWhite", color: "#f8fafc", roughness: 0.34 } },
      { name: "Cheese_Triangular_Wedge", geometry: cheeseWedgeGeom(0.155, 0.072, Math.PI * 0.36), position: [0, 0.014, 0.015], material: { name: "CheddarGold", color: "#f59e0b", roughness: 0.44 } },
      { name: "Cheese_Wax_Rind", geometry: cheeseWedgeRindGeom(0.155, 0.072, Math.PI * 0.36), position: [0, 0.014, 0.015], material: { name: "WaxRed", color: "#b91c1c", roughness: 0.3 } },
      // Decorative dimples on wedge face
      { name: "Swiss_Dimple_01", geometry: sphere(0.01, 12, 10), position: [-0.01, 0.056, 0.042], material: { name: "CheddarDeep", color: "#d97706", roughness: 0.5 } },
      { name: "Swiss_Dimple_02", geometry: sphere(0.008, 12, 10), position: [0.025, 0.042, 0.035], material: { name: "CheddarDeep", color: "#d97706", roughness: 0.5 } },
    ],
  },
  {
    rel: "products/dairy/egg-carton.glb",
    root: "Product_Egg_Carton",
    parts: [
      // Molded pulp base tray
      { name: "Pulp_Base", geometry: box(0.21, 0.032, 0.14), position: [0, 0.016, 0], material: { name: "MoldedPulp", color: "#d6c5a7", roughness: 0.92 } },
      // 6 visible oval 3D eggs nestled in the tray cups
      { name: "Egg_01", geometry: sphere(0.024, 16, 14), position: [-0.062, 0.044, -0.03], scale: [0.88, 1.22, 0.88], material: { name: "EggShellBrown", color: "#d9a06c", roughness: 0.55 } },
      { name: "Egg_02", geometry: sphere(0.024, 16, 14), position: [0.0, 0.044, -0.03], scale: [0.88, 1.22, 0.88], material: { name: "EggShellBrown", color: "#e0ab76", roughness: 0.55 } },
      { name: "Egg_03", geometry: sphere(0.024, 16, 14), position: [0.062, 0.044, -0.03], scale: [0.88, 1.22, 0.88], material: { name: "EggShellBrown", color: "#d9a06c", roughness: 0.55 } },
      { name: "Egg_04", geometry: sphere(0.024, 16, 14), position: [-0.062, 0.044, 0.03], scale: [0.88, 1.22, 0.88], material: { name: "EggShellBrown", color: "#e5b583", roughness: 0.55 } },
      { name: "Egg_05", geometry: sphere(0.024, 16, 14), position: [0.0, 0.044, 0.03], scale: [0.88, 1.22, 0.88], material: { name: "EggShellBrown", color: "#d9a06c", roughness: 0.55 } },
      { name: "Egg_06", geometry: sphere(0.024, 16, 14), position: [0.062, 0.044, 0.03], scale: [0.88, 1.22, 0.88], material: { name: "EggShellBrown", color: "#e0ab76", roughness: 0.55 } },
      // Molded top half-lid with side vents so the eggs remain visibly nestled inside
      { name: "Pulp_Lid_Top", geometry: box(0.206, 0.022, 0.132), position: [0, 0.072, 0], material: { name: "MoldedPulpTop", color: "#cbb795", roughness: 0.9 } },
      { name: "Pulp_Front_Latch", geometry: box(0.18, 0.024, 0.012), position: [0, 0.048, 0.068], material: { name: "MoldedPulp", color: "#d6c5a7", roughness: 0.9 } },
    ],
  },

  // === 5. FROZEN FOODS (FRZ) ===
  {
    rel: "products/frozen/ice-cream-tub.glb",
    root: "Product_Ice_Cream_Tub",
    parts: [
      {
        name: "Tub_Body",
        geometry: latheProfile([
          [0.042, 0.0],
          [0.046, 0.008],
          [0.056, 0.118],
          [0.059, 0.122],
          [0.059, 0.13],
        ], 32),
        position: [0, 0, 0],
        material: { name: "CreamTub", color: "#e0f2fe", roughness: 0.3 },
      },
      { name: "Snap_Lid_Rim", geometry: cyl(0.061, 0.06, 0.016, 32), position: [0, 0.132, 0], material: { name: "IceCyan", color: "#0284c7", roughness: 0.26 } },
      { name: "Snap_Lid_Crown", geometry: cyl(0.055, 0.058, 0.008, 32), position: [0, 0.142, 0], material: { name: "IceLight", color: "#bae6fd", roughness: 0.24 } },
    ],
  },
  {
    rel: "products/dairy/frozen-pack.glb",
    root: "Product_Frozen_Pack",
    parts: [
      { name: "Frozen_Tray", geometry: extrudeShape(roundedRectShape(0.22, 0.16, 0.022), 0.048, true), position: [0, 0.026, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "IceBlue", color: "#0369a1", roughness: 0.3 } },
      { name: "Frozen_Rim", geometry: extrudeShape(roundedRectShape(0.23, 0.17, 0.025), 0.01, true), position: [0, 0.052, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "FrostWhite", color: "#e0f2fe", roughness: 0.26 } },
      { name: "Frost_Window", geometry: box(0.18, 0.012, 0.12), position: [0, 0.056, 0], material: { name: "FrostFilm", color: "#bae6fd", alpha: 0.55, roughness: 0.14 } },
    ],
  },

  // === 6. BAKERY (BAK) ===
  {
    rel: "products/bakery/bread-loaf.glb",
    root: "Product_Bread_Loaf",
    parts: [
      // Golden domed artisanal bread loaf
      { name: "Loaf_Body", geometry: breadLoafGeom(0.235, 0.125, 0.115), position: [0, 0.004, 0], material: { name: "GoldenCrust", color: "#c2782e", roughness: 0.78 } },
      // Three diagonal artisan flour-dusted crust score lines on top dome
      { name: "Crust_Score_01", geometry: box(0.014, 0.008, 0.068), position: [-0.06, 0.124, 0], rotation: [0, 0.38, 0], material: { name: "FlourDust", color: "#f5deb3", roughness: 0.9 } },
      { name: "Crust_Score_02", geometry: box(0.014, 0.008, 0.068), position: [0.0, 0.126, 0], rotation: [0, 0.38, 0], material: { name: "FlourDust", color: "#f5deb3", roughness: 0.9 } },
      { name: "Crust_Score_03", geometry: box(0.014, 0.008, 0.068), position: [0.06, 0.124, 0], rotation: [0, 0.38, 0], material: { name: "FlourDust", color: "#f5deb3", roughness: 0.9 } },
      // Clear crisp bakery sleeve ends
      { name: "Clear_Bread_Bag", geometry: breadLoafGeom(0.25, 0.132, 0.122), position: [0, 0.002, 0], material: { name: "ClearWrap", color: "#ffffff", alpha: 0.18, roughness: 0.14 } },
    ],
  },
  {
    rel: "products/bakery/pastry-box.glb",
    root: "Product_Pastry_Box",
    parts: [
      // Dark bakery base tray
      { name: "Clamshell_Base", geometry: box(0.22, 0.022, 0.155), position: [0, 0.011, 0], material: { name: "BakeryBrown", color: "#451a03", roughness: 0.5 } },
      // 3 sculpted golden curved croissants inside
      { name: "Croissant_01", geometry: taperedBanana([[-0.075, 0.036, 0.032], [-0.068, 0.056, 0.0], [-0.075, 0.036, -0.032]], 0.022), material: { name: "PastryGold", color: "#d97706", roughness: 0.62 } },
      { name: "Croissant_02", geometry: taperedBanana([[-0.008, 0.036, 0.034], [0.0, 0.058, 0.0], [-0.008, 0.036, -0.034]], 0.023), material: { name: "PastryGold", color: "#ea580c", roughness: 0.6 } },
      { name: "Croissant_03", geometry: taperedBanana([[0.062, 0.036, 0.032], [0.072, 0.056, 0.0], [0.062, 0.036, -0.032]], 0.022), material: { name: "PastryGold", color: "#d97706", roughness: 0.62 } },
      // Translucent clear hinged clamshell dome cover
      { name: "Clamshell_Dome", geometry: extrudeShape(roundedRectShape(0.214, 0.148, 0.022), 0.066, true), position: [0, 0.056, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "ClamshellPET", color: "#f8fafc", alpha: 0.32, roughness: 0.08 } },
    ],
  },
  {
    rel: "products/bakery/cake-dome.glb",
    root: "Product_Cake_Dome",
    parts: [
      // Gold cake board base
      { name: "Cake_Board", geometry: cyl(0.118, 0.122, 0.014, 36), position: [0, 0.007, 0], material: { name: "CakeGold", color: "#ca8a04", metallic: 0.55, roughness: 0.32 } },
      // Frosted layered round sponge cake
      { name: "Cake_Sponge", geometry: cyl(0.094, 0.096, 0.076, 32), position: [0, 0.052, 0], material: { name: "CreamFrosting", color: "#fff7ed", roughness: 0.55 } },
      { name: "Chocolate_Ganache_Top", geometry: cyl(0.095, 0.095, 0.014, 32), position: [0, 0.092, 0], material: { name: "ChocolateRich", color: "#5c2d16", roughness: 0.34 } },
      // Decorative cream rosettes & berries around top edge
      { name: "Berry_01", geometry: sphere(0.011, 12, 10), position: [0.056, 0.104, 0.0], material: { name: "StrawberryRed", color: "#dc2626", roughness: 0.25 } },
      { name: "Berry_02", geometry: sphere(0.011, 12, 10), position: [-0.056, 0.104, 0.0], material: { name: "StrawberryRed", color: "#dc2626", roughness: 0.25 } },
      { name: "Berry_03", geometry: sphere(0.011, 12, 10), position: [0.0, 0.104, 0.056], material: { name: "StrawberryRed", color: "#dc2626", roughness: 0.25 } },
      { name: "Berry_04", geometry: sphere(0.011, 12, 10), position: [0.0, 0.104, -0.056], material: { name: "StrawberryRed", color: "#dc2626", roughness: 0.25 } },
      { name: "Center_Rose", geometry: sphere(0.016, 14, 12), position: [0, 0.106, 0], material: { name: "RoseCream", color: "#fbcfe8", roughness: 0.45 } },
      // Crystal-clear cylindrical bakery cake dome
      { name: "Clear_Dome", geometry: cyl(0.108, 0.114, 0.118, 32), position: [0, 0.074, 0], material: { name: "ClamshellPET", color: "#f8fafc", alpha: 0.26, roughness: 0.06 } },
    ],
  },

  // === 7. MEAT & FISH (MEA) ===
  {
    rel: "products/meat/meat-tray.glb",
    root: "Product_Meat_Tray",
    parts: [
      // Black butcher foam tray + white absorbent pad
      { name: "Butcher_Tray", geometry: extrudeShape(roundedRectShape(0.22, 0.16, 0.022), 0.028, true), position: [0, 0.016, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "ButcherBlack", color: "#1e293b", roughness: 0.48 } },
      { name: "Absorbent_Pad", geometry: box(0.185, 0.004, 0.125), position: [0, 0.031, 0], material: { name: "PadWhite", color: "#f8fafc", roughness: 0.8 } },
      // Sculpted marbled fresh meat steaks / fillets
      { name: "Meat_Cut_01", geometry: sphere(0.052, 20, 14), position: [-0.044, 0.048, 0.006], scale: [1.15, 0.36, 0.88], rotation: [0, 0.25, 0], material: { name: "FreshBeef", color: "#991b1b", roughness: 0.28 } },
      { name: "Meat_Cut_02", geometry: sphere(0.048, 20, 14), position: [0.042, 0.046, -0.01], scale: [1.1, 0.34, 0.86], rotation: [0, -0.3, 0], material: { name: "FreshBeefLight", color: "#b91c1c", roughness: 0.28 } },
      { name: "Marble_Stripe_01", geometry: box(0.058, 0.004, 0.008), position: [-0.044, 0.064, 0.008], rotation: [0, 0.3, 0], material: { name: "Marbling", color: "#fecaca", roughness: 0.35 } },
      { name: "Herb_Sprig", geometry: box(0.032, 0.005, 0.008), position: [-0.01, 0.063, 0.024], rotation: [0, -0.4, 0], material: { name: "RosemaryGreen", color: "#15803d", roughness: 0.65 } },
      // Glossy clear stretch film wrap over top
      { name: "Stretch_Film", geometry: box(0.222, 0.044, 0.162), position: [0, 0.046, 0], material: { name: "ClearWrap", color: "#ffffff", alpha: 0.22, roughness: 0.08 } },
    ],
  },
  {
    rel: "products/meat/fish-tray.glb",
    root: "Product_Fish_Tray",
    parts: [
      // Ice-blue seafood tray
      { name: "Seafood_Tray", geometry: extrudeShape(roundedRectShape(0.23, 0.155, 0.022), 0.028, true), position: [0, 0.016, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "SeafoodBlue", color: "#0369a1", roughness: 0.38 } },
      { name: "Ice_Bed", geometry: box(0.195, 0.006, 0.12), position: [0, 0.032, 0], material: { name: "CrushedIce", color: "#e0f2fe", roughness: 0.22 } },
      // Sculpted streamlined Indian Ocean fish silhouette + salmon/fillet cut + lemon slice
      { name: "Fish_Body", geometry: sphere(0.056, 20, 14), position: [-0.018, 0.049, 0.0], scale: [1.55, 0.32, 0.62], material: { name: "SilverFish", color: "#94a3b8", metallic: 0.45, roughness: 0.22 } },
      { name: "Fish_Tail_Fin", geometry: cheeseWedgeGeom(0.042, 0.008, Math.PI * 0.48), position: [0.062, 0.046, -0.01], rotation: [0, -0.7, 0], material: { name: "SilverFishFin", color: "#64748b", metallic: 0.35, roughness: 0.32 } },
      { name: "Lemon_Slice", geometry: cyl(0.022, 0.022, 0.006, 18), position: [-0.058, 0.068, 0.016], material: { name: "LemonYellow", color: "#fde047", roughness: 0.35 } },
      { name: "Clear_Film", geometry: box(0.232, 0.044, 0.158), position: [0, 0.046, 0], material: { name: "ClearWrap", color: "#f0f9ff", alpha: 0.22, roughness: 0.08 } },
    ],
  },

  // === 8. COSMETICS & PERSONAL CARE (COS) ===
  {
    rel: "products/cosmetics/soap-box.glb",
    root: "Product_Soap_Box",
    parts: [
      { name: "Soap_Carton", geometry: extrudeShape(roundedRectShape(0.096, 0.064, 0.012), 0.038, true), position: [0, 0.022, 0], rotation: [-Math.PI / 2, 0, 0], material: { name: "SoapMint", color: "#2dd4bf", roughness: 0.32 } },
    ],
  },
  {
    rel: "products/cosmetics/toothpaste-box.glb",
    root: "Product_Toothpaste_Box",
    parts: [
      // Sculpted slim toothpaste retail box + raised glossy cap accent
      { name: "Paste_Box", geometry: box(0.175, 0.044, 0.042), position: [0, 0.022, 0], material: { name: "MintWhite", color: "#0d9488", roughness: 0.3 } },
      { name: "Tube_Cap_Hint", geometry: cyl(0.012, 0.012, 0.016, 18), position: [0.092, 0.022, 0], rotation: [0, 0, Math.PI / 2], material: { name: "CleanWhite", color: "#f8fafc", roughness: 0.24 } },
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
          [0.039, 0.016],
          [0.041, 0.142],
          [0.035, 0.196],
          [0.023, 0.215],
        ], 32),
        position: [0, 0, 0],
        scale: [1.16, 1.0, 0.72],
        material: { name: "ShampooRose", color: "#ec4899", roughness: 0.22, metallic: 0.06 },
      },
      { name: "Flip_Cap", geometry: cyl(0.022, 0.024, 0.036, 24), position: [0, 0.231, 0], scale: [1.08, 1.0, 0.78], material: { name: "PearlCap", color: "#f8fafc", roughness: 0.22 } },
      { name: "Cap_Notch", geometry: box(0.014, 0.008, 0.008), position: [0, 0.245, 0.017], material: { name: "RoseAccent", color: "#be185d", roughness: 0.3 } },
    ],
  },
  {
    rel: "products/cosmetics/lotion-pump.glb",
    root: "Product_Lotion_Pump",
    parts: [
      {
        name: "Lotion_Body",
        geometry: latheProfile([
          [0.032, 0.0],
          [0.042, 0.014],
          [0.043, 0.145],
          [0.037, 0.174],
          [0.019, 0.19],
        ], 32),
        position: [0, 0, 0],
        scale: [1.12, 1.0, 0.82],
        material: { name: "LotionIvory", color: "#fdf2f8", roughness: 0.24 },
      },
      { name: "Pump_Collar", geometry: cyl(0.021, 0.022, 0.022, 24), position: [0, 0.198, 0], material: { name: "GoldTrim", color: "#eab308", metallic: 0.75, roughness: 0.24 } },
      { name: "Pump_Stem", geometry: cyl(0.0065, 0.0065, 0.03, 16), position: [0, 0.222, 0], material: { name: "CleanWhite", color: "#ffffff", roughness: 0.25 } },
      { name: "Pump_Head", geometry: cyl(0.013, 0.013, 0.016, 20), position: [0, 0.238, 0], material: { name: "CleanWhite", color: "#f8fafc", roughness: 0.22 } },
      // Iconic curved pump dispenser spout pointing to +X
      {
        name: "Pump_Spout",
        geometry: curvedTube([
          [0.0, 0.239, 0],
          [0.028, 0.24, 0],
          [0.048, 0.232, 0],
        ], 0.0048, 12, 10),
        material: { name: "CleanWhite", color: "#ffffff", roughness: 0.22 },
      },
    ],
  },
  {
    rel: "products/cosmetics/cream-jar.glb",
    root: "Product_Cream_Jar",
    parts: [
      {
        name: "Jar_Body",
        geometry: latheProfile([
          [0.042, 0.0],
          [0.048, 0.008],
          [0.050, 0.056],
          [0.045, 0.062],
        ], 32),
        position: [0, 0, 0],
        material: { name: "FrostedCream", color: "#fce7f3", roughness: 0.22, metallic: 0.05 },
      },
      { name: "Gold_Band", geometry: cyl(0.0495, 0.0495, 0.006, 32), position: [0, 0.063, 0], material: { name: "RoseGold", color: "#d97706", metallic: 0.85, roughness: 0.18 } },
      { name: "Jar_Lid", geometry: cyl(0.050, 0.050, 0.022, 32), position: [0, 0.076, 0], material: { name: "PearlLid", color: "#ffffff", roughness: 0.16, metallic: 0.12 } },
    ],
  },
  {
    rel: "products/cosmetics/perfume-bottle.glb",
    root: "Product_Perfume_Bottle",
    parts: [
      // Faceted luxury crystal flacon with amber perfume liquid inside
      { name: "Crystal_Flacon", geometry: extrudeShape(roundedRectShape(0.088, 0.112, 0.016), 0.048, true), position: [0, 0.06, 0], material: { name: "CrystalGlass", color: "#f8fafc", alpha: 0.44, roughness: 0.06, metallic: 0.1 } },
      { name: "Perfume_Liquid", geometry: box(0.072, 0.082, 0.034), position: [0, 0.054, 0], material: { name: "AmberEssence", color: "#f59e0b", alpha: 0.78, roughness: 0.1 } },
      { name: "Atomizer_Collar", geometry: cyl(0.015, 0.017, 0.018, 22), position: [0, 0.126, 0], material: { name: "GoldAtomizer", color: "#eab308", metallic: 0.9, roughness: 0.16 } },
      { name: "Crystal_Cap", geometry: box(0.036, 0.034, 0.034), position: [0, 0.152, 0], material: { name: "GoldCap", color: "#1e293b", metallic: 0.4, roughness: 0.14 } },
    ],
  },

  // === 9. HOUSEHOLD PRODUCTS (HSH) ===
  {
    rel: "products/household/detergent-jug.glb",
    root: "Product_Detergent_Jug",
    parts: [
      // Heavy ergonomic laundry detergent bottle body
      { name: "Jug_Body", geometry: extrudeShape(roundedRectShape(0.145, 0.225, 0.03), 0.092, true), position: [-0.016, 0.115, 0], material: { name: "DetergentBlue", color: "#2563eb", roughness: 0.28 } },
      // Angled pouring neck & oversized measuring cap
      { name: "Jug_Shoulder", geometry: cyl(0.028, 0.052, 0.042, 22), position: [-0.036, 0.244, 0], material: { name: "DetergentBlue", color: "#1d4ed8", roughness: 0.28 } },
      { name: "Measuring_Cap", geometry: cyl(0.032, 0.03, 0.044, 24), position: [-0.036, 0.284, 0], material: { name: "CapRed", color: "#ef4444", roughness: 0.3 } },
      // Thick ergonomic side D-handle on +X
      {
        name: "Detergent_D_Handle",
        geometry: curvedTube([
          [0.045, 0.205, 0],
          [0.095, 0.19, 0],
          [0.098, 0.125, 0],
          [0.092, 0.068, 0],
          [0.048, 0.058, 0],
        ], 0.0155, 18, 12),
        material: { name: "DetergentBlue", color: "#2563eb", roughness: 0.28 },
      },
    ],
  },
  {
    rel: "products/household/spray-bottle.glb",
    root: "Product_Spray_Bottle",
    parts: [
      // Contoured waist cleaner bottle
      {
        name: "Spray_Body",
        geometry: latheProfile([
          [0.038, 0.0],
          [0.048, 0.015],
          [0.046, 0.115],
          [0.034, 0.145],
          [0.022, 0.172],
          [0.018, 0.205],
        ], 30),
        position: [0, 0, 0],
        scale: [1.15, 1.0, 0.78],
        material: { name: "CleanerCyan", color: "#0284c7", roughness: 0.24 },
      },
      { name: "Neck_Collar", geometry: cyl(0.021, 0.021, 0.018, 22), position: [0, 0.212, 0], material: { name: "WhiteTrigger", color: "#f8fafc", roughness: 0.28 } },
      // Realistic trigger spray head oriented along +X (front +Z label faces shopper cleanly!)
      { name: "Spray_Head", geometry: box(0.094, 0.032, 0.028), position: [0.022, 0.238, 0], material: { name: "WhiteTrigger", color: "#ffffff", roughness: 0.26 } },
      { name: "Nozzle_Tip", geometry: box(0.018, 0.018, 0.018), position: [0.072, 0.238, 0], material: { name: "NozzleRed", color: "#dc2626", roughness: 0.3 } },
      { name: "Trigger_Lever", geometry: box(0.012, 0.056, 0.012), position: [0.046, 0.204, 0], rotation: [0, 0, 0.34], material: { name: "NozzleRed", color: "#ef4444", roughness: 0.32 } },
    ],
  },
  {
    rel: "products/household/tissue-pack.glb",
    root: "Product_Tissue_Pack",
    parts: [
      // 4 real cylindrical white embossed toilet/kitchen paper rolls bundled in clear poly film
      { name: "Roll_FL", geometry: cyl(0.052, 0.052, 0.105, 26), position: [-0.053, 0.054, 0.053], material: { name: "SoftTissue", color: "#ffffff", roughness: 0.88 } },
      { name: "Roll_FR", geometry: cyl(0.052, 0.052, 0.105, 26), position: [0.053, 0.054, 0.053], material: { name: "SoftTissue", color: "#ffffff", roughness: 0.88 } },
      { name: "Roll_BL", geometry: cyl(0.052, 0.052, 0.105, 26), position: [-0.053, 0.054, -0.053], material: { name: "SoftTissue", color: "#ffffff", roughness: 0.88 } },
      { name: "Roll_BR", geometry: cyl(0.052, 0.052, 0.105, 26), position: [0.053, 0.054, -0.053], material: { name: "SoftTissue", color: "#ffffff", roughness: 0.88 } },
      // Second stacked layer of 4 rolls (classic 8-roll pack silhouette!)
      { name: "Roll_FL_Top", geometry: cyl(0.052, 0.052, 0.105, 26), position: [-0.053, 0.16, 0.053], material: { name: "SoftTissue", color: "#f8fafc", roughness: 0.88 } },
      { name: "Roll_FR_Top", geometry: cyl(0.052, 0.052, 0.105, 26), position: [0.053, 0.16, 0.053], material: { name: "SoftTissue", color: "#f8fafc", roughness: 0.88 } },
      { name: "Roll_BL_Top", geometry: cyl(0.052, 0.052, 0.105, 26), position: [-0.053, 0.16, -0.053], material: { name: "SoftTissue", color: "#f8fafc", roughness: 0.88 } },
      { name: "Roll_BR_Top", geometry: cyl(0.052, 0.052, 0.105, 26), position: [0.053, 0.16, -0.053], material: { name: "SoftTissue", color: "#f8fafc", roughness: 0.88 } },
      // Cardboard inner cores visible on top!
      { name: "Core_FL", geometry: cyl(0.018, 0.018, 0.008, 18), position: [-0.053, 0.212, 0.053], material: { name: "CardboardCore", color: "#92400e", roughness: 0.9 } },
      { name: "Core_FR", geometry: cyl(0.018, 0.018, 0.008, 18), position: [0.053, 0.212, 0.053], material: { name: "CardboardCore", color: "#92400e", roughness: 0.9 } },
      { name: "Core_BL", geometry: cyl(0.018, 0.018, 0.008, 18), position: [-0.053, 0.212, -0.053], material: { name: "CardboardCore", color: "#92400e", roughness: 0.9 } },
      { name: "Core_BR", geometry: cyl(0.018, 0.018, 0.008, 18), position: [0.053, 0.212, -0.053], material: { name: "CardboardCore", color: "#92400e", roughness: 0.9 } },
      // Clear outer poly-wrap pack
      { name: "Poly_Wrap", geometry: box(0.214, 0.216, 0.214), position: [0, 0.109, 0], material: { name: "ClearWrap", color: "#e0f2fe", alpha: 0.22, roughness: 0.12 } },
    ],
  },

  // === 10. ELECTRONICS (ELC) ===
  {
    rel: "products/electronics/electric-kettle.glb",
    root: "Product_Electric_Kettle",
    parts: [
      // 360-degree cordless power base
      { name: "Power_Base", geometry: cyl(0.074, 0.078, 0.022, 32), position: [0, 0.011, 0], material: { name: "MatteCharcoal", color: "#1e293b", roughness: 0.45 } },
      // Tapered brushed stainless-steel kettle body
      {
        name: "Kettle_Body",
        geometry: latheProfile([
          [0.068, 0.022],
          [0.074, 0.036],
          [0.071, 0.145],
          [0.060, 0.215],
          [0.058, 0.225],
        ], 32),
        position: [0, 0, 0],
        material: { name: "BrushedStainless", color: "#cbd5e1", metallic: 0.86, roughness: 0.22 },
      },
      // Hinged black kettle lid with release button
      { name: "Kettle_Lid", geometry: cyl(0.056, 0.060, 0.018, 28), position: [0, 0.232, 0], material: { name: "MatteCharcoal", color: "#0f172a", roughness: 0.34 } },
      { name: "Lid_Button", geometry: cyl(0.012, 0.012, 0.008, 16), position: [0.024, 0.242, 0], material: { name: "AccentSilver", color: "#94a3b8", metallic: 0.85, roughness: 0.2 } },
      // V-shaped pouring spout on -X
      { name: "Pouring_Spout", geometry: cyl(0.014, 0.026, 0.052, 16), position: [-0.072, 0.205, 0], rotation: [0, 0, 0.72], material: { name: "BrushedStainless", color: "#e2e8f0", metallic: 0.88, roughness: 0.2 } },
      // Ergonomic curved matte-black handle on +X
      {
        name: "Kettle_Handle",
        geometry: curvedTube([
          [0.055, 0.212, 0],
          [0.106, 0.204, 0],
          [0.112, 0.135, 0],
          [0.104, 0.066, 0],
          [0.068, 0.052, 0],
        ], 0.0125, 18, 12),
        material: { name: "MatteCharcoal", color: "#1e293b", roughness: 0.36 },
      },
      // Illuminated blue power switch indicator
      { name: "LED_Switch", geometry: box(0.014, 0.018, 0.014), position: [0.098, 0.055, 0], material: { name: "PowerBlue", color: "#38bdf8", emissive: "#0284c7", roughness: 0.2 } },
    ],
  },
  {
    rel: "products/electronics/electronics-box.glb",
    root: "Product_Electronics_Box",
    parts: [
      // Sleek matte-slate retail electronics box with euro-slot hanging tab
      { name: "Tech_Carton", geometry: box(0.145, 0.195, 0.068), position: [0, 0.0975, 0], material: { name: "TechSlate", color: "#0f172a", roughness: 0.32 } },
      { name: "Accent_Band", geometry: box(0.147, 0.018, 0.07), position: [0, 0.188, 0], material: { name: "TechCyan", color: "#06b6d4", roughness: 0.28 } },
      { name: "Hang_Tab", geometry: box(0.068, 0.032, 0.006), position: [0, 0.211, -0.028], material: { name: "ClearTab", color: "#e2e8f0", alpha: 0.65, roughness: 0.14 } },
    ],
  },
  {
    rel: "products/electronics/battery-pack.glb",
    root: "Product_Battery_Pack",
    parts: [
      // Hanging retail blister backing card
      { name: "Blister_Card", geometry: box(0.135, 0.185, 0.008), position: [0, 0.0925, -0.012], material: { name: "CardDark", color: "#1e293b", roughness: 0.42 } },
      { name: "Card_Header", geometry: box(0.135, 0.034, 0.009), position: [0, 0.168, -0.012], material: { name: "BatteryGold", color: "#eab308", roughness: 0.34 } },
      // 4 real metallic copper-top AA cylindrical batteries visible inside front blister dome
      { name: "Battery_01_Body", geometry: cyl(0.0095, 0.0095, 0.048, 18), position: [-0.036, 0.114, 0.004], material: { name: "BatteryBlack", color: "#0f172a", metallic: 0.65, roughness: 0.24 } },
      { name: "Battery_01_Top", geometry: cyl(0.0096, 0.0096, 0.016, 18), position: [-0.036, 0.144, 0.004], material: { name: "CopperTop", color: "#b45309", metallic: 0.85, roughness: 0.2 } },
      { name: "Battery_02_Body", geometry: cyl(0.0095, 0.0095, 0.048, 18), position: [-0.012, 0.114, 0.004], material: { name: "BatteryBlack", color: "#0f172a", metallic: 0.65, roughness: 0.24 } },
      { name: "Battery_02_Top", geometry: cyl(0.0096, 0.0096, 0.016, 18), position: [-0.012, 0.144, 0.004], material: { name: "CopperTop", color: "#b45309", metallic: 0.85, roughness: 0.2 } },
      { name: "Battery_03_Body", geometry: cyl(0.0095, 0.0095, 0.048, 18), position: [0.012, 0.114, 0.004], material: { name: "BatteryBlack", color: "#0f172a", metallic: 0.65, roughness: 0.24 } },
      { name: "Battery_03_Top", geometry: cyl(0.0096, 0.0096, 0.016, 18), position: [0.012, 0.144, 0.004], material: { name: "CopperTop", color: "#b45309", metallic: 0.85, roughness: 0.2 } },
      { name: "Battery_04_Body", geometry: cyl(0.0095, 0.0095, 0.048, 18), position: [0.036, 0.114, 0.004], material: { name: "BatteryBlack", color: "#0f172a", metallic: 0.65, roughness: 0.24 } },
      { name: "Battery_04_Top", geometry: cyl(0.0096, 0.0096, 0.016, 18), position: [0.036, 0.144, 0.004], material: { name: "CopperTop", color: "#b45309", metallic: 0.85, roughness: 0.2 } },
      // Clear thermoformed blister bubble over the 4 batteries
      { name: "Blister_Dome", geometry: box(0.104, 0.078, 0.026), position: [0, 0.122, 0.005], material: { name: "ClearBlister", color: "#f8fafc", alpha: 0.28, roughness: 0.08 } },
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
