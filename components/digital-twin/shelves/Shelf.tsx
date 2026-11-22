"use client";

import * as React from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  INVENTORY_STATE_STYLES,
  heatmapColorForState,
} from "@/lib/digital-twin/inventory-state";
import type {
  TwinShelfNode,
  TwinShelfPositionNode,
  TwinViewMode,
} from "@/types/digital-twin";
import { ShelfInteraction } from "./ShelfInteraction";
import { ShelfProducts } from "./ShelfProducts";

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
}) {
  const [hovered, setHovered] = React.useState(false);
  const [w, h, d] = shelf.size;

  const stateStyle = INVENTORY_STATE_STYLES[shelf.visualState];
  const activeColor =
    viewMode === "heatmap"
      ? heatmapColorForState(shelf.visualState, shelf.status === "active")
      : stateStyle.color;

  const isChilled =
    shelf.kind === "refrigerator" ||
    shelf.kind === "freezer" ||
    shelf.kind === "meat_counter";
  const isWood = shelf.kind === "bakery_case" || shelf.kind === "produce_island";

  const frameColor =
    viewMode === "heatmap"
      ? activeColor
      : isChilled
        ? "#dceaf0"
        : isWood
          ? "#c2925b"
          : shelf.kind === "electronics_case"
            ? "#334155"
            : "#edf2f4";

  const headerAccent =
    viewMode !== "realistic"
      ? activeColor
      : isChilled
        ? "#0284c7"
        : isWood
          ? "#d97706"
          : shelf.kind === "cosmetics_shelf"
            ? "#db2777"
            : "#0f766e";

  const opacity = isDimmed && !isSelected ? 0.45 : 1;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectShelf(shelf);
  };

  return (
    <group
      name={shelf.objectName}
      position={shelf.position}
      rotation={[0, shelf.rotationY, 0]}
    >
      {/* Structural spine / frame */}
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
        {/* Base plinth */}
        <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.28, d]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.45}
            metalness={isChilled ? 0.35 : 0.15}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>

        {/* Central divider / back panel for tall shelves */}
        {h > 1.3 && (
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry
              args={[d >= w ? 0.08 : w - 0.08, h - 0.12, d >= w ? d - 0.08 : 0.08]}
            />
            <meshStandardMaterial
              color={frameColor}
              roughness={0.5}
              metalness={0.2}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        )}

        {/* Shelf tier decks */}
        {Array.from({ length: shelf.tiers }).map((_, idx) => {
          const y = 0.26 + idx * ((h - 0.48) / Math.max(1, shelf.tiers));
          return (
            <mesh
              key={idx}
              name={`${shelf.objectName}_Tier_${idx + 1}`}
              position={[0, y, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[w * 0.96, 0.045, d * 0.96]} />
              <meshStandardMaterial
                color={viewMode === "heatmap" ? activeColor : "#f8fafc"}
                roughness={0.35}
                metalness={0.2}
                transparent={opacity < 1}
                opacity={opacity}
              />
            </mesh>
          );
        })}

        {/* Top fascia header / chilled canopy */}
        <mesh position={[0, h - 0.06, 0]} castShadow>
          <boxGeometry args={[w + 0.04, 0.14, d + 0.04]} />
          <meshStandardMaterial
            color={headerAccent}
            roughness={0.35}
            metalness={0.18}
            emissive={isSelected || hovered ? headerAccent : "#000000"}
            emissiveIntensity={isSelected ? 0.38 : hovered ? 0.22 : 0}
          />
        </mesh>

        {/* Glass front panel on chillers, bakery, and electronics cases */}
        {(isChilled ||
          shelf.kind === "bakery_case" ||
          shelf.kind === "electronics_case") && (
          <mesh position={[0, h * 0.54, d / 2 + 0.02]}>
            <boxGeometry args={[w - 0.08, h * 0.65, 0.03]} />
            <meshPhysicalMaterial
              color="#cffafe"
              transparent
              opacity={0.22}
              roughness={0.08}
            />
          </mesh>
        )}
      </group>

      <ShelfInteraction
        size={shelf.size}
        color={activeColor}
        highlighted={isSelected || hovered}
      />

      {/* Real database-driven products placed on this shelf */}
      <ShelfProducts
        shelf={shelf}
        viewMode={viewMode}
        selectedPositionId={selectedPositionId}
        recentlyRestockedPositionIds={recentlyRestockedPositionIds}
        onSelectProduct={onSelectProduct}
        shopperMode={shopperMode}
        basketQuantities={basketQuantities}
      />

      {(hovered || isSelected) && (
        <Html
          position={[0, h + 0.42, 0]}
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
