"use client";

import * as React from "react";
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { PhysicalAreaSpec } from "@/lib/digital-twin/spatial-plan";

export function Department({
  area,
  isSelected,
  isDimmed,
  onSelect,
}: {
  area: PhysicalAreaSpec;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: (code: string) => void;
}) {
  const cx = (area.bounds.minX + area.bounds.maxX) / 2;
  const cz = (area.bounds.minZ + area.bounds.maxZ) / 2;
  const isWarehouse = area.category === "warehouse" || area.category === "operations";
  const signY = isWarehouse ? 5.1 : 3.9;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(area.code);
  };

  return (
    <group name={`Department_Sign_${area.code}`} position={[cx, signY, cz]}>
      {/* Suspended ceiling rods */}
      <mesh position={[-1.1, 0.55, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.1, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[1.1, 0.55, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.1, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Sign board */}
      <mesh onClick={handleClick}>
        <boxGeometry args={[3.2, 0.54, 0.09]} />
        <meshStandardMaterial
          color={area.accentColor}
          roughness={0.35}
          emissive={isSelected ? area.accentColor : "#000000"}
          emissiveIntensity={isSelected ? 0.45 : 0}
          transparent={isDimmed && !isSelected}
          opacity={isDimmed && !isSelected ? 0.45 : 1}
        />
      </mesh>

      {/* Front & back readable signage */}
      <Text
        position={[0, 0.06, 0.06]}
        fontSize={0.21}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.0}
      >
        {area.name.toUpperCase()}
      </Text>
      {area.aisleNumber && (
        <Text
          position={[0, -0.15, 0.06]}
          fontSize={0.12}
          color="#e0f2fe"
          anchorX="center"
          anchorY="middle"
        >
          {area.aisleNumber}
        </Text>
      )}
      <Text
        position={[0, 0.06, -0.06]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.21}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.0}
      >
        {area.name.toUpperCase()}
      </Text>
    </group>
  );
}
