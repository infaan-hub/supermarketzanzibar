"use client";

import * as React from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getAssetEntry } from "@/lib/digital-twin/asset-manifest";
import {
  INVENTORY_STATE_STYLES,
  heatmapColorForState,
} from "@/lib/digital-twin/inventory-state";
import { shelfSlotLocalLayout } from "@/lib/digital-twin/spatial-plan";
import type {
  TwinShelfNode,
  TwinShelfPositionNode,
  TwinViewMode,
} from "@/types/digital-twin";
import {
  ProductModel,
  computeSlotFacings,
  extractNormalizedGltf,
  getTintedMaterial,
  type SlotFacingPlacement,
} from "@/components/digital-twin/products/ProductModel";

interface InstancedUnitTransform {
  localPosition: [number, number, number];
  localRotationY: number;
  tiltX: number;
  xOffset: number;
  zBack: number;
  jitterY: number;
}

interface InstancedAssetBucket {
  assetPath: string;
  assetKey: string;
  tintColor: string;
  applyTint: boolean;
  transforms: InstancedUnitTransform[];
}

const TEMP_MAT_SLOT = new THREE.Matrix4();
const TEMP_MAT_TILT = new THREE.Matrix4();
const TEMP_MAT_UNIT = new THREE.Matrix4();
const TEMP_MAT_SCALE = new THREE.Matrix4();
const TEMP_MAT_GROUND = new THREE.Matrix4();
const TEMP_MAT_FINAL = new THREE.Matrix4();
const TEMP_EULER = new THREE.Euler();
const TEMP_QUAT = new THREE.Quaternion();
const TEMP_POS = new THREE.Vector3();
const TEMP_SCL = new THREE.Vector3();

/**
 * Batched GPU InstancedMesh pool for all repeated back-row stock and distant
 * product facings sharing one GLB asset on a shelf. Cuts draw calls by ~80%
 * while preserving exact Box3 grounding and shelf orientation.
 */
