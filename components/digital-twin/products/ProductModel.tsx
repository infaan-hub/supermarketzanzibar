"use client";

import * as React from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import {
  INVENTORY_STATE_STYLES,
  heatmapColorForState,
} from "@/lib/digital-twin/inventory-state";
import { getAssetEntry } from "@/lib/digital-twin/asset-manifest";
import {
  computeColumnFacings,
  computeSlotFacings,
  filledRowCount,
  isCylindricalProductAsset,
  type ColumnRowFacing,
  type SlotFacingPlacement,
} from "@/lib/digital-twin/product-layout";
import { getProductLabelTexture } from "@/lib/digital-twin/procedural-textures";
import type { Vec3 } from "@/lib/digital-twin/spatial-plan";
import { formatMoney } from "@/lib/format";
import type {
  TwinShelfPositionNode,
  TwinViewMode,
} from "@/types/digital-twin";
import { ProductHighlight } from "./ProductHighlight";

export {
  computeColumnFacings,
  computeSlotFacings,
  isCylindricalProductAsset,
  type ColumnRowFacing,
  type SlotFacingPlacement,
};

export interface GltfMeshPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  localMatrix: THREE.Matrix4;
}

export interface NormalizedGltfData {
  parts: GltfMeshPart[];
  /** Y offset required to place the bounding-box bottom dead-flush at y = 0. */
  groundOffsetY: number;
  /** X & Z offsets to center the bounding box symmetrically around (0, y, 0). */
  centerOffsetX: number;
  centerOffsetZ: number;
  size: THREE.Vector3;
}

const normalizedGltfCache = new Map<string, NormalizedGltfData>();
const tintedMaterialCache = new Map<string, THREE.Material>();

/**
 * Measure any GLB once on load using `THREE.Box3` so every bottle, jar, carton,
 * and box sits dead-flush at `y = 0` and centered horizontally with zero clipping.
 */
export function extractNormalizedGltf(
  assetPath: string,
  scene: THREE.Object3D,
): NormalizedGltfData {
  const cached = normalizedGltfCache.get(assetPath);
  if (cached) return cached;

  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  if (size.y < 0.01) size.set(0.14, 0.22, 0.12);
  const groundOffsetY = Number.isFinite(box.min.y) ? -box.min.y : 0;
  const centerOffsetX = Number.isFinite(center.x) ? -center.x : 0;
  const centerOffsetZ = Number.isFinite(center.z) ? -center.z : 0;

  const parts: GltfMeshPart[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const mat = Array.isArray(child.material)
        ? child.material[0]
        : child.material;
      if (!mat) return;
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      child.matrixWorld.decompose(pos, quat, scl);
      const rot = new THREE.Euler().setFromQuaternion(quat);
      const localMatrix = new THREE.Matrix4().compose(pos, quat, scl);
      parts.push({
        geometry: child.geometry,
        material: mat,
        position: pos,
        quaternion: quat,
        rotation: rot,
        scale: scl,
        localMatrix,
      });
    }
  });

  const data: NormalizedGltfData = {
    parts,
    groundOffsetY,
    centerOffsetX,
    centerOffsetZ,
    size,
  };
  normalizedGltfCache.set(assetPath, data);
  return data;
}

export function getTintedMaterial(
  base: THREE.Material,
  tintColor: string,
): THREE.Material {
  const key = `${base.uuid}|${tintColor}`;
  const existing = tintedMaterialCache.get(key);
  if (existing) return existing;

  const cloned = base.clone();
  if (cloned instanceof THREE.MeshStandardMaterial) {
    cloned.emissive = new THREE.Color(tintColor);
    cloned.emissiveIntensity = 0.36;
  }
  tintedMaterialCache.set(key, cloned);
  return cloned;
}

/**
 * Shared-geometry, Box3-grounded 3D product unit with shape-aware
 * HD CanvasTexture packaging wrap (curved cylinder sleeve for bottles/cans,
 * flush front & top face wrap for cartons/boxes/trays).
 */
