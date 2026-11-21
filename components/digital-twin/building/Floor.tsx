"use client";

import * as React from "react";
import { PHYSICAL_AREAS } from "@/lib/digital-twin/spatial-plan";

export function Floor({
  showZoneGuides = true,
  highlightedDepartmentCode,
}: {
  showZoneGuides?: boolean;
  highlightedDepartmentCode?: string | null;
}) {
  return (
    <group name="Supermarket_Floor_Group">
      {/* Main polished terrazzo retail floor */}
      <mesh
        name="Retail_Floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[38, 28]} />
        <meshStandardMaterial
          color="#f4fbfa"
          roughness={0.38}
          metalness={0.05}
        />
      </mesh>

      {/* Industrial epoxy warehouse & back-of-house floor */}
      <mesh
        name="Warehouse_Floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, -22]}
        receiveShadow
      >
        <planeGeometry args={[38, 16]} />
        <meshStandardMaterial
          color="#e2e8ec"
          roughness={0.78}
          metalness={0.04}
        />
      </mesh>

      {/* Exterior concrete apron & parking walkway */}
      <mesh
        name="Exterior_Apron"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, -4]}
        receiveShadow
      >
        <planeGeometry args={[76, 76]} />
        <meshStandardMaterial color="#d8e3e1" roughness={0.95} />
      </mesh>

      {/* Subtle architectural tile grid on retail floor */}
      <gridHelper
        args={[38, 19, "#cbd5e1", "#e2ecea"]}
        position={[0, 0.004, 0]}
      />

      {/* Department floor zone inlays */}
      {showZoneGuides &&
        PHYSICAL_AREAS.map((area) => {
          const width = area.bounds.maxX - area.bounds.minX;
          const depth = area.bounds.maxZ - area.bounds.minZ;
          const cx = (area.bounds.minX + area.bounds.maxX) / 2;
          const cz = (area.bounds.minZ + area.bounds.maxZ) / 2;
          const isHighlighted =
            highlightedDepartmentCode &&
            highlightedDepartmentCode.toUpperCase() === area.code.toUpperCase();

          return (
            <mesh
              key={area.id}
              name={`Zone_Floor_${area.code}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[cx, 0.008, cz]}
              receiveShadow
            >
              <planeGeometry args={[width - 0.16, depth - 0.16]} />
              <meshStandardMaterial
                color={area.accentColor}
                transparent
                opacity={isHighlighted ? 0.24 : 0.06}
                roughness={0.7}
              />
            </mesh>
          );
        })}
    </group>
  );
}