function InstancedProductPool({
  bucket,
}: {
  bucket: InstancedAssetBucket;
}) {
  const { scene } = useGLTF(bucket.assetPath);
  const entry = getAssetEntry(bucket.assetKey);
  const scaleX = entry?.defaultScale[0] ?? 1.15;
  const scaleY = entry?.defaultScale[1] ?? 1.15;
  const scaleZ = entry?.defaultScale[2] ?? 1.15;

  const normalized = React.useMemo(
    () => extractNormalizedGltf(bucket.assetPath, scene),
    [bucket.assetPath, scene],
  );

  const count = bucket.transforms.length;
  const meshRefs = React.useRef<Array<THREE.InstancedMesh | null>>([]);

  React.useLayoutEffect(() => {
    if (count === 0) return;

    TEMP_MAT_SCALE.makeScale(scaleX, scaleY, scaleZ);
    TEMP_MAT_GROUND.makeTranslation(
      normalized.centerOffsetX,
      normalized.groundOffsetY,
      normalized.centerOffsetZ,
    );

    normalized.parts.forEach((part, partIdx) => {
      const mesh = meshRefs.current[partIdx];
      if (!mesh) return;

      for (let i = 0; i < count; i += 1) {
        const t = bucket.transforms[i];

        // 1. Slot position & outward aisle Y rotation
        TEMP_POS.set(t.localPosition[0], t.localPosition[1], t.localPosition[2]);
        TEMP_EULER.set(0, t.localRotationY, 0);
        TEMP_QUAT.setFromEuler(TEMP_EULER);
        TEMP_SCL.set(1, 1, 1);
        TEMP_MAT_SLOT.compose(TEMP_POS, TEMP_QUAT, TEMP_SCL);

        // 2. Crate tilt (e.g. 18° on produce islands)
        if (t.tiltX !== 0) {
          TEMP_MAT_TILT.makeRotationX(t.tiltX);
          TEMP_MAT_SLOT.multiply(TEMP_MAT_TILT);
        }

        // 3. Per-unit column/row offset & subtle hand-stocked yaw jitter
        TEMP_POS.set(t.xOffset, 0, t.zBack);
        TEMP_EULER.set(0, t.jitterY, 0);
        TEMP_QUAT.setFromEuler(TEMP_EULER);
        TEMP_MAT_UNIT.compose(TEMP_POS, TEMP_QUAT, TEMP_SCL);

        // 4. Compose: slot -> unit -> asset baseScale -> Box3 grounding -> GLB mesh part
        TEMP_MAT_FINAL.copy(TEMP_MAT_SLOT)
          .multiply(TEMP_MAT_UNIT)
          .multiply(TEMP_MAT_SCALE)
          .multiply(TEMP_MAT_GROUND)
          .multiply(part.localMatrix);

        mesh.setMatrixAt(i, TEMP_MAT_FINAL);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [bucket.transforms, count, normalized, scaleX, scaleY, scaleZ]);

  if (count === 0) return null;

  return (
    <group name={`Instanced_${bucket.assetKey}`}>
      {normalized.parts.map((part, partIdx) => (
        <instancedMesh
          key={`${partIdx}-${count}`}
          ref={(el) => {
            meshRefs.current[partIdx] = el;
          }}
          args={[
            part.geometry,
            bucket.applyTint
              ? getTintedMaterial(part.material, bucket.tintColor)
              : part.material,
            count,
          ]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

export function ShelfProducts({
  shelf,
  viewMode,
  selectedPositionId,
  recentlyRestockedPositionIds,
  onSelectProduct,
  shopperMode = false,
  basketQuantities,
  searchMatchedProductIds,
  searchActive = false,
  lastPickedEvent,
  isNearShelf = true,
  isHtmlRange = true,
}: {
  shelf: TwinShelfNode;
  viewMode: TwinViewMode;
  selectedPositionId: string | null;
  recentlyRestockedPositionIds: ReadonlySet<string>;
  onSelectProduct: (pos: TwinShelfPositionNode) => void;
  shopperMode?: boolean;
  basketQuantities?: Readonly<Record<string, number>>;
  searchMatchedProductIds?: ReadonlySet<string>;
  searchActive?: boolean;
  lastPickedEvent?: { productId: string; nonce: number } | null;
  isNearShelf?: boolean;
  isHtmlRange?: boolean;
}) {
  const [w, , d] = shelf.size;
  const isZLong = d >= w;
  const isDoubleSided =
    isZLong && shelf.kind !== "refrigerator" && shelf.kind !== "meat_counter";
  const maxDepthBack = isDoubleSided
    ? Math.max(0.24, w * 0.34)
    : Math.max(0.28, Math.min(w, d) * 0.56);

  // Precompute all slot layouts, effective quantities (decremented live when picked),
  // hero units, and batched InstancedMesh buckets for backstock & distant facings.
  const { slotEntries, instancedBuckets } = React.useMemo(() => {
    const entries: Array<{
      pos: TwinShelfPositionNode;
      layout: ReturnType<typeof shelfSlotLocalLayout>;
      effectiveQty: number;
      basketQty: number;
      isSelected: boolean;
      isSearchMatch: boolean;
      heroPlacement: SlotFacingPlacement | null;
    }> = [];

    const bucketMap = new Map<string, InstancedAssetBucket>();

    for (const pos of shelf.positions) {
      const layout = shelfSlotLocalLayout(shelf, pos.slotIndex);
      const basketQty =
        pos.product && basketQuantities
          ? (basketQuantities[pos.product.id] ?? 0)
          : 0;
      const effectiveQty = pos.product
        ? shopperMode
          ? Math.max(0, pos.quantity - basketQty)
          : pos.quantity
        : 0;
      const isSelected = selectedPositionId === pos.id;
      const isSearchMatch = Boolean(
        searchActive &&
          pos.product &&
          searchMatchedProductIds?.has(pos.product.id),
      );

      let heroPlacement: SlotFacingPlacement | null = null;

      if (pos.product && effectiveQty > 0) {
        const facings = computeSlotFacings({
          quantity: effectiveQty,
          assetKey: pos.product.assetKey,
          maxDepthBack,
          slotSeed: pos.slotIndex + 1,
        });

        heroPlacement = facings.find((f) => f.isHero) ?? facings[0] ?? null;

        const effectiveState = recentlyRestockedPositionIds.has(pos.id)
          ? "restocking"
          : effectiveQty <= pos.reorderLevel
            ? "low"
            : pos.visualState;
        const applyTint =
          viewMode === "heatmap" ||
          (viewMode === "inventory" && effectiveState !== "normal") ||
          isSelected ||
          isSearchMatch;
        const tintColor = isSearchMatch
          ? "#0d9488"
          : viewMode === "heatmap"
            ? heatmapColorForState(effectiveState, true)
            : INVENTORY_STATE_STYLES[effectiveState].color;

        for (const f of facings) {
          // Nearby hero unit renders via ProductModel (with HD packaging label & GSAP animations).
          // All secondary front units, rear depth rows, and distant shelf units batch into InstancedMesh!
          const handledByHero =
            f.isHero && (isNearShelf || isSelected || isSearchMatch);
          if (handledByHero) continue;

          // Distance LOD: beyond 16.5m, skip rear depth rows (> 0) to cut GPU work further.
          if (!isNearShelf && f.row > 0) continue;

          const bKey = `${pos.product.assetPath}|${applyTint ? tintColor : "base"}`;
          let bucket = bucketMap.get(bKey);
          if (!bucket) {
            bucket = {
              assetPath: pos.product.assetPath,
              assetKey: pos.product.assetKey,
              tintColor,
              applyTint,
              transforms: [],
            };
            bucketMap.set(bKey, bucket);
          }
          bucket.transforms.push({
            localPosition: layout.localPosition,
            localRotationY: layout.localRotationY,
            tiltX: layout.tiltX,
            xOffset: f.xOffset,
            zBack: f.zBack,
            jitterY: f.jitterY,
          });
        }
      }

      entries.push({
        pos,
        layout,
        effectiveQty,
        basketQty,
        isSelected,
        isSearchMatch,
        heroPlacement,
      });
    }

    return {
      slotEntries: entries,
      instancedBuckets: Array.from(bucketMap.values()),
    };
  }, [
    shelf,
    basketQuantities,
    shopperMode,
    selectedPositionId,
    searchActive,
    searchMatchedProductIds,
    maxDepthBack,
    recentlyRestockedPositionIds,
    viewMode,
    isNearShelf,
  ]);

  return (
    <group name={`${shelf.objectName}_Products`}>
      {/* Batched InstancedMesh backstock & distant facings (cuts draw calls ~80%) */}
      <React.Suspense fallback={null}>
        {instancedBuckets.map((bucket) => (
          <InstancedProductPool
            key={`${bucket.assetPath}-${bucket.applyTint ? bucket.tintColor : "base"}`}
            bucket={bucket}
          />
        ))}
      </React.Suspense>

      {/* Interactive front-hero product slots with HD packaging labels & GSAP pick animations */}
      {slotEntries.map(
        ({
          pos,
          layout,
          effectiveQty,
          basketQty,
          isSelected,
          isSearchMatch,
          heroPlacement,
        }) => {
          const pickNonce =
            lastPickedEvent &&
            pos.product &&
            lastPickedEvent.productId === pos.product.id
              ? lastPickedEvent.nonce
              : 0;

          return (
            <ProductModel
              key={pos.id}
              positionNode={pos}
              localPosition={layout.localPosition}
              localRotationY={layout.localRotationY}
              tiltX={layout.tiltX}
              heroPlacement={heroPlacement}
              effectiveQuantity={effectiveQty}
              viewMode={viewMode}
              isSelected={isSelected}
              isRecentlyRestocked={recentlyRestockedPositionIds.has(pos.id)}
              onSelect={onSelectProduct}
              shopperMode={shopperMode}
              basketQuantity={basketQty}
              isSearchMatch={isSearchMatch}
              searchActive={searchActive}
              pickNonce={pickNonce}
              isNearShelf={isNearShelf}
              isHtmlRange={isHtmlRange}
            />
          );
        },
      )}
    </group>
  );
}
