// Cached HD procedural PBR & retail CanvasTextures for Supermarket Zanzibar 3D.
//
// Every texture is deterministically synthesized once and cached client-side
// (1024px PBR terrazzo floor, 512px oak timber, perforated pegboard, slotted
// steel uprights, brushed chiller louvers, 512x192 retina ESL price strips,
// 512x512 live photo/retail product packaging labels, promotional end-caps,
// chalkboards, LED temp gauges, and floor wayfinding decals).

import * as THREE from "three";

export interface TerrazzoPbrSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export interface SimplePbrSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

let cachedTerrazzo: TerrazzoPbrSet | null = null;
let cachedWarehouseConcrete: SimplePbrSet | null = null;
let cachedPegboardSet: SimplePbrSet | null = null;
let cachedSlottedUpright: THREE.CanvasTexture | null = null;
let cachedOakTimber: SimplePbrSet | null = null;
let cachedChillerBackwall: THREE.CanvasTexture | null = null;
let cachedWelcomeMat: THREE.CanvasTexture | null = null;

const eslTextureCache = new Map<string, THREE.CanvasTexture>();
const productLabelCache = new Map<string, THREE.CanvasTexture>();
const endcapPromoCache = new Map<string, THREE.CanvasTexture>();
const chalkboardCache = new Map<string, THREE.CanvasTexture>();
const tempGaugeCache = new Map<string, THREE.CanvasTexture>();
const floorDecalCache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(
  w: number,
  h: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return [canvas, ctx];
}

