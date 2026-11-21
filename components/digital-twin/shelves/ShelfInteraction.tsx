"use client";

import * as React from "react";

export function ShelfInteraction({
  size,
  color,
  highlighted,
}: {
  size: [number, number, number];
  color: string;
  highlighted: boolean;
}) {
  if (!highlighted) return null;
  const [w, , d] = size;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[w + 0.45, d + 0.45]} />
      <meshBasicMaterial color={color} transparent opacity={0.32} />
    </mesh>
  );
}
