"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function ProductHighlight({
  color = "#0d9488",
  radius = 0.24,
  active = false,
}: {
  color?: string;
  radius?: number;
  active?: boolean;
}) {
  const ringRef = React.useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current || !active) return;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 4.2) * 0.08;
    ringRef.current.scale.set(pulse, pulse, 1);
  });

  if (!active) return null;

  return (
    <mesh
      ref={ringRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.015, 0]}
    >
      <ringGeometry args={[radius * 0.72, radius, 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
