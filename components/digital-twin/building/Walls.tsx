"use client";

import * as React from "react";
import { Text } from "@react-three/drei";

export function Walls() {
  return (
    <group name="Supermarket_Walls_Group">
      {/* West retail wall */}
      <mesh position={[-19, 2.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 5.2, 28]} />
        <meshStandardMaterial color="#f1f7f6" roughness={0.85} />
      </mesh>
      {/* East retail wall */}
      <mesh position={[19, 2.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 5.2, 28]} />
        <meshStandardMaterial color="#f1f7f6" roughness={0.85} />
      </mesh>
      {/* Perimeter aqua/teal architectural accent stripe */}
      <mesh position={[-18.82, 4.35, 0]}>
        <boxGeometry args={[0.04, 0.24, 27.6]} />
        <meshStandardMaterial color="#0f766e" roughness={0.4} />
      </mesh>
      <mesh position={[18.82, 4.35, 0]}>
        <boxGeometry args={[0.04, 0.24, 27.6]} />
        <meshStandardMaterial color="#0f766e" roughness={0.4} />
      </mesh>

      {/* North partition separating retail hall from warehouse/staff (with double-door opening) */}
      <mesh position={[-10.8, 2.6, -14]} castShadow receiveShadow>
        <boxGeometry args={[16.4, 5.2, 0.34]} />
        <meshStandardMaterial color="#e8f1f0" roughness={0.82} />
      </mesh>
      <mesh position={[10.8, 2.6, -14]} castShadow receiveShadow>
        <boxGeometry args={[16.4, 5.2, 0.34]} />
        <meshStandardMaterial color="#e8f1f0" roughness={0.82} />
      </mesh>
      {/* Header above warehouse double doors */}
      <mesh position={[0, 4.15, -14]} castShadow>
        <boxGeometry args={[5.2, 2.1, 0.36]} />
        <meshStandardMaterial color="#0f766e" roughness={0.45} />
      </mesh>
      <Text
        position={[0, 3.65, -13.78]}
        fontSize={0.34}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        WAREHOUSE &amp; RECEIVING
      </Text>

      {/* Warehouse annex walls (North, West, East) */}
      <mesh position={[0, 3.2, -30]} castShadow receiveShadow>
        <boxGeometry args={[38, 6.4, 0.35]} />
        <meshStandardMaterial color="#dfe6e9" roughness={0.88} />
      </mesh>
      <mesh position={[-19, 3.2, -22]} castShadow receiveShadow>
        <boxGeometry args={[0.35, 6.4, 16]} />
        <meshStandardMaterial color="#dfe6e9" roughness={0.88} />
      </mesh>
      <mesh position={[19, 3.2, -22]} castShadow receiveShadow>
        <boxGeometry args={[0.35, 6.4, 16]} />
        <meshStandardMaterial color="#dfe6e9" roughness={0.88} />
      </mesh>
      {/* Staff-only partition inside annex */}
      <mesh position={[-10.2, 2.6, -22]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 5.2, 15.6]} />
        <meshStandardMaterial color="#e6eeed" roughness={0.8} />
      </mesh>

      {/* Loading dock roll-up bay door on north-east receiving wall */}
      <mesh position={[14.2, 2.1, -29.78]}>
        <boxGeometry args={[4.4, 3.8, 0.12]} />
        <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.42} />
      </mesh>

      {/* Emergency exit sign (West) */}
      <mesh position={[-18.8, 2.65, 10.6]}>
        <boxGeometry args={[0.08, 0.35, 0.8]} />
        <meshStandardMaterial
          color="#16a34a"
          emissive="#15803d"
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}
