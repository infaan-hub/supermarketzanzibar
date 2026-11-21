"use client";

import * as React from "react";
import type { GraphicsQuality } from "@/types/digital-twin";

export function LightingSystem({ quality }: { quality: GraphicsQuality }) {
  const shadowSize = quality === "high" ? 2048 : quality === "balanced" ? 1024 : 512;
  const castShadows = quality !== "low";

  return (
    <group name="Lighting_System">
      <hemisphereLight args={["#f0fdfa", "#cbd5e1", 0.92]} />
      <ambientLight intensity={0.32} color="#ffffff" />

      {/* Main sunlit key light entering the storefront */}
      <directionalLight
        position={[18, 28, 22]}
        intensity={1.35}
        color="#fffdf8"
        castShadow={castShadows}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-34}
        shadow-camera-near={2}
        shadow-camera-far={85}
        shadow-bias={-0.0005}
      />

      {/* Cool fill light from the back-of-house / warehouse side */}
      <directionalLight
        position={[-16, 16, -24]}
        intensity={0.55}
        color="#e0f2fe"
      />

      {/* Warm retail interior accent lights */}
      {quality !== "low" && (
        <>
          <pointLight
            position={[-6, 4.4, 2]}
            intensity={8}
            distance={18}
            decay={2}
            color="#fffbeb"
          />
          <pointLight
            position={[6, 4.4, 2]}
            intensity={8}
            distance={18}
            decay={2}
            color="#f0fdfa"
          />
          <pointLight
            position={[0, 5.4, -22]}
            intensity={10}
            distance={22}
            decay={2}
            color="#f8fafc"
          />
        </>
      )}
    </group>
  );
}