function GroundedHeroProductUnit({
  assetPath,
  assetKey,
  tintColor,
  applyTint,
  labelTexture,
  showLabel,
}: {
  assetPath: string;
  assetKey: string;
  tintColor: string;
  applyTint: boolean;
  labelTexture: THREE.CanvasTexture | null;
  showLabel: boolean;
}) {
  const { scene } = useGLTF(assetPath);
  const entry = getAssetEntry(assetKey);
  const baseScale = entry?.defaultScale ?? [1.15, 1.15, 1.15];

  const normalized = React.useMemo(
    () => extractNormalizedGltf(assetPath, scene),
    [assetPath, scene],
  );

  const isCyl = isCylindricalProductAsset(assetKey);
  const isLowTray =
    !isCyl &&
    normalized.size.y < Math.max(normalized.size.x, normalized.size.z) * 0.58;

  const cylRx = normalized.size.x * 0.5 + 0.0022;
  const cylRz = normalized.size.z * 0.5 + 0.0022;
  const cylBaseR = Math.max(0.02, cylRx);
  const cylScaleZ = cylRz / cylBaseR;
  const cylLabelH =
    normalized.size.y * (assetKey.includes("can") ? 0.72 : 0.44);
  const cylLabelY =
    normalized.size.y * (assetKey.includes("can") ? 0.49 : 0.43);

  const boxLabelW = Math.max(0.052, normalized.size.x * 0.86);
  const boxLabelH = Math.max(
    0.028,
    normalized.size.y * (assetKey.includes("milk") ? 0.68 : 0.76),
  );
  const boxLabelY =
    normalized.size.y * (assetKey.includes("milk") ? 0.42 : 0.49);
  const boxLabelZ = normalized.size.z * 0.5 + 0.0028;

  return (
    <group scale={baseScale}>
      <group
        position={[
          normalized.centerOffsetX,
          normalized.groundOffsetY,
          normalized.centerOffsetZ,
        ]}
      >
        {normalized.parts.map((part, idx) => (
          <mesh
            key={idx}
            geometry={part.geometry}
            material={
              applyTint
                ? getTintedMaterial(part.material, tintColor)
                : part.material
            }
            position={part.position}
            rotation={part.rotation}
            scale={part.scale}
            castShadow
            receiveShadow
          />
        ))}
      </group>

      {/* Shape-aware live HD packaging label */}
      {showLabel &&
        labelTexture &&
        (isCyl ? (
          <mesh position={[0, cylLabelY, 0]} scale={[1, 1, cylScaleZ]}>
            <cylinderGeometry
              args={[
                cylBaseR,
                cylBaseR,
                cylLabelH,
                24,
                1,
                true,
                -Math.PI * 0.42,
                Math.PI * 0.84,
              ]}
            />
            <meshStandardMaterial
              map={labelTexture}
              roughness={0.3}
              metalness={0.06}
            />
          </mesh>
        ) : (
          <>
            <mesh position={[0, boxLabelY, boxLabelZ]}>
              <planeGeometry args={[boxLabelW, boxLabelH]} />
              <meshStandardMaterial
                map={labelTexture}
                roughness={0.34}
                metalness={0.04}
              />
            </mesh>
            {isLowTray && (
              <mesh
                position={[0, normalized.size.y + 0.0025, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry
                  args={[normalized.size.x * 0.84, normalized.size.z * 0.82]}
                />
                <meshStandardMaterial
                  map={labelTexture}
                  roughness={0.34}
                  metalness={0.04}
                />
              </mesh>
            )}
          </>
        ))}
    </group>
  );
}

/**
 * Interactive 4-row vertical single-product column component.
 * Renders the front-labeled showcase units across all 4 stocked rows of ONE
 * product column (eye-level row animates with GSAP pick-up & inspect + Add-to-Basket
 * pick-off arc), while all side & back-row depth units across all 4 rows batch
 * cleanly into GPU InstancedMesh in ShelfProducts.
 */
export function ProductModel({
  positionNode,
  localPosition,
  rowLocalPositions,
  localRotationY = 0,
  tiltX = 0,
  columnWidth = 1.2,
  frontRowFacings,
  effectiveQuantity,
  viewMode,
  isSelected,
  isRecentlyRestocked,
  onSelect,
  shopperMode = false,
  basketQuantity = 0,
  isSearchMatch = false,
  searchActive = false,
  pickNonce = 0,
  isNearShelf = true,
  isHtmlRange = true,
}: {
  positionNode: TwinShelfPositionNode;
  localPosition: Vec3;
  rowLocalPositions: Vec3[];
  localRotationY?: number;
  tiltX?: number;
  columnWidth?: number;
  frontRowFacings: ColumnRowFacing[];
  effectiveQuantity: number;
  viewMode: TwinViewMode;
  isSelected: boolean;
  isRecentlyRestocked: boolean;
  onSelect: (pos: TwinShelfPositionNode) => void;
  shopperMode?: boolean;
  basketQuantity?: number;
  isSearchMatch?: boolean;
  searchActive?: boolean;
  pickNonce?: number;
  isNearShelf?: boolean;
  isHtmlRange?: boolean;
}) {
  const columnGroupRef = React.useRef<THREE.Group>(null);
  const heroUnitRef = React.useRef<THREE.Group>(null);
  const spotlightConeRef = React.useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = React.useState(false);

  const effectiveState = isRecentlyRestocked
    ? "restocking"
    : effectiveQuantity <= 0
      ? "out"
      : effectiveQuantity <= positionNode.reorderLevel
        ? "low"
        : positionNode.visualState;

  const stateStyle = INVENTORY_STATE_STYLES[effectiveState];
  const heatmapColor = heatmapColorForState(effectiveState, true);

  const product = positionNode.product;
  const isEmpty = !product || effectiveQuantity <= 0;
  const rowsFilled = product
    ? filledRowCount(effectiveQuantity, 4, positionNode.maximumCapacity)
    : 0;

  const renderInteractiveRows =
    !isEmpty &&
    frontRowFacings.length > 0 &&
    (isNearShelf || isSelected || isSearchMatch || hovered);

  // Per-product HD retail packaging CanvasTexture shared across all 4 rows in this column.
  const labelTexture = React.useMemo(() => {
    if (!product || viewMode === "heatmap" || !renderInteractiveRows) return null;
    return getProductLabelTexture({
      productId: product.id,
      name: product.name,
      categoryName: product.categoryName,
      priceText: formatMoney(product.price),
      barcode: product.barcode,
      imageUrl: product.imageUrl,
    });
  }, [product, viewMode, renderInteractiveRows]);

  // GSAP post-commit restocking bounce animation when warehouse restock arrives.
  React.useEffect(() => {
    if (!isRecentlyRestocked || !columnGroupRef.current) return;
    const target = columnGroupRef.current;
    gsap.killTweensOf(target.scale);
    gsap.fromTo(
      target.scale,
      { x: 0.78, y: 0.78, z: 0.78 },
      { x: 1, y: 1, z: 1, duration: 0.65, ease: "back.out(1.7)" },
    );
  }, [isRecentlyRestocked]);

  // GSAP Pick-Up & Inspect animation: smoothly slides the eye-level hero item
  // forward (+0.18m along its outward aisle normal) for close label inspection.
  React.useEffect(() => {
    const hero = heroUnitRef.current;
    if (!hero) return;
    gsap.killTweensOf(hero.position);
    gsap.killTweensOf(hero.rotation);
    if (isSelected && !isEmpty) {
      gsap.to(hero.position, {
        z: 0.18,
        y: 0.048,
        duration: 0.45,
        ease: "power2.out",
      });
    } else {
      gsap.to(hero.position, {
        z: 0,
        y: 0,
        duration: 0.35,
        ease: "power2.inOut",
      });
      gsap.to(hero.rotation, {
        y: 0,
        duration: 0.35,
        ease: "power2.inOut",
      });
    }
  }, [isSelected, isEmpty]);

  // GSAP tactile "Add to Basket" crisp arc animation off the shelf into basket.
  React.useEffect(() => {
    if (!pickNonce || !heroUnitRef.current) return;
    const hero = heroUnitRef.current;
    gsap.killTweensOf(hero.position);
    gsap.killTweensOf(hero.scale);

    const tl = gsap.timeline();
    tl.to(hero.position, {
      y: 0.3,
      z: 0.42,
      duration: 0.26,
      ease: "power2.out",
    })
      .to(
        hero.scale,
        { x: 0.35, y: 0.35, z: 0.35, duration: 0.24, ease: "power2.in" },
        "<0.05",
      )
      .set(hero.position, { y: 0, z: -0.14 })
      .set(hero.scale, { x: 0.92, y: 0.92, z: 0.92 })
      .to(hero.position, {
        y: isSelected ? 0.048 : 0,
        z: isSelected ? 0.18 : 0,
        duration: 0.32,
        ease: "power2.out",
      })
      .to(
        hero.scale,
        { x: 1, y: 1, z: 1, duration: 0.28, ease: "back.out(1.4)" },
        "<",
      );
  }, [pickNonce, isSelected]);

  useFrame(({ clock }, delta) => {
    if (isSelected && heroUnitRef.current && !isEmpty) {
      heroUnitRef.current.rotation.y += Math.min(delta, 0.05) * 0.65;
    }
    if (isSearchMatch && spotlightConeRef.current) {
      const mat = spotlightConeRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + Math.sin(clock.getElapsedTime() * 4.2) * 0.07;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(positionNode);
  };

  const applyTint =
    viewMode === "heatmap" ||
    (viewMode === "inventory" && effectiveState !== "normal") ||
    isSelected ||
    isSearchMatch;

  const activeColor = isSearchMatch
    ? "#0d9488"
    : viewMode === "heatmap"
      ? heatmapColor
      : stateStyle.color;

  const baseRowPos = rowLocalPositions[0] ?? localPosition;
  const topRowPos = rowLocalPositions[rowLocalPositions.length - 1] ?? localPosition;
  const columnHeightSpan = Math.max(0.65, topRowPos[1] - baseRowPos[1] + 0.36);

  return (
    <group
      ref={columnGroupRef}
      name={positionNode.objectName}
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
      {/* Generous vertical column hit box spanning all 4 rows for easy clicking */}
      <group position={baseRowPos} rotation={[0, localRotationY, 0]}>
        <mesh position={[0, columnHeightSpan * 0.48, -0.05]}>
          <boxGeometry args={[Math.max(0.45, columnWidth * 0.85), columnHeightSpan, 0.32]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* Empty 4-row column indicator when unassigned or out of stock */}
      {isEmpty ? (
        rowLocalPositions.map((rPos, rIdx) => (
          <group key={`empty-${rIdx}`} position={rPos} rotation={[0, localRotationY, 0]}>
            <mesh position={[0, 0.016, 0]}>
              <boxGeometry args={[Math.min(0.42, columnWidth * 0.55), 0.024, 0.18]} />
              <meshStandardMaterial
                color={product ? "#dc2626" : "#94a3b8"}
                transparent
                opacity={viewMode === "realistic" && !isSelected ? 0.24 : 0.72}
                emissive={product ? "#b91c1c" : "#64748b"}
                emissiveIntensity={product ? 0.32 : 0.06}
              />
            </mesh>
          </group>
        ))
      ) : (
        renderInteractiveRows &&
        frontRowFacings.map((facing) => {
          const rPos = rowLocalPositions[facing.shelfRowIndex] ?? localPosition;
          return (
            <group
              key={`row-${facing.shelfRowIndex}-${facing.col}`}
              position={rPos}
              rotation={[0, localRotationY, 0]}
            >
              <group rotation={[tiltX, 0, 0]}>
                <group position={[facing.xOffset, 0, facing.zBack]}>
                  <group ref={facing.isHero ? heroUnitRef : undefined}>
                    <React.Suspense
                      fallback={
                        <mesh position={[0, 0.11, 0]} castShadow>
                          <boxGeometry args={[0.14, 0.22, 0.12]} />
                          <meshStandardMaterial color={activeColor} />
                        </mesh>
                      }
                    >
                      <GroundedHeroProductUnit
                        assetPath={product.assetPath}
                        assetKey={product.assetKey}
                        tintColor={activeColor}
                        applyTint={applyTint}
                        labelTexture={labelTexture}
                        showLabel={!searchActive || isSearchMatch || isSelected}
                      />
                    </React.Suspense>
                  </group>
                </group>
              </group>
            </group>
          );
        })
      )}

      {/* Volumetric-style translucent 3D Search Spotlight Beam illuminating the column */}
      {isSearchMatch && (
        <group position={localPosition} rotation={[0, localRotationY, 0]}>
          <mesh ref={spotlightConeRef} position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.08, 0.28, 1.35, 20, 1, true]} />
            <meshBasicMaterial
              color="#14b8a6"
              transparent
              opacity={0.22}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* Operational / active column highlight strip at column base */}
      <group position={baseRowPos} rotation={[0, localRotationY, 0]}>
        {(viewMode !== "realistic" ||
          isSelected ||
          isRecentlyRestocked ||
          isSearchMatch) && (
          <mesh position={[0, 0.012, 0.14]}>
            <boxGeometry args={[Math.min(0.46, columnWidth * 0.6), 0.02, 0.032]} />
            <meshStandardMaterial
              color={activeColor}
              emissive={activeColor}
              emissiveIntensity={isSearchMatch ? 1.35 : 0.7}
              toneMapped={false}
            />
          </mesh>
        )}

        <ProductHighlight
          color={
            isSearchMatch
              ? "#0d9488"
              : basketQuantity > 0 && shopperMode
                ? "#0f766e"
                : activeColor
          }
          active={
            isSelected ||
            hovered ||
            isRecentlyRestocked ||
            isSearchMatch ||
            (shopperMode && basketQuantity > 0)
          }
        />
      </group>

      {/* Distance-gated <Html> badge centered over column (skipped > 14m unless selected/matched) */}
      {(hovered || isSelected || isSearchMatch) &&
        product &&
        (isHtmlRange || isSelected || isSearchMatch) && (
          <Html
            position={[localPosition[0], topRowPos[1] + 0.42, localPosition[2]]}
            center
            distanceFactor={12}
            style={{ pointerEvents: "none" }}
          >
            <div className="whitespace-nowrap rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
              <span className="font-semibold">{product.name}</span>
              <span className="ml-1.5 rounded bg-surface-subtle px-1 py-0.5 font-mono text-[10px] text-muted">
                {rowsFilled}/4 rows
              </span>
              {shopperMode ? (
                <>
                  <span className="ml-1.5 font-semibold text-primary tabular-nums">
                    {formatMoney(product.price)}
                  </span>
                  <span className="ml-1.5 text-muted">
                    ·{" "}
                    {effectiveQuantity > 0
                      ? `${effectiveQuantity} left`
                      : "Out"}
                  </span>
                  {basketQuantity > 0 && (
                    <span className="ml-1.5 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      In basket: {basketQuantity}
                    </span>
                  )}
                </>
              ) : (
                <span className="ml-1.5 font-mono text-primary">
                  {positionNode.quantity}/{positionNode.maximumCapacity}
                </span>
              )}
            </div>
          </Html>
        )}
    </group>
  );
}