function makeRng(initialSeed: number) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function drawPolygonChip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rand: () => number,
) {
  ctx.beginPath();
  for (let s = 0; s < sides; s += 1) {
    const angle = (s / sides) * Math.PI * 2 + rand() * 0.45;
    const r = radius * (0.58 + rand() * 0.62);
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (s === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * 1024x1024 HD Procedural Polished Zanzibar Terrazzo PBR Texture Set
 * (albedo + roughness + beveled recessed grout bump).
 */
export function getTerrazzoTextures(): TerrazzoPbrSet | null {
  if (cachedTerrazzo) return cachedTerrazzo;
  const size = 1024;
  const albedoPair = makeCanvas(size, size);
  const roughPair = makeCanvas(size, size);
  const bumpPair = makeCanvas(size, size);
  if (!albedoPair || !roughPair || !bumpPair) return null;

  const [aCanvas, aCtx] = albedoPair;
  const [rCanvas, rCtx] = roughPair;
  const [bCanvas, bCtx] = bumpPair;

  // Base warm coral-alabaster stone matrix
  aCtx.fillStyle = "#f2f5f3";
  aCtx.fillRect(0, 0, size, size);

  // Subtle per-tile tonal variation across a 2x2 slab grid (each slab 512px)
  const tileTints = ["#f3f6f4", "#eff3f1", "#f0f4f2", "#f4f6f5"];
  for (let ty = 0; ty < 2; ty += 1) {
    for (let tx = 0; tx < 2; tx += 1) {
      aCtx.fillStyle = tileTints[ty * 2 + tx];
      aCtx.fillRect(tx * 512, ty * 512, 512, 512);
    }
  }

  // Polished honed terrazzo roughness base (~0.25 -> gray #404040)
  rCtx.fillStyle = "#424242";
  rCtx.fillRect(0, 0, size, size);

  // Flat honed surface elevation
  bCtx.fillStyle = "#e0e0e0";
  bCtx.fillRect(0, 0, size, size);

  // Subtle organic mineral clouding inside tile body
  const rand = makeRng(42191);
  for (let i = 0; i < 90; i += 1) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rad = 28 + rand() * 75;
    const grad = aCtx.createRadialGradient(cx, cy, 4, cx, cy, rad);
    grad.addColorStop(0, i % 2 === 0 ? "rgba(220,231,229,0.22)" : "rgba(255,255,255,0.20)");
    grad.addColorStop(1, "rgba(240,245,243,0)");
    aCtx.fillStyle = grad;
    aCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }

  // 1,450 deterministic angular marble, quartz, coral-sand & seafoam mineral chips
  const chipPalette = [
    "#d7e2df",
    "#c5d5d2",
    "#e6ecea",
    "#b1c4c1",
    "#dcd8ce",
    "#cad6d3",
    "#ebe5d9",
    "#9db5b2",
    "#c2cbc7",
  ];

  for (let i = 0; i < 1450; i += 1) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rad = 2.0 + Math.pow(rand(), 1.8) * 9.5;
    const sides = 4 + Math.floor(rand() * 4);
    const col = chipPalette[i % chipPalette.length];

    aCtx.fillStyle = col;
    drawPolygonChip(aCtx, cx, cy, rad, sides, rand);

    // Subtle glossy vs matte variation across stone aggregates
    rCtx.fillStyle =
      i % 4 === 0 ? "#2e2e2e" : i % 3 === 0 ? "#5c5c5c" : "#3a3a3a";
    rCtx.beginPath();
    rCtx.arc(cx, cy, rad * 0.72, 0, Math.PI * 2);
    rCtx.fill();

    // Very subtle micro-relief on larger quartz chips
    if (rad > 6) {
      bCtx.fillStyle = "#ececec";
      bCtx.beginPath();
      bCtx.arc(cx, cy, rad * 0.65, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // Crisp beveled 2x2 tile grout lines (512px spacing -> ~1m x 1m architectural slabs)
  const drawGrout = (
    ctx: CanvasRenderingContext2D,
    outerColor: string,
    innerColor: string,
    outerWidth: number,
    innerWidth: number,
  ) => {
    for (const pos of [0, 512, 1024]) {
      ctx.strokeStyle = outerColor;
      ctx.lineWidth = outerWidth;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();

      ctx.strokeStyle = innerColor;
      ctx.lineWidth = innerWidth;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }
  };

  drawGrout(aCtx, "#dce5e3", "#c4d1ce", 8, 3.5);
  drawGrout(rCtx, "#8f8f8f", "#d8d8d8", 9, 4.5); // Matte cementitious grout
  drawGrout(bCtx, "#9e9e9e", "#424242", 10, 4.5); // Soft chamfer + recessed seam

  const configure = (tex: THREE.CanvasTexture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(19, 14);
    tex.anisotropy = 16;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  cachedTerrazzo = {
    map: configure(new THREE.CanvasTexture(aCanvas), true),
    roughnessMap: configure(new THREE.CanvasTexture(rCanvas), false),
    bumpMap: configure(new THREE.CanvasTexture(bCanvas), false),
  };

  return cachedTerrazzo;
}

/** 512x512 HD Industrial Sealed Epoxy Warehouse Floor texture set. */
export function getWarehouseConcreteTexture(): SimplePbrSet | null {
  if (cachedWarehouseConcrete) return cachedWarehouseConcrete;
  const size = 512;
  const aPair = makeCanvas(size, size);
  const bPair = makeCanvas(size, size);
  if (!aPair || !bPair) return null;

  const [aCanvas, aCtx] = aPair;
  const [bCanvas, bCtx] = bPair;
  const rand = makeRng(9917);

  aCtx.fillStyle = "#dce3e7";
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = "#c8c8c8";
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1600; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 2.2;
    aCtx.fillStyle = i % 2 === 0 ? "rgba(180,194,202,0.45)" : "rgba(244,248,250,0.4)";
    aCtx.fillRect(x, y, r, r);
  }

  // Expansion joint grid
  aCtx.strokeStyle = "#bcc8cf";
  aCtx.lineWidth = 3;
  aCtx.strokeRect(1.5, 1.5, size - 3, size - 3);
  bCtx.strokeStyle = "#505050";
  bCtx.lineWidth = 4;
  bCtx.strokeRect(2, 2, size - 4, size - 4);

  const configure = (tex: THREE.CanvasTexture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 5);
    tex.anisotropy = 8;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  cachedWarehouseConcrete = {
    map: configure(new THREE.CanvasTexture(aCanvas), true),
    bumpMap: configure(new THREE.CanvasTexture(bCanvas), false),
  };
  return cachedWarehouseConcrete;
}

/** 512x512 HD Perforated Powder-Coated Steel Gondola Pegboard PBR set. */
export function getPerforatedPegboardTextures(): SimplePbrSet | null {
  if (cachedPegboardSet) return cachedPegboardSet;
  const size = 512;
  const aPair = makeCanvas(size, size);
  const bPair = makeCanvas(size, size);
  const rPair = makeCanvas(size, size);
  if (!aPair || !bPair || !rPair) return null;

  const [aCanvas, aCtx] = aPair;
  const [bCanvas, bCtx] = bPair;
  const [rCanvas, rCtx] = rPair;

  // Powder-coated satin steel sheet
  aCtx.fillStyle = "#edf2f4";
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = "#dcdcdc";
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = "#686868";
  rCtx.fillRect(0, 0, size, size);

  // Subtle horizontal panel seam lines
  aCtx.strokeStyle = "#dce4e7";
  aCtx.lineWidth = 2;
  for (let y = 128; y < size; y += 128) {
    aCtx.beginPath();
    aCtx.moveTo(0, y);
    aCtx.lineTo(size, y);
    aCtx.stroke();
    bCtx.strokeStyle = "#909090";
    bCtx.lineWidth = 2;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.lineTo(size, y);
    bCtx.stroke();
  }

  // Precision punched peg holes with subtle specular highlight rim + dark inner depth
  const step = 32;
  for (let row = 0; row < size / step; row += 1) {
    const y = row * step + step / 2;
    const xShift = (row % 2) * (step / 2);
    for (let col = 0; col < size / step; col += 1) {
      const x = (col * step + step / 2 + xShift) % size;

      // Upper bright lip bevel
      aCtx.fillStyle = "#ffffff";
      aCtx.beginPath();
      aCtx.arc(x, y + 1.2, 5.2, 0, Math.PI * 2);
      aCtx.fill();

      // Dark punched hole
      aCtx.fillStyle = "#7a8a93";
      aCtx.beginPath();
      aCtx.arc(x, y, 4.4, 0, Math.PI * 2);
      aCtx.fill();

      // Inner shadow core
      aCtx.fillStyle = "#4b5a63";
      aCtx.beginPath();
      aCtx.arc(x, y - 0.6, 3.2, 0, Math.PI * 2);
      aCtx.fill();

      // Deep recessed hole in bump + matte hole interior in roughness
      bCtx.fillStyle = "#222222";
      bCtx.beginPath();
      bCtx.arc(x, y, 4.6, 0, Math.PI * 2);
      bCtx.fill();

      rCtx.fillStyle = "#e0e0e0";
      rCtx.beginPath();
      rCtx.arc(x, y, 4.6, 0, Math.PI * 2);
      rCtx.fill();
    }
  }

  const configure = (tex: THREE.CanvasTexture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 3);
    tex.anisotropy = 8;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  cachedPegboardSet = {
    map: configure(new THREE.CanvasTexture(aCanvas), true),
    bumpMap: configure(new THREE.CanvasTexture(bCanvas), false),
    roughnessMap: configure(new THREE.CanvasTexture(rCanvas), false),
  };
  return cachedPegboardSet;
}

/** Backwards-compatible accessor returning just the pegboard albedo texture. */
export function getPerforatedPegboardTexture(): THREE.CanvasTexture | null {
  return getPerforatedPegboardTextures()?.map ?? null;
}

/** 128x512 HD Slotted Steel Gondola Upright texture (double-row keyway slots). */
export function getSlottedUprightTexture(): THREE.CanvasTexture | null {
  if (cachedSlottedUpright) return cachedSlottedUpright;
  const pair = makeCanvas(128, 512);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  // Satin gunmetal powder-coated steel upright
  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, "#475569");
  grad.addColorStop(0.5, "#64748b");
  grad.addColorStop(1, "#3f4d5e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);

  // Double vertical column of laser-cut cantilever mounting slots
  for (let y = 10; y < 512; y += 22) {
    for (const sx of [32, 82]) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(sx, y, 14, 13);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(sx, y + 13, 14, 1.5);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cachedSlottedUpright = tex;
  return tex;
}

/** 512x512 HD Warm Oak Timber PBR set (for produce crates & bakery cabinetry). */
export function getOakTimberTextures(): SimplePbrSet | null {
  if (cachedOakTimber) return cachedOakTimber;
  const size = 512;
  const aPair = makeCanvas(size, size);
  const bPair = makeCanvas(size, size);
  if (!aPair || !bPair) return null;

  const [aCanvas, aCtx] = aPair;
  const [bCanvas, bCtx] = bPair;
  const rand = makeRng(7331);

  aCtx.fillStyle = "#c7945c";
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = "#c8c8c8";
  bCtx.fillRect(0, 0, size, size);

  // 6 horizontal slatted wood planks with organic grain streaks
  const plankCount = 6;
  const plankH = size / plankCount;
  const plankColors = ["#c9965e", "#bf8a52", "#cfa068", "#bc854d", "#ca9962", "#c28e56"];

  for (let p = 0; p < plankCount; p += 1) {
    const py = p * plankH;
    aCtx.fillStyle = plankColors[p % plankColors.length];
    aCtx.fillRect(0, py, size, plankH);

    // Fine wood fiber streaks
    for (let s = 0; s < 55; s += 1) {
      const sy = py + rand() * (plankH - 3);
      const alpha = 0.06 + rand() * 0.14;
      aCtx.fillStyle = s % 3 === 0 ? `rgba(255,235,205,${alpha})` : `rgba(88,52,20,${alpha})`;
      aCtx.fillRect(0, sy, size, 1 + rand() * 2.2);

      bCtx.fillStyle = s % 2 === 0 ? "#d6d6d6" : "#b5b5b5";
      bCtx.fillRect(0, sy, size, 1.4);
    }

    // Recessed slat groove between timber boards
    aCtx.fillStyle = "#6e4722";
    aCtx.fillRect(0, py, size, 3.5);
    bCtx.fillStyle = "#3a3a3a";
    bCtx.fillRect(0, py, size, 4);
  }

  const configure = (tex: THREE.CanvasTexture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.anisotropy = 8;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  cachedOakTimber = {
    map: configure(new THREE.CanvasTexture(aCanvas), true),
    bumpMap: configure(new THREE.CanvasTexture(bCanvas), false),
  };
  return cachedOakTimber;
}

/** 512x512 HD Brushed Stainless Chiller Louvered Airflow Backwall texture. */
export function getChillerBackwallTexture(): THREE.CanvasTexture | null {
  if (cachedChillerBackwall) return cachedChillerBackwall;
  const size = 512;
  const pair = makeCanvas(size, size);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  // Brushed stainless cold-cabinet back sheet
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, "#dbe7ee");
  grad.addColorStop(0.5, "#eef6fa");
  grad.addColorStop(1, "#d4e3ec");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle horizontal brushed-metal hairline sheen
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let y = 0; y < size; y += 6) {
    ctx.fillRect(0, y, size, 1.5);
  }

  // Horizontal cold-air louver bands (refrigerated curtain vents)
  for (let band = 48; band < size; band += 116) {
    for (let x = 24; x < size - 24; x += 28) {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(x, band, 18, 6);
      ctx.fillStyle = "#334155";
      ctx.fillRect(x, band + 10, 18, 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedChillerBackwall = tex;
  return tex;
}

/**
 * 512x192 Retina HD Electronic Shelf Label (ESL) CanvasTexture.
 * Crisp 3-color e-paper display readable up close in Walk aisles mode without hovering.
 */
export function getEslLabelTexture({
  name,
  priceText,
  stockState,
  quantity,
  sku,
}: {
  name: string;
  priceText: string;
  stockState: "in" | "low" | "out";
  quantity: number;
  sku?: string;
}): THREE.CanvasTexture | null {
  const key = `${name}|${priceText}|${stockState}|${quantity}|${sku ?? ""}`;
  const existing = eslTextureCache.get(key);
  if (existing) return existing;

  const pair = makeCanvas(512, 192);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  // Matte anthracite ESL ABS frame border
  ctx.fillStyle = "#18232d";
  ctx.fillRect(0, 0, 512, 192);

  // Crisp e-ink off-white screen panel
  ctx.fillStyle = "#fbfdfc";
  ctx.fillRect(10, 10, 492, 172);

  // Top status/category header strip (3-color e-ink: red / amber / deep teal)
  const stripeColor =
    stockState === "out"
      ? "#b91c1c"
      : stockState === "low"
        ? "#c2410c"
        : "#0f766e";
  ctx.fillStyle = stripeColor;
  ctx.fillRect(10, 10, 492, 46);

  // Product short name in crisp bold header
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px Inter, system-ui, -apple-system, sans-serif";
  const shortName = name.length > 26 ? `${name.slice(0, 25)}…` : name;
  ctx.fillText(shortName.toUpperCase(), 22, 41);

  // Small pack/unit label on top right of header
  const packMatch = name.match(/\b(\d+(?:\.\d+)?\s?(?:ml|l|kg|g|pcs|pack))\b/i);
  if (packMatch) {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(410, 18, 82, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 16px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(packMatch[1].toUpperCase(), 451, 39);
    ctx.textAlign = "left";
  }

  // Razor-sharp large TSh price display
  ctx.fillStyle = "#0b141a";
  ctx.font = "800 56px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(priceText, 22, 120);

  // Hairline divider above footer
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(22, 134, 468, 2);

  // Live stock LED indicator dot + status count
  const dotColor =
    stockState === "out"
      ? "#dc2626"
      : stockState === "low"
        ? "#d97706"
        : "#16a34a";
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(31, 159, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stockState === "out" ? "#b91c1c" : "#1e293b";
  ctx.font = "700 20px Inter, system-ui, sans-serif";
  const statusLabel =
    stockState === "out"
      ? "OUT OF STOCK"
      : stockState === "low"
        ? `LOW STOCK · ${quantity} LEFT`
        : `IN STOCK · ${quantity}`;
  ctx.fillText(statusLabel, 46, 166);

  // Crisp EAN / Code-128 style micro barcode bars on bottom-right
  const codeSeed = sku || name;
  ctx.fillStyle = "#0f172a";
  let bx = 352;
  for (let i = 0; i < 24 && bx < 488; i += 1) {
    const ch = codeSeed.charCodeAt(i % Math.max(1, codeSeed.length)) || 53;
    const bw = (ch + i) % 3 === 0 ? 4.5 : (ch + i) % 2 === 0 ? 2.5 : 1.5;
    ctx.fillRect(bx, 142, bw, 32);
    bx += bw + ((ch % 2) + 2);
  }

  // Subtle diagonal glass highlight across e-paper screen
  const sheen = ctx.createLinearGradient(0, 0, 512, 192);
  sheen.addColorStop(0, "rgba(255,255,255,0.08)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(15,23,42,0.04)");
  ctx.fillStyle = sheen;
  ctx.fillRect(10, 10, 492, 172);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.needsUpdate = true;

  if (eslTextureCache.size > 320) {
    const firstKey = eslTextureCache.keys().next().value;
    if (firstKey) {
      eslTextureCache.get(firstKey)?.dispose();
      eslTextureCache.delete(firstKey);
    }
  }
  eslTextureCache.set(key, tex);
  return tex;
}

function categoryAccentPalette(
  categoryName: string | null | undefined,
  name: string,
): { primary: string; secondary: string; soft: string } {
  const s = `${categoryName ?? ""} ${name}`.toLowerCase();
  if (/cola|coke/.test(s)) {
    return { primary: "#b91c1c", secondary: "#7f1d1d", soft: "#fef2f2" };
  }
  if (/fanta|orange|mango|juice/.test(s)) {
    return { primary: "#ea580c", secondary: "#c2410c", soft: "#fff7ed" };
  }
  if (/sprite|lime|mint/.test(s)) {
    return { primary: "#15803d", secondary: "#166534", soft: "#f0fdf4" };
  }
  if (/soda|water|drink|beverage|aqua/.test(s)) {
    return { primary: "#0284c7", secondary: "#0369a1", soft: "#f0f9ff" };
  }
  if (/milk|yogurt|dairy|cheese|butter|egg/.test(s)) {
    return { primary: "#1d4ed8", secondary: "#1e40af", soft: "#eff6ff" };
  }
  if (/bread|bakery|cake|pastry|bun|biscuit/.test(s)) {
    return { primary: "#b45309", secondary: "#92400e", soft: "#fffbeb" };
  }
  if (/meat|fish|beef|chicken|seafood|tomato/.test(s)) {
    return { primary: "#b91c1c", secondary: "#991b1b", soft: "#fef2f2" };
  }
  if (/fruit|veg|produce|apple|banana|rice|grain/.test(s)) {
    return { primary: "#15803d", secondary: "#14532d", soft: "#f0fdf4" };
  }
  if (/oil|sunflower|flour|cereal|wheat/.test(s)) {
    return { primary: "#ca8a04", secondary: "#a16207", soft: "#fefce8" };
  }
  if (/soap|shampoo|lotion|cosmetic|cream|toothpaste/.test(s)) {
    return { primary: "#be185d", secondary: "#9d174d", soft: "#fdf2f8" };
  }
  if (/clean|detergent|tissue|household|bleach/.test(s)) {
    return { primary: "#4338ca", secondary: "#3730a3", soft: "#eef2ff" };
  }
  if (/frozen|ice/.test(s)) {
    return { primary: "#0e7490", secondary: "#155e75", soft: "#ecfeff" };
  }
  return { primary: "#0f766e", secondary: "#115e59", soft: "#f0fdfa" };
}

function drawWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let lineIndex = 0;
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = words[i];
      lineIndex += 1;
      if (lineIndex >= maxLines - 1) {
        const rest = words.slice(i).join(" ");
        const clipped = rest.length > 22 ? `${rest.slice(0, 21)}…` : rest;
        ctx.fillText(clipped, x, y + lineIndex * lineHeight);
        return;
      }
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lineIndex * lineHeight);
  }
}

/**
 * 512x512 HD Per-Product Retail Packaging Label CanvasTexture.
 * Combines real uploaded product photo (`/api/public/products/[id]/image`)
 * with rich retail packaging design (brand header band, auto-extracted pack
 * size badge, crisp title, live TSh price, and EAN barcode strip).
 */
export function getProductLabelTexture({
  productId,
  name,
  categoryName,
  priceText,
  barcode,
  imageUrl,
}: {
  productId: string;
  name: string;
  categoryName?: string | null;
  priceText: string;
  barcode?: string;
  imageUrl?: string | null;
}): THREE.CanvasTexture | null {
  const key = `${productId}|${name}|${priceText}|${imageUrl ?? ""}`;
  const existing = productLabelCache.get(key);
  if (existing) return existing;

  const pair = makeCanvas(512, 512);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  const palette = categoryAccentPalette(categoryName, name);
  const packMatch = name.match(
    /\b(\d+(?:\.\d+)?\s?(?:ml|l|kg|g|pcs|pack|sheets|rolls))\b/i,
  );
  const packBadge = packMatch ? packMatch[1].toUpperCase() : "QUALITY";

  const paintBase = (img?: HTMLImageElement) => {
    // Crisp satin-white packaging board base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);

    // Glossy brand/category header gradient band
    const headerGrad = ctx.createLinearGradient(0, 0, 512, 88);
    headerGrad.addColorStop(0, palette.primary);
    headerGrad.addColorStop(1, palette.secondary);
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, 512, 88);

    // Subtle metallic trim rule under header
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(0, 84, 512, 4);

    // Category label in header
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 24px Inter, system-ui, sans-serif";
    const catText = (categoryName || "ZANZIBAR SELECT").toUpperCase().slice(0, 20);
    ctx.fillText(catText, 24, 54);

    // Pack size pill badge in header top-right
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(366, 20, 122, 46);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(366, 20, 122, 46);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(packBadge.slice(0, 9), 427, 51);
    ctx.textAlign = "left";

    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      // Studio-framed real uploaded product photograph
      ctx.fillStyle = palette.soft;
      ctx.fillRect(24, 104, 464, 214);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 104, 464, 214);

      const boxW = 436;
      const boxH = 194;
      const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = (512 - dw) / 2;
      const dy = 114 + (boxH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);

      // Bold retail product title below photo
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 32px Inter, system-ui, sans-serif";
      drawWrappedLines(ctx, name, 24, 358, 464, 38, 2);
    } else {
      // Rich flagship retail packaging artwork when no uploaded photo exists
      ctx.fillStyle = palette.soft;
      ctx.fillRect(24, 108, 464, 286);

      // Decorative diagonal brand swoosh band
      ctx.save();
      ctx.beginPath();
      ctx.rect(24, 108, 464, 286);
      ctx.clip();
      ctx.fillStyle = palette.primary;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(24, 290);
      ctx.quadraticCurveTo(256, 220, 488, 330);
      ctx.lineTo(488, 394);
      ctx.lineTo(24, 394);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Clean frame border
      ctx.strokeStyle = palette.primary;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 108, 464, 286);
      ctx.globalAlpha = 1;

      // Brand monogram crest
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.arc(72, 162, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 22px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(name.slice(0, 2).toUpperCase(), 72, 170);
      ctx.textAlign = "left";

      ctx.fillStyle = palette.secondary;
      ctx.font = "700 18px Inter, system-ui, sans-serif";
      ctx.fillText("PREMIUM RETAIL SELECTION", 112, 168);

      // Large crisp product title
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 40px Inter, system-ui, sans-serif";
      drawWrappedLines(ctx, name, 44, 240, 424, 48, 3);
    }

    // Retail bottom strip: price tag + authentic EAN-13 barcode bars
    ctx.fillStyle = "#f1f5f7";
    ctx.fillRect(0, 418, 512, 94);
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 418, 512, 4);

    ctx.fillStyle = "#0f172a";
    ctx.font = "800 32px Inter, system-ui, sans-serif";
    ctx.fillText(priceText, 24, 476);

    // Crisp barcode block
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(318, 434, 172, 64);
    const codeStr = barcode || productId;
    ctx.fillStyle = "#0f172a";
    let bx = 328;
    for (let i = 0; i < 26 && bx < 480; i += 1) {
      const ch = codeStr.charCodeAt(i % Math.max(1, codeStr.length)) || 48;
      const bw = (ch + i) % 3 === 0 ? 4.2 : 2.1;
      ctx.fillRect(bx, 442, bw, 36);
      bx += bw + 2.6;
    }
    ctx.font = "600 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(codeStr.slice(0, 14), 404, 492);
    ctx.textAlign = "left";
  };

  paintBase();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.needsUpdate = true;

  // Asynchronously paint real uploaded product image onto packaging when available.
  if (imageUrl && typeof Image !== "undefined") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      paintBase(img);
      tex.needsUpdate = true;
    };
    img.src = imageUrl;
  }

  if (productLabelCache.size > 260) {
    const firstKey = productLabelCache.keys().next().value;
    if (firstKey) {
      productLabelCache.get(firstKey)?.dispose();
      productLabelCache.delete(firstKey);
    }
  }
  productLabelCache.set(key, tex);
  return tex;
}

