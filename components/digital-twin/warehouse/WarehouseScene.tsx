"use client";

import * as React from "react";
import { Text } from "@react-three/drei";
import type {
  TwinViewMode,
  TwinWarehousePositionNode,
  TwinWarehouseRackNode,
} from "@/types/digital-twin";
import { WarehouseRack } from "./WarehouseRack";

export function WarehouseScene({
  racks,
  viewMode,
  selectedLocationId,
  onSelectPosition,
}: {
  racks: TwinWarehouseRackNode[];
  viewMode: TwinViewMode;
  selectedLocationId: string | null;
  onSelectPosition: (pos: TwinWarehousePositionNode) => void;
}) {
  return (
    <group name="Warehouse_Digital_Twin_Root">
      {/* Safety forklift lane markings */}
      <mesh position={[0, 0.012, -21.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[28, 0.14]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.6} />
      </mesh>
      <mesh position={[10.2, 0.012, -22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.14, 14]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.6} />
      </mesh>

      {/* Receiving & goods inspection desk */}
      <group position={[14.2, 0, -28.0]} name="Receiving_Inspection_Desk">
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 1.1, 0.9]} />
          <meshStandardMaterial color="#475569" roughness={0.5} />
        </mesh>
        <Text
          position={[0, 1.65, 0]}
          fontSize={0.28}
          color="#b45309"
          anchorX="center"
          anchorY="middle"
        >
          RECEIVING DOCK
        </Text>
      </group>

      {/* Staff office desk & POS server cabinet inside Staff-Only zone */}
      <group position={[-14.5, 0, -22.0]} name="Staff_Operations_Area">
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.8, 1.1]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[-2.8, 1.05, -2.5]} castShadow>
          <boxGeometry args={[0.8, 2.1, 0.9]} />
          <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>

      {/* Industrial pallet racks */}
      <React.Suspense fallback={null}>
        {racks.map((rack) => (
          <WarehouseRack
            key={rack.rackCode}
            rack={rack}
            viewMode={viewMode}
            selectedLocationId={selectedLocationId}
            onSelectPosition={onSelectPosition}
          />
        ))}
      </React.Suspense>
    </group>
  );
}
