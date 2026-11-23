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
  computeSlotFacings,
  isCylindricalProductAsset,
  type SlotFacingPlacement,
} from "@/lib/digital-twin/product-layout";
import { getProductLabelTexture } from "@/lib/digital-twin/procedural-textures";
import { formatMoney } from "@/lib/format";
import type {
  TwinShelfPositionNode,
  TwinViewMode,
} from "@/types/digital-twin";
import { ProductHighlight } from "./ProductHighlight";

export { computeSlotFacings, isCylindricalProductAsset, type SlotFacingPlacement };

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
 * Shared-geometry, Box3-grounded 3D hero product unit with shape-aware
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
    !isCyl && normalized.size.y < Math.max(normalized.size.x, normalized.size.z) * 0.58;

  // Curved cylindrical sleeve dimensions hugging bottle/can circumference
  const cylRx = normalized.size.x * 0.5 + 0.0022;
  const cylRz = normalized.size.z * 0.5 + 0.0022;
  const cylBaseR = Math.max(0.02, cylRx);
  const cylScaleZ = cylRz / cylBaseR;
  const cylLabelH =
    normalized.size.y * (assetKey.includes("can") ? 0.72 : 0.44);
  const cylLabelY =
    normalized.size.y * (assetKey.includes("can") ? 0.49 : 0.43);

  // Flat box/carton front & top face label dimensions
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
      {showLabel && labelTexture && (
        isCyl ? (
          <mesh
            position={[0, cylLabelY, 0]}
            scale={[1, 1, cylScaleZ]}
          >
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
                  args={[
                    normalized.size.x * 0.84,
                    normalized.size.z * 0.82,
                  ]}
                />
                <meshStandardMaterial
                  map={labelTexture}
                  roughness={0.34}
                  metalness={0.04}
                />
              </mesh>
            )}
          </>
        )
      )}
    </group>
  );
}

/**
 * Interactive front-hero product slot component.
 * Renders the animated hero facing (with GSAP pick-up & inspect, flying pick-off
 * arc animation on Add, curved/front HD CanvasTexture label, volumetric search
 * spotlight cone, and distance-gated <Html> badge). Repeated back-row stock and
 * distant facings are batched into InstancedMesh by ShelfProducts.
 */
export function ProductModel({
  positionNode,
  localPosition,
  localRotationY = 0,
  tiltX = 0,
  heroPlacement,
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
  localPosition: [number, number, number];
  localRotationY?: number;
  tiltX?: number;
  heroPlacement: SlotFacingPlacement | null;
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
  const groupRef = React.useRef<THREE.Group>(null);
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

  // Should we render the interactive hero mesh here (vs batched in InstancedMesh when far)?
  const renderInteractiveHero =
    !isEmpty &&
    heroPlacement !== null &&
    (isNearShelf || isSelected || isSearchMatch || hovered);

  // Per-product HD retail packaging CanvasTexture (photo + brand band + pack badge + price + barcode).
  const labelTexture = React.useMemo(() => {
    if (!product || viewMode === "heatmap" || !renderInteractiveHero) return null;
    return getProductLabelTexture({
      productId: product.id,
      name: product.name,
      categoryName: product.categoryName,
      priceText: formatMoney(product.price),
      barcode: product.barcode,
      imageUrl: product.imageUrl,
    });
  }, [product, viewMode, renderInteractiveHero]);

  // GSAP post-commit restocking bounce animation when warehouse restock arrives.
  React.useEffect(() => {
    if (!isRecentlyRestocked || !groupRef.current) return;
    const target = groupRef.current;
    gsap.killTweensOf(target.scale);
    gsap.killTweensOf(target.position);
    gsap.fromTo(
      target.scale,
      { x: 0.25, y: 0.25, z: 0.25 },
      { x: 1, y: 1, z: 1, duration: 0.65, ease: "back.out(1.7)" },
    );
    gsap.fromTo(
      target.position,
      { y: localPosition[1] + 0.28 },
      { y: localPosition[1], duration: 0.6, ease: "bounce.out" },
    );
  }, [isRecentlyRestocked, localPosition]);

  // GSAP Pick-Up & Inspect animation: smoothly slides the front-most 3D item
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

  // GSAP tactile "Add to Basket" crisp arc animation off the shelf into basket,
  // followed by the next unit smoothly sliding forward from back stock.
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

  // Gentle slow inspection rotation while selected + pulsing search spotlight cone.
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

  return (
    <group
      ref={groupRef}
      name={positionNode.objectName}
      position={localPosition}
      rotation={[0, localRotationY, 0]}
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
      {/* Invisible generous click/hover hit volume when far or instanced */}
      {!renderInteractiveHero && !isEmpty && (
        <mesh position={[0, 0.14, -0.05]}>
          <boxGeometry args={[0.36, 0.28, 0.28]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Empty slot restock/out-of-stock deck indicator */}
      {isEmpty ? (
        <mesh position={[0, 0.018, 0]}>
          <boxGeometry args={[0.26, 0.028, 0.18]} />
          <meshStandardMaterial
            color={product ? "#dc2626" : "#94a3b8"}
            transparent
            opacity={viewMode === "realistic" && !isSelected ? 0.28 : 0.78}
            emissive={product ? "#b91c1c" : "#64748b"}
            emissiveIntensity={product ? 0.35 : 0.08}
          />
        </mesh>
      ) : (
        renderInteractiveHero &&
        heroPlacement && (
          <group rotation={[tiltX, 0, 0]}>
            <group position={[heroPlacement.xOffset, 0, heroPlacement.zBack]}>
              <group ref={heroUnitRef}>
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
        )
      )}

      {/* Volumetric-style translucent 3D Search Spotlight Beam on matching slots */}
      {isSearchMatch && (
        <mesh ref={spotlightConeRef} position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.06, 0.22, 0.5, 20, 1, true]} />
          <meshBasicMaterial
            color="#14b8a6"
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Spotlight beacon / operational status bar */}
      {(viewMode !== "realistic" ||
        isSelected ||
        isRecentlyRestocked ||
        isSearchMatch) && (
        <mesh position={[0, 0.012, 0.14]}>
          <boxGeometry args={[0.26, 0.02, 0.03]} />
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

      {/* Distance-gated <Html> portal (strictly skipped beyond 14m unless selected/matched) */}
      {(hovered || isSelected || isSearchMatch) &&
        product &&
        (isHtmlRange || isSelected || isSearchMatch) && (
          <Html
            position={[0, 0.44, 0]}
            center
            distanceFactor={12}
            style={{ pointerEvents: "none" }}
          >
            <div className="whitespace-nowrap rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
              <span className="font-semibold">{product.name}</span>
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
                  {positionNode.quantity} on shelf
                </span>
              )}
            </div>
          </Html>
        )}
    </group>
  );
}