/** 512x256 HD Promotional End-Cap Header graphic texture for double-sided gondolas. */
export function getEndcapPromoTexture(
  departmentCode: string,
  headline: string,
): THREE.CanvasTexture | null {
  const key = `${departmentCode}|${headline}`;
  const existing = endcapPromoCache.get(key);
  if (existing) return existing;

  const pair = makeCanvas(512, 256);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  const isBev = departmentCode === "BEV";
  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, isBev ? "#0369a1" : "#0f766e");
  grad.addColorStop(1, isBev ? "#0e7490" : "#115e59");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle architectural geometric accent bands
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(340, 0);
  ctx.lineTo(512, 0);
  ctx.lineTo(512, 256);
  ctx.lineTo(250, 256);
  ctx.closePath();
  ctx.fill();

  // Promo badge
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(28, 28, 178, 40);
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 20px Inter, system-ui, sans-serif";
  ctx.fillText("STORE SPECIAL", 42, 55);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 42px Inter, system-ui, sans-serif";
  ctx.fillText(headline.toUpperCase().slice(0, 18), 28, 146);

  ctx.fillStyle = "#ccfbf1";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("ZANZIBAR FRESH · EVERYDAY VALUE", 28, 206);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  endcapPromoCache.set(key, tex);
  return tex;
}

