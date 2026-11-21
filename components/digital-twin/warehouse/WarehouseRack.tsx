"use client";

import * as React from "react";
import { Html, Text, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  INVENTORY_STATE_STYLES,
  heatmapColorForState,
} from "@/lib/digital-twin/inventory-state";
import type {
  TwinViewMode,
  TwinWarehousePositionNode,
  TwinWarehouseRackNode,
} from "@/types/digital-twin";

export function WarehouseRack({
  rack,
  viewMode,
  selectedLocationId,
  onSelectPosition,
}: {
  rack: TwinWarehouseRackNode;
  viewMode: TwinViewMode;
  selectedLocationId: string | null;
  onSelectPosition: (pos: TwinWarehousePositionNode) => void;
}) {
  const { scene } = useGLTF("/models/furniture/warehouse-rack.glb");
  const clonedRack = React.useMemo(() => scene.clone(true), [scene]);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const [w, h] = rack.size;

  return (
    <group name={rack.rackCode} position={rack.position}>
      {/* Industrial steel rack structure from GLB */}
      <primitive object={clonedRack} />

      {/* Rack header placard */}
      <Text
        position={[0, h + 0.25, 0.58]}
        fontSize={0.28}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
      >
        {rack.rackCode}
      </Text>

      {/* Individual database-backed pallet positions */}
      {rack.positions.map((pos, idx) => {
        const levelIdx = Math.floor(idx / Math.max(1, rack.positionsPerLevel)) % Math.max(1, rack.levels);
        const slotIdx = idx % Math.max(1, rack.positionsPerLevel);
        const frac =
          rack.positionsPerLevel > 1
            ? slotIdx / (rack.positionsPerLevel - 1) - 0.5
            : 0;
        const localX = frac * (w * 0.66);
        const localY = 0.52 + levelIdx * 1.4;

        const isSelected = selectedLocationId === pos.id;
        const isHovered = hoveredId === pos.id;
        const hasStock = pos.quantityOnHand > 0 && Boolean(pos.product);

        const stateStyle = INVENTORY_STATE_STYLES[pos.visualState];
        const crateColor =
          viewMode === "heatmap"
            ? heatmapColorForState(pos.visualState, true)
            : viewMode === "inventory" && pos.visualState !== "normal"
              ? stateStyle.color
              : hasStock
                ? "#d4a373"
                : "#94a3b8";

        const handleClick = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelectPosition(pos);
        };

        return (
          <group
            key={pos.id}
            name={pos.objectName}
            position={[localX, localY, 0]}
            onClick={handleClick}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId(pos.id);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHoveredId(null);
              document.body.style.cursor = "auto";
            }}
          >
            {/* Wooden pallet base */}
            <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.15, 0.12, 0.96]} />
              <meshStandardMaterial color="#a97848" roughness={0.85} />
            </mesh>

            {/* Stacked cardboard cartons scaled by actual warehouse quantity */}
            {hasStock ? (
              <mesh
                position={[
                  0,
                  0.12 +
                    Math.min(0.95, Math.max(0.28, (pos.quantityOnHand / Math.max(1, pos.capacity)) * 0.95)) / 2,
                  0,
                ]}
                castShadow
                receiveShadow
              >
                <boxGeometry
                  args={[
                    1.02,
                    Math.min(
                      0.95,
                      Math.max(
                        0.28,
                        (pos.quantityOnHand / Math.max(1, pos.capacity)) * 0.95,
                      ),
                    ),
                    0.86,
                  ]}
                />
                <meshStandardMaterial
                  color={crateColor}
                  roughness={0.68}
                  emissive={isSelected || isHovered ? stateStyle.color : "#000000"}
                  emissiveIntensity={isSelected ? 0.45 : isHovered ? 0.25 : 0}
                />
              </mesh>
            ) : (
              <mesh position={[0, 0.14, 0]}>
                <boxGeometry args={[0.92, 0.04, 0.76]} />
                <meshStandardMaterial
                  color="#cbd5e1"
                  transparent
                  opacity={0.45}
                />
              </mesh>
            )}

            {(isHovered || isSelected) && (
              <Html
                position={[0, 1.15, 0]}
                center
                distanceFactor={15}
                style={{ pointerEvents: "none" }}
              >
                <div className="whitespace-nowrap rounded-lg border border-amber-200 bg-white/95 px-2.5 py-1 text-[11px] shadow-md backdrop-blur">
                  <span className="font-mono font-bold text-amber-800">
                    {pos.rackCode}/{pos.levelCode}/{pos.positionCode}
                  </span>
                  <span className="ml-1.5 font-medium text-slate-900">
                    {pos.product
                      ? `${pos.product.name} (${pos.quantityOnHand})`
                      : "Available slot"}
                  </span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
