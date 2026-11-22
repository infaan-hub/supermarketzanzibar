"use client";

import * as React from "react";
import { Html, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import {
  INVENTORY_STATE_STYLES,
  heatmapColorForState,
} from "@/lib/digital-twin/inventory-state";
import { getAssetEntry } from "@/lib/digital-twin/asset-manifest";
import type {
  TwinShelfPositionNode,
  TwinViewMode,
} from "@/types/digital-twin";
import { ProductHighlight } from "./ProductHighlight";

function LoadedProductMesh({
  assetPath,
  assetKey,
  tintColor,
  applyTint,
  scaleFactor = 1,
}: {
  assetPath: string;
  assetKey: string;
  tintColor: string;
  applyTint: boolean;
  scaleFactor?: number;
}) {
  const { scene } = useGLTF(assetPath);
  const entry = getAssetEntry(assetKey);
  const baseScale = entry?.defaultScale ?? [1.2, 1.2, 1.2];

  const cloned = React.useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (applyTint && child.material instanceof THREE.MeshStandardMaterial) {
          const mat = child.material.clone();
          mat.emissive = new THREE.Color(tintColor);
          mat.emissiveIntensity = 0.35;
          child.material = mat;
        }
      }
    });
    return copy;
  }, [scene, applyTint, tintColor]);

  return (
    <primitive
      object={cloned}
      scale={[
        baseScale[0] * scaleFactor,
        baseScale[1] * scaleFactor,
        baseScale[2] * scaleFactor,
      ]}
    />
  );
}

export function ProductModel({
  positionNode,
  localPosition,
  viewMode,
  isSelected,
  isRecentlyRestocked,
  onSelect,
}: {
  positionNode: TwinShelfPositionNode;
  localPosition: [number, number, number];
  viewMode: TwinViewMode;
  isSelected: boolean;
  isRecentlyRestocked: boolean;
  onSelect: (pos: TwinShelfPositionNode) => void;
}) {
  const groupRef = React.useRef<THREE.Group>(null);
  const [hovered, setHovered] = React.useState(false);

  const effectiveState = isRecentlyRestocked
    ? "restocking"
    : positionNode.visualState;
  const stateStyle = INVENTORY_STATE_STYLES[effectiveState];
  const heatmapColor = heatmapColorForState(effectiveState, true);

  // Phase 13: GSAP post-commit restocking animation when DB restock completes.
  React.useEffect(() => {
    if (!isRecentlyRestocked || !groupRef.current) return;
    const target = groupRef.current;
    gsap.killTweensOf(target.scale);
    gsap.killTweensOf(target.position);
    gsap.fromTo(
      target.scale,
      { x: 0.25, y: 0.25, z: 0.25 },
      { x: 1, y: 1, z: 1, duration: 0.7, ease: "back.out(1.7)" },
    );
    gsap.fromTo(
      target.position,
      { y: localPosition[1] + 0.35 },
      { y: localPosition[1], duration: 0.65, ease: "bounce.out" },
    );
  }, [isRecentlyRestocked, localPosition]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(positionNode);
  };

  const product = positionNode.product;
  const isEmpty = !product || positionNode.quantity <= 0;

  // Facing count reflects real shelf quantity (capped to 3 visual units per slot).
  const facings = isEmpty ? 0 : Math.min(3, Math.max(1, Math.ceil(positionNode.quantity / 8)));
  const applyTint =
    viewMode === "heatmap" ||
    (viewMode === "inventory" && effectiveState !== "normal") ||
    isSelected;
  const activeColor =
    viewMode === "heatmap" ? heatmapColor : stateStyle.color;

  return (
    <group
      ref={groupRef}
      name={positionNode.objectName}
      position={localPosition}
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
      {/* Empty slot indicator when product is out of stock or unassigned */}
      {isEmpty ? (
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.24, 0.06, 0.2]} />
          <meshStandardMaterial
            color={product ? "#ef4444" : "#94a3b8"}
            transparent
            opacity={viewMode === "realistic" && !isSelected ? 0.35 : 0.78}
            emissive={product ? "#b91c1c" : "#64748b"}
            emissiveIntensity={product ? 0.4 : 0.1}
          />
        </mesh>
      ) : (
        <React.Suspense
          fallback={
            <mesh position={[0, 0.12, 0]} castShadow>
              <boxGeometry args={[0.16, 0.22, 0.14]} />
              <meshStandardMaterial color={activeColor} />
            </mesh>
          }
        >
          {Array.from({ length: facings }).map((_, idx) => {
            const offset =
              facings === 1 ? 0 : (idx - (facings - 1) / 2) * 0.16;
            return (
              <group key={idx} position={[offset, 0, 0]}>
                <LoadedProductMesh
                  assetPath={product.assetPath}
                  assetKey={product.assetKey}
                  tintColor={activeColor}
                  applyTint={applyTint}
                />
              </group>
            );
          })}
        </React.Suspense>
      )}

      {/* Operational status indicator beacon in Inventory/Heatmap modes */}
      {(viewMode !== "realistic" || isSelected || isRecentlyRestocked) && (
        <mesh position={[0, 0.015, 0.16]}>
          <boxGeometry args={[0.26, 0.025, 0.035]} />
          <meshStandardMaterial
            color={activeColor}
            emissive={activeColor}
            emissiveIntensity={0.65}
          />
        </mesh>
      )}

      <ProductHighlight
        color={activeColor}
        active={isSelected || hovered || isRecentlyRestocked}
      />

      {(hovered || isSelected) && product && (
        <Html
          position={[0, 0.44, 0]}
          center
          distanceFactor={12}
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
            <span className="font-semibold">{product.name}</span>
            <span className="ml-1.5 font-mono text-primary">
              {positionNode.quantity} on shelf
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