/** 512x160 HD Matte Slate Chalkboard texture for Produce Islands & Bakery gantries. */
export function getProduceChalkboardTexture(
  title: string,
  subtitle: string,
): THREE.CanvasTexture | null {
  const key = `${title}|${subtitle}`;
  const existing = chalkboardCache.get(key);
  if (existing) return existing;

  const pair = makeCanvas(512, 160);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  // Matte slate chalkboard with subtle chalk-dust clouding
  ctx.fillStyle = "#1b2428";
  ctx.fillRect(0, 0, 512, 160);
  const rand = makeRng(3141);
  for (let i = 0; i < 65; i += 1) {
    const cx = rand() * 512;
    const cy = rand() * 160;
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    ctx.beginPath();
    ctx.arc(cx, cy, 18 + rand() * 35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hand-drawn chalk double border
  ctx.strokeStyle = "rgba(254,243,199,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 488, 136);

  ctx.fillStyle = "#fef9c3";
  ctx.font = "700 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(title.toUpperCase(), 256, 78);

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "600 20px Inter, system-ui, sans-serif";
  ctx.fillText(subtitle.toUpperCase(), 256, 122);
  ctx.textAlign = "left";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  chalkboardCache.set(key, tex);
  return tex;
}

/** 256x96 HD Digital Chiller LED Temperature Gauge texture (e.g. 3.5°C, -18°C). */
export function getDigitalTempTexture(
  tempText: string,
  accentHex = "#38bdf8",
): THREE.CanvasTexture | null {
  const key = `${tempText}|${accentHex}`;
  const existing = tempGaugeCache.get(key);
  if (existing) return existing;

  const pair = makeCanvas(256, 96);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  ctx.fillStyle = "#091119";
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = accentHex;
  ctx.font = "700 48px monospace";
  ctx.textAlign = "center";
  ctx.fillText(tempText, 128, 64);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 13px Inter, sans-serif";
  ctx.fillText("TEMP OK", 128, 84);
  ctx.textAlign = "left";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tempGaugeCache.set(key, tex);
  return tex;
}

/** 512x256 HD Commercial Ribbed Entrance Welcome Mat texture. */
export function getWelcomeMatTexture(): THREE.CanvasTexture | null {
  if (cachedWelcomeMat) return cachedWelcomeMat;
  const pair = makeCanvas(512, 256);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  // Heavy rubber border + dark teal ribbed carpet pile
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#114440";
  ctx.fillRect(14, 14, 484, 228);

  // Ribbed carpet lines
  for (let y = 18; y < 238; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(14, y, 484, 3);
  }

  ctx.strokeStyle = "rgba(153,246,228,0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, 456, 200);

  ctx.fillStyle = "#f0fdfa";
  ctx.font = "800 42px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("KARIBU", 256, 118);

  ctx.fillStyle = "#99f6e4";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("SUPERMARKET ZANZIBAR", 256, 166);
  ctx.textAlign = "left";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cachedWelcomeMat = tex;
  return tex;
}

/** 512x192 HD Architectural Recessed Floor Aisle Marker Decal. */
export function getFloorAisleDecalTexture(
  label: string,
  subtitle?: string,
): THREE.CanvasTexture | null {
  const key = `${label}|${subtitle ?? ""}`;
  const existing = floorDecalCache.get(key);
  if (existing) return existing;

  const pair = makeCanvas(512, 192);
  if (!pair) return null;
  const [canvas, ctx] = pair;

  ctx.clearRect(0, 0, 512, 192);

  // Subtle translucent architectural slate border strip
  ctx.fillStyle = "rgba(15, 118, 110, 0.08)";
  ctx.fillRect(18, 18, 476, 156);
  ctx.strokeStyle = "rgba(15, 118, 110, 0.34)";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 476, 156);

  // Accent bar at top
  ctx.fillStyle = "#0f766e";
  ctx.fillRect(18, 18, 476, 10);

  ctx.fillStyle = "#1e293b";
  ctx.font = "800 54px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label.toUpperCase(), 256, subtitle ? 98 : 114);

  if (subtitle) {
    ctx.fillStyle = "#0f766e";
    ctx.font = "700 24px Inter, system-ui, sans-serif";
    ctx.fillText(subtitle.toUpperCase(), 256, 144);
  }
  ctx.textAlign = "left";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  floorDecalCache.set(key, tex);
  return tex;
}
