"use client";

import * as React from "react";
import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import {
  INVENTORY_STATE_STYLES,
  heatmapColorForState,
} from "@/lib/digital-twin/inventory-state";
import {
  getChillerBackwallTexture,
  getColumnHeaderTexture,
  getDigitalTempTexture,
  getEndcapPromoTexture,
  getEslLabelTexture,
  getOakTimberTextures,
  getPerforatedPegboardTextures,
  getProduceChalkboardTexture,
  getSlottedUprightTexture,
} from "@/lib/digital-twin/procedural-textures";
import { computeColumnRowPlan } from "@/lib/digital-twin/product-layout";
import {
  chillerDoorCountForFixture,
  shelfSlotDoorIndex,
  shelfSlotLocalLayout,
} from "@/lib/digital-twin/spatial-plan";
import { formatMoney } from "@/lib/format";
import type {
  TwinShelfNode,
  TwinShelfPositionNode,
  TwinViewMode,
} from "@/types/digital-twin";
import { ShelfInteraction } from "./ShelfInteraction";
import { ShelfProducts } from "./ShelfProducts";

// ---------------------------------------------------------------------------
// Shared cached procedural architectural geometries (built once, zero leaks)
// ---------------------------------------------------------------------------
let cachedBracketGeo: THREE.ExtrudeGeometry | null = null;
function getCantileverBracketGeometry(): THREE.ExtrudeGeometry {
  if (cachedBracketGeo) return cachedBracketGeo;
  // Tapered steel supermarket cantilever arm: 0.34m reach, 0.085m back height -> 0.018m tip
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.34, 0);
  shape.lineTo(0.34, -0.018);
  shape.lineTo(0.03, -0.085);
  shape.lineTo(0, -0.085);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -0.007);
  cachedBracketGeo = geo;
  return geo;
}

const cachedCurvedGuardGeos = new Map<string, THREE.CylinderGeometry>();
function getCurvedGuardGeometry(
  radius: number,
  length: number,
  arcAngle: number,
): THREE.CylinderGeometry {
  const key = `${radius.toFixed(3)}|${length.toFixed(3)}|${arcAngle.toFixed(3)}`;
  const existing = cachedCurvedGuardGeos.get(key);
  if (existing) return existing;
  // Cylinder along X axis after rotationZ(PI/2), open-ended curved quarter-arc
  const geo = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    24,
    1,
    true,
    0,
    arcAngle,
  );
  geo.rotateZ(Math.PI / 2);
  cachedCurvedGuardGeos.set(key, geo);
  return geo;
}

const SHELF_WORLD_POS = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Interactive Multi-Door Chiller Glass Doors (~35° GSAP smooth swing per door)
// ---------------------------------------------------------------------------
function SingleChillerDoor({
  doorWidth,
  doorHeight,
  doorY,
  xCenter,
  hingeSide,
  isOpen,
}: {
  doorWidth: number;
  doorHeight: number;
  doorY: number;
  xCenter: number;
  hingeSide: "left" | "right";
  isOpen: boolean;
}) {
  const pivotRef = React.useRef<THREE.Group>(null);
  const sign = hingeSide === "left" ? 1 : -1;
  const pivotX = hingeSide === "left" ? xCenter - doorWidth / 2 : xCenter + doorWidth / 2;

  React.useEffect(() => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    gsap.killTweensOf(pivot.rotation);
    // Swing cleanly outward ~35° (0.61 rad)
    gsap.to(pivot.rotation, {
      y: isOpen ? -sign * 0.61 : 0,
      duration: 0.58,
      ease: "power2.out",
    });
  }, [isOpen, sign]);

  const innerOffset = sign * (doorWidth / 2);
  const handleOffset = sign * (doorWidth - 0.085);

  return (
    <group ref={pivotRef} position={[pivotX, doorY, 0]}>
      {/* Crystal-clear double-glazed low-E glass pane */}
      <mesh position={[innerOffset, 0, 0]}>
        <boxGeometry args={[doorWidth - 0.05, doorHeight - 0.06, 0.018]} />
        <meshPhysicalMaterial
          color="#dff6ff"
          transparent
          opacity={0.2}
          roughness={0.04}
          metalness={0.06}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          reflectivity={0.95}
          depthWrite={false}
        />
      </mesh>

      {/* 4-sided anodized brushed aluminum frame + magnetic perimeter seal */}
      <mesh position={[sign * 0.018, 0, 0.004]}>
        <boxGeometry args={[0.032, doorHeight, 0.028]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[sign * (doorWidth - 0.018), 0, 0.004]}>
        <boxGeometry args={[0.032, doorHeight, 0.028]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[innerOffset, doorHeight / 2 - 0.018, 0.004]}>
        <boxGeometry args={[doorWidth, 0.034, 0.028]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[innerOffset, -(doorHeight / 2 - 0.018), 0.004]}>
        <boxGeometry args={[doorWidth, 0.034, 0.028]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.78} roughness={0.22} />
      </mesh>

      {/* Black rubber magnetic door gasket */}
      <mesh position={[innerOffset, 0, -0.012]}>
        <boxGeometry args={[doorWidth - 0.01, doorHeight - 0.01, 0.006]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.85}
          wireframe={false}
          transparent
          opacity={0.22}
        />
      </mesh>

      {/* Ergonomic D-shaped brushed chrome pull handle + 2 standoff brackets */}
      <mesh position={[handleOffset, 0, 0.048]}>
        <cylinderGeometry args={[0.011, 0.011, 0.44, 14]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.14} />
      </mesh>
      <mesh position={[handleOffset, 0.17, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.042, 10]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.2} />
      </mesh>
      <mesh position={[handleOffset, -0.17, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.042, 10]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.2} />
      </mesh>
    </group>
  );
}

function ChillerGlassDoors({
  width,
  height,
  depth,
  isZLong,
  doorCount,
  openDoorIndices,
  showCoolLed,
}: {
  width: number;
  height: number;
  depth: number;
  isZLong: boolean;
  doorCount: number;
  openDoorIndices: ReadonlySet<number>;
  showCoolLed: boolean;
}) {
  const span = (isZLong ? depth : width) - 0.16;
  const doorWidth = span / doorCount - 0.018;
  const doorHeight = height * 0.72;
  const doorY = height * 0.51;

  // Z-long chiller (`FR-BEV-01`) faces the west beverage aisle (-X).
  // X-long chillers (`FR-DAI-01/02`) face local +Z.
  const groupRotationY = isZLong ? -Math.PI / 2 : 0;
  const faceDist = isZLong ? width / 2 + 0.024 : depth / 2 + 0.024;

  return (
    <group rotation={[0, groupRotationY, 0]}>
      <group position={[0, 0, faceDist]}>
        {/* Vertical aluminum door mullions + recessed 5500K vertical LED light bars */}
        {Array.from({ length: doorCount + 1 }).map((_, idx) => {
          const mx = -span / 2 + (idx / doorCount) * span;
          return (
            <group key={`mul-${idx}`} position={[mx, doorY, -0.015]}>
              <mesh>
                <boxGeometry args={[0.028, doorHeight + 0.04, 0.045]} />
                <meshStandardMaterial
                  color="#94a3b8"
                  metalness={0.75}
                  roughness={0.28}
                />
              </mesh>
              {showCoolLed && (
                <mesh position={[0, 0, -0.026]}>
                  <boxGeometry args={[0.012, doorHeight - 0.06, 0.01]} />
                  <meshStandardMaterial
                    color="#e0f7ff"
                    emissive="#cff4ff"
                    emissiveIntensity={1.38}
                    toneMapped={false}
                  />
                </mesh>
              )}
            </group>
          );
        })}

        {/* Individual hinged doors */}
        {Array.from({ length: doorCount }).map((_, idx) => {
          const xCenter = -span / 2 + (idx + 0.5) * (span / doorCount);
          const hingeSide: "left" | "right" = idx % 2 === 0 ? "left" : "right";
          return (
            <SingleChillerDoor
              key={`door-${idx}`}
              doorWidth={doorWidth}
              doorHeight={doorHeight}
              doorY={doorY}
              xCenter={xCenter}
              hingeSide={hingeSide}
              isOpen={openDoorIndices.has(idx)}
            />
          );
        })}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Interactive Curved Glass Canopy for Meat & Seafood Counter (GSAP 32° lift)
// ---------------------------------------------------------------------------
function MeatCounterCurvedGlass({
  width,
  height,
  depth,
  open,
}: {
  width: number;
  height: number;
  depth: number;
  open: boolean;
}) {
  const pivotRef = React.useRef<THREE.Group>(null);
  const curvedGeo = React.useMemo(
    () => getCurvedGuardGeometry(depth * 0.54, width - 0.12, Math.PI * 0.44),
    [depth, width],
  );

  React.useEffect(() => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    gsap.killTweensOf(pivot.rotation);
    gsap.to(pivot.rotation, {
      x: open ? -0.56 : 0, // ~32° smooth lift-open showcase glass
      duration: 0.55,
      ease: "power2.out",
    });
  }, [open]);

  return (
    <group
      ref={pivotRef}
      position={[0, height * 0.88, -(depth * 0.14)]}
    >
      <mesh
        geometry={curvedGeo}
        position={[0, -height * 0.34, depth * 0.14]}
      >
        <meshPhysicalMaterial
          color="#dff7ff"
          transparent
          opacity={0.22}
          roughness={0.05}
          metalness={0.05}
          clearcoat={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Brushed stainless top & front trim bars */}
      <mesh position={[0, -0.02, depth * 0.14]}>
        <boxGeometry args={[width - 0.08, 0.032, 0.035]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Brushed chrome lift handle */}
      <mesh position={[0, -height * 0.32, depth * 0.67]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.011, 0.011, 0.55, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.16} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// HD Top-of-Column Product Name Sign (mounted right on top of each 4-row column)
// ---------------------------------------------------------------------------
function ShelfColumnTopHeader({
  shelf,
  pos,
  totalColumns,
  effectiveQuantity,
  isOverflowContinuation,
  isSelected,
  onSelectProduct,
}: {
  shelf: TwinShelfNode;
  pos: TwinShelfPositionNode;
  totalColumns: number;
  effectiveQuantity: number;
  isOverflowContinuation: boolean;
  isSelected: boolean;
  onSelectProduct: (pos: TwinShelfPositionNode) => void;
}) {
  const layout = React.useMemo(
    () => shelfSlotLocalLayout(shelf, pos.slotIndex, totalColumns),
    [shelf, pos.slotIndex, totalColumns],
  );

  const product = pos.product;
  const rowPlan = React.useMemo(
    () =>
      computeColumnRowPlan(
        product ? effectiveQuantity : 0,
        pos.maximumCapacity,
        layout.rowCount,
      ),
    [product, effectiveQuantity, pos.maximumCapacity, layout.rowCount],
  );
  const rowsFilled = rowPlan.filter((r) => r.quantity > 0).length;
  const rowFillPercents = React.useMemo(
    () => rowPlan.map((r) => r.fillPercent),
    [rowPlan],
  );
  const columnLabel = `COL ${layout.columnIndex + 1}`;

  const texture = React.useMemo(
    () =>
      getColumnHeaderTexture({
        productName: product?.name ?? null,
        columnLabel,
        priceText: product ? formatMoney(product.price) : undefined,
        quantity: effectiveQuantity,
        maximumCapacity: pos.maximumCapacity,
        filledRows: rowsFilled,
        rowFillPercents,
        categoryName: product?.categoryName ?? null,
        isOverflowContinuation,
      }),
    [
      product,
      columnLabel,
      effectiveQuantity,
      pos.maximumCapacity,
      rowsFilled,
      rowFillPercents,
      isOverflowContinuation,
    ],
  );

  if (!texture) return null;

  const plaqueW = Math.max(0.54, Math.min(1.18, layout.columnWidth * 0.86));
  const plaqueH = plaqueW * 0.3125; // Matches 512x160 aspect ratio cleanly

  return (
    <group
      name={`${pos.objectName}_TopHeader`}
      position={layout.headerLocalPosition}
      rotation={[0, layout.localRotationY, 0]}
    >
      {/* Twin brushed-chrome riser stems anchoring plaque to shelf top fascia */}
      <mesh position={[-plaqueW * 0.32, -plaqueH * 0.52, -0.015]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[plaqueW * 0.32, -plaqueH * 0.52, -0.015]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Slightly downward-angled architectural column header sign for aisle legibility */}
      <group rotation={[0.1, 0, 0]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            if (product) onSelectProduct(pos);
          }}
          castShadow
        >
          <boxGeometry args={[plaqueW + 0.024, plaqueH + 0.024, 0.026]} />
          <meshStandardMaterial
            color={isSelected ? "#0f766e" : "#1e293b"}
            metalness={0.55}
            roughness={0.32}
            emissive={isSelected ? "#0f766e" : "#000000"}
            emissiveIntensity={isSelected ? 0.35 : 0}
          />
        </mesh>

        {/* Crisp 512x160 HD Product Name + 4-Row Status face */}
        <mesh
          position={[0, 0, 0.0145]}
          onClick={(e) => {
            e.stopPropagation();
            if (product) onSelectProduct(pos);
          }}
        >
          <planeGeometry args={[plaqueW, plaqueH]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.34}
            metalness={0.04}
          />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// HD Electronic Shelf Label (ESL) mounted inside physical rail clip housing
// ---------------------------------------------------------------------------
function ShelfEslTag({
  shelf,
  pos,
  totalColumns,
  effectiveQuantity,
  onSelectProduct,
}: {
  shelf: TwinShelfNode;
  pos: TwinShelfPositionNode;
  totalColumns: number;
  effectiveQuantity: number;
  onSelectProduct: (pos: TwinShelfPositionNode) => void;
}) {
  const layout = React.useMemo(
    () => shelfSlotLocalLayout(shelf, pos.slotIndex, totalColumns),
    [shelf, pos.slotIndex, totalColumns],
  );

  const product = pos.product;
  const stockState: "in" | "low" | "out" =
    effectiveQuantity <= 0
      ? "out"
      : effectiveQuantity <= pos.reorderLevel
        ? "low"
        : "in";

  const texture = React.useMemo(() => {
    if (!product) return null;
    return getEslLabelTexture({
      name: product.name,
      priceText: formatMoney(product.price),
      stockState,
      quantity: effectiveQuantity,
      sku: product.sku,
    });
  }, [product, stockState, effectiveQuantity]);

  if (!product || !texture) return null;

  const ledColor =
    stockState === "out"
      ? "#ef4444"
      : stockState === "low"
        ? "#f59e0b"
        : "#22c55e";

  return (
    <group
      position={layout.eslLocalPosition}
      rotation={[0, layout.localRotationY, 0]}
    >
      {/* Physical matte-anthracite ABS ESL clip housing snapped to aluminum rail */}
      <group position={[0, 0, 0.014]} rotation={[-0.24, 0, 0]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelectProduct(pos);
          }}
        >
          <boxGeometry args={[0.268, 0.098, 0.016]} />
          <meshStandardMaterial color="#1e293b" roughness={0.42} metalness={0.35} />
        </mesh>

        {/* Crisp 512x192 e-ink screen face */}
        <mesh
          position={[0, 0, 0.009]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectProduct(pos);
          }}
        >
          <planeGeometry args={[0.252, 0.088]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.32}
            metalness={0.04}
          />
        </mesh>

        {/* Micro status LED indicator dot on top-right bezel corner */}
        <mesh position={[0.118, 0.036, 0.0095]}>
          <circleGeometry args={[0.0045, 10]} />
          <meshBasicMaterial color={ledColor} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Promotional End-Cap Display Unit (for both ends of double-sided gondolas)
// ---------------------------------------------------------------------------
function PromotionalEndCap({
  w,
  h,
  zPosition,
  facingSign,
  departmentCode,
  headline,
  opacity,
  viewMode,
}: {
  w: number;
  h: number;
  zPosition: number;
  facingSign: 1 | -1;
  departmentCode: string;
  headline: string;
  opacity: number;
  viewMode: TwinViewMode;
}) {
  const promoTex = React.useMemo(
    () =>
      viewMode === "realistic"
        ? getEndcapPromoTexture(departmentCode, headline)
        : null,
    [departmentCode, headline, viewMode],
  );

  return (
    <group
      position={[0, 0, zPosition]}
      rotation={[0, facingSign > 0 ? 0 : Math.PI, 0]}
    >
      {/* Solid end-cap structural backing & dark base kickplate */}
      <mesh position={[0, h * 0.5, 0.025]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.96, h - 0.16, 0.045]} />
        <meshStandardMaterial
          color="#e5eded"
          roughness={0.4}
          metalness={0.18}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, 0.14, 0.16]} castShadow>
        <boxGeometry args={[w * 0.92, 0.24, 0.28]} />
        <meshStandardMaterial color="#1f2d33" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Brushed stainless base shopping-cart bumper guard */}
      <mesh position={[0, 0.18, 0.315]}>
        <boxGeometry args={[w * 0.96, 0.035, 0.025]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.86} roughness={0.2} />
      </mesh>

      {/* 3 mini promotional end-cap display shelves with chrome retainer wires */}
      {[0.62, 1.04, 1.44].map((sy, idx) => (
        <group key={idx} position={[0, sy, 0.14]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[w * 0.88, 0.03, 0.22]} />
            <meshStandardMaterial color="#f8fafb" roughness={0.34} metalness={0.2} />
          </mesh>
          {/* Front aluminum edge strip */}
          <mesh position={[0, -0.002, 0.115]}>
            <boxGeometry args={[w * 0.88, 0.036, 0.012]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.78} roughness={0.24} />
          </mesh>
          {/* Chrome wire product retainer rail */}
          <mesh position={[0, 0.042, 0.105]}>
            <boxGeometry args={[w * 0.84, 0.008, 0.008]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.16} />
          </mesh>
        </group>
      ))}

      {/* Promotional header sign panel at top of end-cap */}
      {promoTex && (
        <group position={[0, h - 0.28, 0.065]}>
          <mesh>
            <boxGeometry args={[w * 0.94, 0.34, 0.026]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.015]}>
            <planeGeometry args={[w * 0.9, 0.3]} />
            <meshStandardMaterial map={promoTex} roughness={0.32} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main Architectural Shelf Component
// ---------------------------------------------------------------------------
export function Shelf({
  shelf,
  viewMode,
  isSelected,
  isDimmed,
  selectedPositionId,
  recentlyRestockedPositionIds,
  onSelectShelf,
  onSelectProduct,
  shopperMode = false,
  basketQuantities,
  searchMatchedProductIds,
  searchActive = false,
  lastPickedEvent,
}: {
  shelf: TwinShelfNode;
  viewMode: TwinViewMode;
  isSelected: boolean;
  isDimmed: boolean;
  selectedPositionId: string | null;
  recentlyRestockedPositionIds: ReadonlySet<string>;
  onSelectShelf: (shelf: TwinShelfNode) => void;
  onSelectProduct: (pos: TwinShelfPositionNode) => void;
  shopperMode?: boolean;
  basketQuantities?: Readonly<Record<string, number>>;
  searchMatchedProductIds?: ReadonlySet<string>;
  searchActive?: boolean;
  lastPickedEvent?: { productId: string; nonce: number } | null;
}) {
  const shelfGroupRef = React.useRef<THREE.Group>(null);
  const [hovered, setHovered] = React.useState(false);

  // Per-shelf distance LOD (runs once per shelf every 20 frames -> 18 checks total!)
  const [isNearShelf, setIsNearShelf] = React.useState(true);
  const [isHtmlRange, setIsHtmlRange] = React.useState(true);
  const lodTickRef = React.useRef(Math.floor(Math.abs(shelf.position[0] * 7 + shelf.position[2] * 3)) % 20);

  useFrame(({ camera }) => {
    lodTickRef.current = (lodTickRef.current + 1) % 20;
    if (lodTickRef.current !== 0 || !shelfGroupRef.current) return;
    shelfGroupRef.current.getWorldPosition(SHELF_WORLD_POS);
    const dist = camera.position.distanceTo(SHELF_WORLD_POS);
    const nextNear = dist < 17.5;
    const nextHtml = dist < 13.5;
    if (nextNear !== isNearShelf) setIsNearShelf(nextNear);
    if (nextHtml !== isHtmlRange) setIsHtmlRange(nextHtml);
  });

  const [w, h, d] = shelf.size;
  const isZLong = d >= w;
  const isDoubleSided =
    isZLong && shelf.kind !== "refrigerator" && shelf.kind !== "meat_counter";

  const stateStyle = INVENTORY_STATE_STYLES[shelf.visualState];
  const activeColor =
    viewMode === "heatmap"
      ? heatmapColorForState(shelf.visualState, shelf.status === "active")
      : stateStyle.color;

  const isChilled =
    shelf.kind === "refrigerator" ||
    shelf.kind === "freezer" ||
    shelf.kind === "meat_counter";
  const isDoorRefrigerator = shelf.kind === "refrigerator";
  const isMeatCounter = shelf.kind === "meat_counter";
  const isBakery = shelf.kind === "bakery_case";
  const isProduce = shelf.kind === "produce_island";
  const isCosmetics = shelf.kind === "cosmetics_shelf";
  const isElectronics = shelf.kind === "electronics_case";
  const isGondola = shelf.kind === "gondola" || isCosmetics;

  // Cached HD PBR procedural textures
  const pegboardSet = React.useMemo(
    () => (isGondola ? getPerforatedPegboardTextures() : null),
    [isGondola],
  );
  const uprightTex = React.useMemo(
    () => (isGondola ? getSlottedUprightTexture() : null),
    [isGondola],
  );
  const oakTimber = React.useMemo(
    () => (isBakery || isProduce ? getOakTimberTextures() : null),
    [isBakery, isProduce],
  );
  const chillerBackTex = React.useMemo(
    () => (isChilled ? getChillerBackwallTexture() : null),
    [isChilled],
  );
  const chalkboardTex = React.useMemo(() => {
    if (isProduce) {
      return getProduceChalkboardTexture(
        shelf.name.replace(/^Fresh\s+/i, ""),
        "Zanzibar Farm Fresh · Daily Harvest",
      );
    }
    if (isBakery) {
      return getProduceChalkboardTexture(
        "Artisan Bakery",
        "Baked Fresh Every Morning",
      );
    }
    return null;
  }, [isProduce, isBakery, shelf.name]);

  const tempGaugeTex = React.useMemo(() => {
    if (isDoorRefrigerator) return getDigitalTempTexture("3.5°C", "#38bdf8");
    if (shelf.kind === "freezer") return getDigitalTempTexture("-18°C", "#60a5fa");
    if (isMeatCounter) return getDigitalTempTexture("1.8°C", "#22d3ee");
    return null;
  }, [isDoorRefrigerator, shelf.kind, isMeatCounter]);

  const bracketGeo = React.useMemo(
    () => (isGondola ? getCantileverBracketGeometry() : null),
    [isGondola],
  );

  // Curved acrylic sneeze guard geometry for bakery & produce islands
  const sneezeGuardGeo = React.useMemo(() => {
    if (isBakery) return getCurvedGuardGeometry(0.46, w - 0.1, Math.PI * 0.42);
    if (isProduce) return getCurvedGuardGeometry(0.32, w - 0.16, Math.PI * 0.36);
    return null;
  }, [isBakery, isProduce, w]);

  const selectedSlotNode = React.useMemo(
    () =>
      selectedPositionId
        ? shelf.positions.find((p) => p.id === selectedPositionId) ?? null
        : null,
    [selectedPositionId, shelf.positions],
  );
  const hasSelectedSlotHere = Boolean(selectedSlotNode);

  // Determine which exact chiller glass door(s) should smoothly swing open (~35°)
  const doorCount = React.useMemo(
    () => (isDoorRefrigerator ? chillerDoorCountForFixture(shelf) : 0),
    [isDoorRefrigerator, shelf],
  );

  const totalColumns = Math.max(
    isDoubleSided ? shelf.slotsPerTier * 2 : shelf.slotsPerTier,
    shelf.positions.length,
  );
  const columnsPerSide = isDoubleSided
    ? Math.max(shelf.slotsPerTier, Math.ceil(totalColumns / 2))
    : Math.max(shelf.slotsPerTier, totalColumns);

  // Detect overflow continuation columns (2nd+ column for the exact same product on this shelf)
  const overflowContinuationIds = React.useMemo(() => {
    const seen = new Set<string>();
    const cont = new Set<string>();
    const sorted = [...shelf.positions].sort((a, b) => a.slotIndex - b.slotIndex);
    for (const p of sorted) {
      if (!p.product) continue;
      if (seen.has(p.product.id)) cont.add(p.id);
      else seen.add(p.product.id);
    }
    return cont;
  }, [shelf.positions]);

  const openDoorIndices = React.useMemo(() => {
    const set = new Set<number>();
    if (!isDoorRefrigerator || doorCount <= 0) return set;
    if (selectedSlotNode) {
      set.add(shelfSlotDoorIndex(shelf, selectedSlotNode.slotIndex, totalColumns));
    } else if (isSelected) {
      // Open the central paired doors when the entire chiller is inspected
      const mid = Math.floor(doorCount / 2);
      set.add(Math.max(0, mid - 1));
      set.add(Math.min(doorCount - 1, mid));
    }
    return set;
  }, [isDoorRefrigerator, doorCount, selectedSlotNode, shelf, isSelected, totalColumns]);

  const hasSearchMatch = React.useMemo(() => {
    if (!searchActive || !searchMatchedProductIds) return false;
    return shelf.positions.some(
      (p) => p.product && searchMatchedProductIds.has(p.product.id),
    );
  }, [searchActive, searchMatchedProductIds, shelf.positions]);

  const effectiveDimmed =
    (isDimmed && !isSelected) || (searchActive && !hasSearchMatch && !isSelected);

  const frameColor =
    viewMode === "heatmap"
      ? activeColor
      : isChilled
        ? "#dae8ee"
        : isBakery || isProduce
          ? "#c28e54"
          : isElectronics
            ? "#24303c"
            : isCosmetics
              ? "#f8f4f6"
              : "#edf1f2";

  const headerAccent =
    viewMode !== "realistic"
      ? activeColor
      : isChilled
        ? "#0284c7"
        : isBakery
          ? "#b45309"
          : isProduce
            ? "#15803d"
            : isCosmetics
              ? "#be185d"
              : isElectronics
                ? "#0f172a"
                : "#0f766e";

  // Kelvin-accurate LED color temperature:
  // 3000K Warm Amber for Bakery/Produce, 5500K Crisp Cool for Chillers/Meat/Freezers, 4000K Neutral Retail
  const ledEmissive =
    isBakery || isProduce
      ? "#ffdc9e"
      : isChilled
        ? "#d9f4ff"
        : isCosmetics
          ? "#fff3e6"
          : "#f8fafc";

  const opacity = effectiveDimmed ? 0.34 : 1;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectShelf(shelf);
  };

  // Slotted upright post positions along the long axis
  const longSpan = isZLong ? d : w;
  const uprightOffsets = React.useMemo(() => {
    const count = Math.max(2, Math.round(longSpan / 1.8) + 1);
    return Array.from({ length: count }, (_, i) =>
      count > 1 ? (i / (count - 1) - 0.5) * (longSpan - 0.18) : 0,
    );
  }, [longSpan]);

  const railMetalColor = isCosmetics
    ? "#d4a373"
    : isElectronics
      ? "#475569"
      : "#94a3b8";

  return (
    <group
      ref={shelfGroupRef}
      name={shelf.objectName}
      position={shelf.position}
      rotation={[0, shelf.rotationY, 0]}
    >
      {/* Structural retail fixture */}
      <group
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        {/* Recessed matte-charcoal steel kickplate + brushed stainless floor scuff-guard */}
        <mesh position={[0, 0.068, 0]} castShadow receiveShadow>
          <boxGeometry args={[w * 0.93, 0.136, d * 0.93]} />
          <meshStandardMaterial
            color="#1f2c32"
            roughness={0.58}
            metalness={0.42}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[w * 0.955, 0.028, d * 0.955]} />
          <meshStandardMaterial
            color="#64748b"
            roughness={0.35}
            metalness={0.75}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>

        {/* Main base plinth deck / lower counter cabinet */}
        <mesh
          position={[0, isBakery || isMeatCounter ? 0.36 : 0.185, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[w, isBakery || isMeatCounter ? 0.52 : 0.11, d]}
          />
          <meshStandardMaterial
            color={viewMode === "heatmap" ? activeColor : frameColor}
            map={
              viewMode === "realistic" && (isBakery || isProduce)
                ? oakTimber?.map
                : undefined
            }
            bumpMap={
              viewMode === "realistic" && (isBakery || isProduce)
                ? oakTimber?.bumpMap
                : undefined
            }
            bumpScale={0.012}
            roughness={isBakery || isProduce ? 0.65 : 0.38}
            metalness={isChilled ? 0.42 : isElectronics ? 0.48 : 0.16}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>

        {/* Cold-air intake louver grille on refrigerators, meat counters & freezers */}
        {isChilled && (
          <mesh
            position={
              isZLong
                ? [-(w / 2 + 0.009), 0.11, 0]
                : [0, 0.11, d / 2 + 0.009]
            }
          >
            <boxGeometry
              args={isZLong ? [0.016, 0.11, d * 0.9] : [w * 0.9, 0.11, 0.016]}
            />
            <meshStandardMaterial
              color="#263442"
              metalness={0.72}
              roughness={0.34}
            />
          </mesh>
        )}

        {/* Freezer island stainless cart bumper rail + sliding low-E glass lids */}
        {shelf.kind === "freezer" && (
          <group>
            <mesh position={[0, 0.86, 0]}>
              <boxGeometry args={[w + 0.1, 0.042, d + 0.1]} />
              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.86}
                roughness={0.18}
              />
            </mesh>
            {/* Insulated upper coaming rim */}
            <mesh position={[0, 0.56, 0]} castShadow receiveShadow>
              <boxGeometry args={[w * 0.98, 0.62, d * 0.98]} />
              <meshStandardMaterial
                color="#eef4f7"
                roughness={0.32}
                metalness={0.18}
              />
            </mesh>
            {/* Sliding low-E glass freezer top covers */}
            {[-w * 0.24, w * 0.24].map((lx, idx) => (
              <mesh key={`lid-${idx}`} position={[lx, h - 0.08, 0]}>
                <boxGeometry args={[w * 0.46, 0.022, d * 0.86]} />
                <meshPhysicalMaterial
                  color="#dcf4ff"
                  transparent
                  opacity={0.24}
                  roughness={0.06}
                  clearcoat={0.95}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* Perforated steel pegboard back panel (gondolas) or brushed chiller airflow backwall */}
        {h > 1.25 && (
          <mesh
            position={[
              0,
              h / 2,
              isChilled && !isZLong ? -(d / 2 - 0.05) : isZLong && isChilled ? w / 2 - 0.05 : 0,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                isZLong ? 0.052 : w - 0.08,
                h - 0.18,
                isZLong ? d - 0.08 : 0.052,
              ]}
            />
            <meshStandardMaterial
              color={
                viewMode === "heatmap"
                  ? activeColor
                  : isChilled
                    ? "#e4eff5"
                    : isElectronics
                      ? "#1e293b"
                      : "#f1f5f6"
              }
              map={
                viewMode === "realistic"
                  ? isGondola
                    ? pegboardSet?.map
                    : isChilled
                      ? chillerBackTex ?? undefined
                      : undefined
                  : undefined
              }
              bumpMap={
                viewMode === "realistic" && isGondola
                  ? pegboardSet?.bumpMap
                  : undefined
              }
              bumpScale={0.014}
              roughnessMap={
                viewMode === "realistic" && isGondola
                  ? pegboardSet?.roughnessMap
                  : undefined
              }
              roughness={isChilled ? 0.3 : 0.46}
              metalness={isChilled ? 0.58 : 0.25}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        )}

        {/* Vertical slotted steel H-uprights with keyway slot texture & stabilizer foot shoes */}
        {h > 1.25 &&
          uprightOffsets.map((offset, idx) => {
            const upPos: [number, number, number] = isZLong
              ? [isChilled ? w / 2 - 0.06 : 0, h / 2, offset]
              : [offset, h / 2, isChilled ? -(d / 2 - 0.06) : 0];
            return (
              <group key={`up-${idx}`}>
                <mesh position={upPos} castShadow>
                  <boxGeometry args={[0.062, h - 0.08, 0.062]} />
                  <meshStandardMaterial
                    color={isCosmetics ? "#cbd5e1" : "#64748b"}
                    map={
                      viewMode === "realistic" && isGondola
                        ? uprightTex ?? undefined
                        : undefined
                    }
                    metalness={0.72}
                    roughness={0.3}
                    transparent={opacity < 1}
                    opacity={opacity}
                  />
                </mesh>
                {/* Upright base foot shoe */}
                <mesh
                  position={[
                    upPos[0],
                    0.16,
                    upPos[2],
                  ]}
                >
                  <boxGeometry
                    args={isZLong ? [w * 0.86, 0.04, 0.068] : [0.068, 0.04, d * 0.86]}
                  />
                  <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.35} />
                </mesh>
              </group>
            );
          })}

        {/* Promotional End-Caps on both ends of double-sided gondolas */}
        {isDoubleSided && (
          <>
            <PromotionalEndCap
              w={w}
              h={h}
              zPosition={d / 2 + 0.02}
              facingSign={1}
              departmentCode={shelf.departmentCode}
              headline={shelf.departmentName}
              opacity={opacity}
              viewMode={viewMode}
            />
            <PromotionalEndCap
              w={w}
              h={h}
              zPosition={-(d / 2 + 0.02)}
              facingSign={-1}
              departmentCode={shelf.departmentCode}
              headline={shelf.departmentName}
              opacity={opacity}
              viewMode={viewMode}
            />
          </>
        )}

        {/* Frosted tempered acrylic side cheeks on chillers, meat counters & bakery displays */}
        {(isDoorRefrigerator || isMeatCounter || isBakery) && (
          <>
            <mesh
              position={
                isZLong
                  ? [0, h * 0.52, d / 2 - 0.02]
                  : [-(w / 2 - 0.02), h * 0.52, 0]
              }
            >
              <boxGeometry
                args={isZLong ? [w, h * 0.8, 0.036] : [0.036, h * 0.8, d]}
              />
              <meshPhysicalMaterial
                color={isBakery ? "#fef3c7" : "#e0f2fe"}
                transparent
                opacity={0.38}
                roughness={0.18}
                clearcoat={0.8}
              />
            </mesh>
            <mesh
              position={
                isZLong
                  ? [0, h * 0.52, -(d / 2 - 0.02)]
                  : [w / 2 - 0.02, h * 0.52, 0]
              }
            >
              <boxGeometry
                args={isZLong ? [w, h * 0.8, 0.036] : [0.036, h * 0.8, d]}
              />
              <meshPhysicalMaterial
                color={isBakery ? "#fef3c7" : "#e0f2fe"}
                transparent
                opacity={0.38}
                roughness={0.18}
                clearcoat={0.8}
              />
            </mesh>
          </>
        )}

        {/* Shelf tier decks + brushed aluminum C-channel ticket rails + under-shelf LED strips + true angled cantilever brackets */}
        {Array.from({ length: shelf.tiers }).map((_, idx) => {
          const y = 0.26 + idx * ((h - 0.48) / Math.max(1, shelf.tiers));
          // Authentic 18-degree tilted timber produce crates (0.314 rad)
          const tiltX = isProduce ? 0.314 : 0;
          const produceLipDrop = isProduce ? Math.sin(tiltX) * (d * 0.46) : 0;

          return (
            <group key={idx} position={[0, y, 0]}>
              {/* Main shelf deck OR 18°-tilted slatted oak timber produce crate */}
              <group rotation={[tiltX, 0, 0]}>
                <mesh
                  name={`${shelf.objectName}_Tier_${idx + 1}`}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[w * 0.96, 0.044, d * 0.96]} />
                  <meshStandardMaterial
                    color={
                      viewMode === "heatmap"
                        ? activeColor
                        : isBakery || isProduce
                          ? "#d3a16a"
                          : isElectronics
                            ? "#1f2937"
                            : "#f7fafb"
                    }
                    map={
                      viewMode === "realistic" && (isBakery || isProduce)
                        ? oakTimber?.map
                        : undefined
                    }
                    bumpMap={
                      viewMode === "realistic" && (isBakery || isProduce)
                        ? oakTimber?.bumpMap
                        : undefined
                    }
                    bumpScale={0.015}
                    roughness={isBakery || isProduce ? 0.66 : isElectronics ? 0.55 : 0.32}
                    metalness={isBakery || isProduce ? 0.04 : 0.24}
                    transparent={opacity < 1}
                    opacity={opacity}
                  />
                </mesh>

                {/* Slatted timber crate walls & dark woven produce-liner mats on produce islands */}
                {isProduce && (
                  <>
                    {/* Front timber retaining lip */}
                    <mesh position={[0, 0.048, d * 0.46]} castShadow>
                      <boxGeometry args={[w * 0.96, 0.075, 0.032]} />
                      <meshStandardMaterial
                        color="#b37f48"
                        map={oakTimber?.map}
                        roughness={0.7}
                      />
                    </mesh>
                    {/* Rear timber crate lip */}
                    <mesh position={[0, 0.055, -(d * 0.46)]} castShadow>
                      <boxGeometry args={[w * 0.96, 0.09, 0.032]} />
                      <meshStandardMaterial
                        color="#a4713c"
                        map={oakTimber?.map}
                        roughness={0.72}
                      />
                    </mesh>
                    {/* Crate divider slats creating 3 distinct produce bins */}
                    {[-w * 0.46, -w * 0.16, w * 0.16, w * 0.46].map((cx, cIdx) => (
                      <mesh key={`div-${cIdx}`} position={[cx, 0.048, 0]} castShadow>
                        <boxGeometry args={[0.034, 0.08, d * 0.92]} />
                        <meshStandardMaterial
                          color="#a4713c"
                          map={oakTimber?.map}
                          roughness={0.72}
                        />
                      </mesh>
                    ))}
                    {/* Dark woven breathable crate liner mat */}
                    <mesh position={[0, 0.024, 0]}>
                      <boxGeometry args={[w * 0.9, 0.006, d * 0.88]} />
                      <meshStandardMaterial color="#1f2937" roughness={0.92} />
                    </mesh>
                  </>
                )}

                {/* Warm brass pastry tray lip on bakery shelves */}
                {isBakery && (
                  <mesh position={[0, 0.032, d * 0.46]}>
                    <boxGeometry args={[w * 0.92, 0.032, 0.016]} />
                    <meshStandardMaterial
                      color="#d4a359"
                      metalness={0.75}
                      roughness={0.28}
                    />
                  </mesh>
                )}

                {/* Frosted acrylic vertical column dividers separating each 1-product column */}
                {!isProduce &&
                  columnsPerSide > 1 &&
                  Array.from({ length: columnsPerSide - 1 }).map((_, divIdx) => {
                    const usableSpan = (isZLong ? d : w) * 0.86;
                    const divPos =
                      -usableSpan / 2 +
                      ((divIdx + 1) / columnsPerSide) * usableSpan;
                    return (
                      <mesh
                        key={`cdiv-${divIdx}`}
                        position={
                          isZLong ? [0, 0.075, divPos] : [divPos, 0.075, 0]
                        }
                      >
                        <boxGeometry
                          args={
                            isZLong
                              ? [w * 0.9, 0.1, 0.008]
                              : [0.008, 0.1, d * 0.86]
                          }
                        />
                        <meshPhysicalMaterial
                          color="#e2f1f5"
                          transparent
                          opacity={0.42}
                          roughness={0.18}
                          clearcoat={0.7}
                        />
                      </mesh>
                    );
                  })}
              </group>

              {/* Profiled Brushed Aluminum Price-Rail C-Channel Strip holding ESLs */}
              {isZLong ? (
                <>
                  {isDoubleSided && (
                    <group position={[w * 0.486, -0.005, 0]}>
                      <mesh>
                        <boxGeometry args={[0.02, 0.056, d * 0.96]} />
                        <meshStandardMaterial
                          color={railMetalColor}
                          metalness={0.82}
                          roughness={0.22}
                        />
                      </mesh>
                      {/* Top extruded rail bead */}
                      <mesh position={[0.01, 0.026, 0]}>
                        <boxGeometry args={[0.008, 0.007, d * 0.96]} />
                        <meshStandardMaterial color="#e2e8f0" metalness={0.88} roughness={0.18} />
                      </mesh>
                    </group>
                  )}
                  <group position={[-(w * 0.486), -0.005, 0]}>
                    <mesh>
                      <boxGeometry args={[0.02, 0.056, d * 0.96]} />
                      <meshStandardMaterial
                        color={railMetalColor}
                        metalness={0.82}
                        roughness={0.22}
                      />
                    </mesh>
                    <mesh position={[-0.01, 0.026, 0]}>
                      <boxGeometry args={[0.008, 0.007, d * 0.96]} />
                      <meshStandardMaterial color="#e2e8f0" metalness={0.88} roughness={0.18} />
                    </mesh>
                  </group>
                </>
              ) : (
                <group position={[0, -produceLipDrop - 0.004, d * 0.486]}>
                  <mesh>
                    <boxGeometry args={[w * 0.96, 0.056, 0.02]} />
                    <meshStandardMaterial
                      color={railMetalColor}
                      metalness={0.82}
                      roughness={0.22}
                    />
                  </mesh>
                  <mesh position={[0, 0.026, 0.01]}>
                    <boxGeometry args={[w * 0.96, 0.007, 0.008]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.88} roughness={0.18} />
                  </mesh>
                </group>
              )}

              {/* Under-Shelf Recessed LED Light Strip + aluminum diffuser channel illuminating lower tier */}
              {idx > 0 && viewMode === "realistic" && !effectiveDimmed && (
                isZLong ? (
                  <>
                    {isDoubleSided && (
                      <group position={[w * 0.41, -0.026, 0]}>
                        <mesh position={[0, 0.004, 0]}>
                          <boxGeometry args={[0.026, 0.008, d * 0.92]} />
                          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
                        </mesh>
                        <mesh position={[0, -0.002, 0]}>
                          <boxGeometry args={[0.016, 0.008, d * 0.9]} />
                          <meshStandardMaterial
                            color={ledEmissive}
                            emissive={ledEmissive}
                            emissiveIntensity={1.32}
                            toneMapped={false}
                          />
                        </mesh>
                      </group>
                    )}
                    <group position={[-(w * 0.41), -0.026, 0]}>
                      <mesh position={[0, 0.004, 0]}>
                        <boxGeometry args={[0.026, 0.008, d * 0.92]} />
                        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
                      </mesh>
                      <mesh position={[0, -0.002, 0]}>
                        <boxGeometry args={[0.016, 0.008, d * 0.9]} />
                        <meshStandardMaterial
                          color={ledEmissive}
                          emissive={ledEmissive}
                          emissiveIntensity={1.32}
                          toneMapped={false}
                        />
                      </mesh>
                    </group>
                  </>
                ) : (
                  <group position={[0, -0.026, d * 0.41]}>
                    <mesh position={[0, 0.004, 0]}>
                      <boxGeometry args={[w * 0.92, 0.008, 0.026]} />
                      <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
                    </mesh>
                    <mesh position={[0, -0.002, 0]}>
                      <boxGeometry args={[w * 0.9, 0.008, 0.016]} />
                      <meshStandardMaterial
                        color={ledEmissive}
                        emissive={ledEmissive}
                        emissiveIntensity={1.32}
                        toneMapped={false}
                      />
                    </mesh>
                  </group>
                )
              )}

              {/* True Tapered Angled Steel Cantilever Support Brackets (ExtrudeGeometry) */}
              {isGondola &&
                bracketGeo &&
                idx > 0 &&
                uprightOffsets.map((bOff, bIdx) =>
                  isZLong ? (
                    <React.Fragment key={`br-${bIdx}`}>
                      <mesh
                        geometry={bracketGeo}
                        position={[0.03, -0.022, bOff]}
                      >
                        <meshStandardMaterial
                          color="#475569"
                          metalness={0.72}
                          roughness={0.3}
                        />
                      </mesh>
                      <mesh
                        geometry={bracketGeo}
                        position={[-0.03, -0.022, bOff]}
                        rotation={[0, Math.PI, 0]}
                      >
                        <meshStandardMaterial
                          color="#475569"
                          metalness={0.72}
                          roughness={0.3}
                        />
                      </mesh>
                    </React.Fragment>
                  ) : (
                    <mesh
                      key={`br-${bIdx}`}
                      geometry={bracketGeo}
                      position={[bOff, -0.022, 0.03]}
                      rotation={[0, -Math.PI / 2, 0]}
                    >
                      <meshStandardMaterial
                        color="#475569"
                        metalness={0.72}
                        roughness={0.3}
                      />
                    </mesh>
                  ),
                )}
            </group>
          );
        })}

        {/* Top Architectural Fascia Header / Canopy */}
        {!isProduce && (
          <mesh position={[0, h - 0.06, 0]} castShadow>
            <boxGeometry args={[w + 0.05, 0.145, d + 0.05]} />
            <meshStandardMaterial
              color={headerAccent}
              roughness={0.32}
              metalness={0.22}
              emissive={
                isSelected || hovered || hasSearchMatch ? headerAccent : "#000000"
              }
              emissiveIntensity={
                isSelected || hasSearchMatch ? 0.45 : hovered ? 0.22 : 0
              }
            />
          </mesh>
        )}

        {/* Canopy Internal High-Output LED Luminaire Tube (5500K chillers, 3000K bakery, 4000K gondolas) */}
        {!isProduce && viewMode === "realistic" && !effectiveDimmed && (
          <mesh
            position={[
              isZLong ? (isDoorRefrigerator ? -w * 0.26 : 0) : 0,
              h - 0.142,
              isZLong ? 0 : d * 0.28,
            ]}
          >
            <boxGeometry
              args={
                isZLong ? [0.055, 0.022, d * 0.9] : [w * 0.9, 0.022, 0.055]
              }
            />
            <meshStandardMaterial
              color={ledEmissive}
              emissive={ledEmissive}
              emissiveIntensity={isChilled || isBakery ? 1.55 : 1.25}
              toneMapped={false}
            />
          </mesh>
        )}

        {/* Digital LED Chiller / Freezer Temperature Gauge on Canopy */}
        {tempGaugeTex && viewMode === "realistic" && (
          <mesh
            position={
              isZLong
                ? [-(w / 2 + 0.032), h - 0.06, 0]
                : [w * 0.36, h - 0.06, d / 2 + 0.032]
            }
            rotation={[0, isZLong ? -Math.PI / 2 : 0, 0]}
          >
            <planeGeometry args={[0.24, 0.09]} />
            <meshBasicMaterial map={tempGaugeTex} />
          </mesh>
        )}

        {/* Overhead Rustic Oak Timber Sign Gantry + Chalkboard + Digital Scale on Produce Islands */}
        {isProduce && (
          <>
            <group position={[0, h + 0.56, 0]}>
              <mesh position={[-(w * 0.44), -0.32, 0]} castShadow>
                <boxGeometry args={[0.075, 0.66, 0.075]} />
                <meshStandardMaterial
                  color="#7c532d"
                  map={oakTimber?.map}
                  roughness={0.72}
                />
              </mesh>
              <mesh position={[w * 0.44, -0.32, 0]} castShadow>
                <boxGeometry args={[0.075, 0.66, 0.075]} />
                <meshStandardMaterial
                  color="#7c532d"
                  map={oakTimber?.map}
                  roughness={0.72}
                />
              </mesh>
              {/* Timber crossbar */}
              <mesh position={[0, 0.02, 0]} castShadow>
                <boxGeometry args={[w * 0.98, 0.06, 0.09]} />
                <meshStandardMaterial
                  color="#7c532d"
                  map={oakTimber?.map}
                  roughness={0.72}
                />
              </mesh>
              {/* Warm 3000K downward produce canopy LED bar */}
              {viewMode === "realistic" && (
                <mesh position={[0, -0.02, 0]}>
                  <boxGeometry args={[w * 0.84, 0.018, 0.035]} />
                  <meshStandardMaterial
                    color="#ffdc9e"
                    emissive="#ffdc9e"
                    emissiveIntensity={1.4}
                    toneMapped={false}
                  />
                </mesh>
              )}
              {/* Double-sided hanging slate chalkboard */}
              <mesh position={[0, 0.16, 0]}>
                <boxGeometry args={[w * 0.72, 0.32, 0.04]} />
                <meshStandardMaterial color="#1b2428" roughness={0.85} />
              </mesh>
              {chalkboardTex && (
                <>
                  <mesh position={[0, 0.16, 0.022]}>
                    <planeGeometry args={[w * 0.7, 0.3]} />
                    <meshStandardMaterial map={chalkboardTex} roughness={0.82} />
                  </mesh>
                  <mesh position={[0, 0.16, -0.022]} rotation={[0, Math.PI, 0]}>
                    <planeGeometry args={[w * 0.7, 0.3]} />
                    <meshStandardMaterial map={chalkboardTex} roughness={0.82} />
                  </mesh>
                </>
              )}
            </group>

            {/* Curved acrylic freshness sneeze guard along produce top rim */}
            {sneezeGuardGeo && (
              <mesh
                geometry={sneezeGuardGeo}
                position={[0, h - 0.16, d * 0.12]}
                rotation={[-0.25, 0, 0]}
              >
                <meshPhysicalMaterial
                  color="#f0fdfa"
                  transparent
                  opacity={0.18}
                  roughness={0.05}
                  clearcoat={1}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* Stainless produce weighing scale prop on end corner */}
            <group position={[w * 0.42, h - 0.18, d * 0.34]}>
              <mesh>
                <boxGeometry args={[0.24, 0.06, 0.24]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.22} />
              </mesh>
              <mesh position={[0, 0.14, -0.09]}>
                <cylinderGeometry args={[0.012, 0.012, 0.26, 10]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.27, -0.08]} rotation={[-0.25, 0, 0]}>
                <boxGeometry args={[0.18, 0.09, 0.025]} />
                <meshStandardMaterial color="#0f172a" roughness={0.3} />
              </mesh>
            </group>
          </>
        )}

        {/* Curved Acrylic Sneeze Guard + Warm Chalkboard Header for Bakery Case */}
        {isBakery && sneezeGuardGeo && (
          <group>
            <mesh
              geometry={sneezeGuardGeo}
              position={[0, h * 0.56, d * 0.14]}
              rotation={[-0.12, 0, 0]}
            >
              <meshPhysicalMaterial
                color="#fffbeb"
                transparent
                opacity={0.2}
                roughness={0.04}
                clearcoat={1}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {/* Polished brass side support struts */}
            {[-w * 0.46, 0, w * 0.46].map((sx, idx) => (
              <mesh key={`strut-${idx}`} position={[sx, h * 0.65, d * 0.52]} rotation={[-0.22, 0, 0]}>
                <cylinderGeometry args={[0.009, 0.009, h * 0.58, 10]} />
                <meshStandardMaterial color="#d4a359" metalness={0.82} roughness={0.22} />
              </mesh>
            ))}
            {chalkboardTex && (
              <mesh position={[0, h - 0.055, d / 2 + 0.032]}>
                <planeGeometry args={[w * 0.62, 0.16]} />
                <meshStandardMaterial map={chalkboardTex} roughness={0.8} />
              </mesh>
            )}
          </group>
        )}

        {/* Tempered Security Glass Showcase + Chrome Lock for Electronics */}
        {isElectronics && (
          <group>
            <mesh position={[0, h * 0.52, d / 2 + 0.022]}>
              <boxGeometry args={[w - 0.08, h * 0.72, 0.018]} />
              <meshPhysicalMaterial
                color="#e0f7ff"
                transparent
                opacity={0.2}
                roughness={0.04}
                clearcoat={1}
                depthWrite={false}
              />
            </mesh>
            {/* Chrome security showcase lock cylinder */}
            <mesh position={[0, h * 0.52, d / 2 + 0.035]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.02, 12]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.14} />
            </mesh>
          </group>
        )}
      </group>

      {/* Interactive GSAP Multi-Door Hinged Glass Doors (~35° smooth swing) on Refrigerators */}
      {isDoorRefrigerator && (
        <ChillerGlassDoors
          width={w}
          height={h}
          depth={d}
          isZLong={isZLong}
          doorCount={doorCount}
          openDoorIndices={openDoorIndices}
          showCoolLed={viewMode === "realistic" && !effectiveDimmed}
        />
      )}

      {/* Interactive GSAP Curved Panoramic Lift-Glass on Meat & Seafood Counter */}
      {isMeatCounter && (
        <MeatCounterCurvedGlass
          width={w}
          height={h}
          depth={d}
          open={isSelected || hasSelectedSlotHere}
        />
      )}

      {/* Top-of-Column Product Name Header Signs mounted above every 4-row column */}
      {viewMode !== "heatmap" &&
        shelf.positions.map((pos) => {
          const inBasket =
            pos.product && basketQuantities
              ? (basketQuantities[pos.product.id] ?? 0)
              : 0;
          const visualQty = shopperMode
            ? Math.max(0, pos.quantity - inBasket)
            : pos.quantity;
          return (
            <ShelfColumnTopHeader
              key={`col-hdr-${pos.id}`}
              shelf={shelf}
              pos={pos}
              totalColumns={totalColumns}
              effectiveQuantity={visualQty}
              isOverflowContinuation={overflowContinuationIds.has(pos.id)}
              isSelected={selectedPositionId === pos.id}
              onSelectProduct={onSelectProduct}
            />
          );
        })}

      {/* HD Electronic Shelf Labels (ESL) mounted on every column's front aluminum rail */}
      {viewMode !== "heatmap" &&
        shelf.positions.map((pos) => {
          const inBasket =
            pos.product && basketQuantities
              ? (basketQuantities[pos.product.id] ?? 0)
              : 0;
          const visualQty = shopperMode
            ? Math.max(0, pos.quantity - inBasket)
            : pos.quantity;
          return (
            <ShelfEslTag
              key={`esl-${pos.id}`}
              shelf={shelf}
              pos={pos}
              totalColumns={totalColumns}
              effectiveQuantity={visualQty}
              onSelectProduct={onSelectProduct}
            />
          );
        })}

      <ShelfInteraction
        size={shelf.size}
        color={hasSearchMatch ? "#0f766e" : activeColor}
        highlighted={isSelected || hovered || hasSearchMatch}
      />

      {/* Real database-driven products: outward facing, multi-row depth, InstancedMesh backstock */}
      <ShelfProducts
        shelf={shelf}
        viewMode={viewMode}
        selectedPositionId={selectedPositionId}
        recentlyRestockedPositionIds={recentlyRestockedPositionIds}
        onSelectProduct={onSelectProduct}
        shopperMode={shopperMode}
        basketQuantities={basketQuantities}
        searchMatchedProductIds={searchMatchedProductIds}
        searchActive={searchActive}
        lastPickedEvent={lastPickedEvent}
        isNearShelf={isNearShelf}
        isHtmlRange={isHtmlRange}
      />

      {(hovered || isSelected) && (isHtmlRange || isSelected) && (
        <Html
          position={[0, h + (isProduce ? 0.95 : 0.42), 0]}
          center
          distanceFactor={16}
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded-md border border-border bg-white px-2.5 py-1 text-xs shadow-sm">
            {shopperMode ? (
              <>
                <span className="font-semibold text-foreground">
                  {shelf.name}
                </span>
                <span className="ml-1.5 text-muted">
                  · {shelf.productCount} items
                </span>
              </>
            ) : (
              <>
                <span className="font-mono font-semibold text-primary">
                  {shelf.code}
                </span>
                <span className="ml-1.5 font-medium text-foreground">
                  {shelf.totalUnits} units
                </span>
                {shelf.lowStockCount > 0 && (
                  <span className="ml-1.5 font-medium text-warning">
                    · {shelf.lowStockCount} low
                  </span>
                )}
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
