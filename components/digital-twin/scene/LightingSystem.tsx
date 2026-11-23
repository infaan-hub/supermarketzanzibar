"use client";

import * as React from "react";
import type { GraphicsQuality } from "@/types/digital-twin";

export function LightingSystem({ quality }: { quality: GraphicsQuality }) {
  const shadowSize = quality === "high" ? 2048 : quality === "balanced" ? 1024 : 512;
  const castShadows = quality !== "low";

  return (
    <group name="Lighting_System">
      {/* Balanced architectural skylight & warm terrazzo bounce */}
      <hemisphereLight args={["#f4fbfa", "#c6d3d6", 0.88]} />
      <ambientLight intensity={0.26} color="#ffffff" />

      {/* Main sunlit coastal key light entering from the south-east facade */}
      <directionalLight
        position={[18, 28, 22]}
        intensity={1.38}
        color="#fffdf7"
        castShadow={castShadows}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-34}
        shadow-camera-near={2}
        shadow-camera-far={85}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />

      {/* Cool architectural fill light from the north / chilled side */}
      <directionalLight
        position={[-16, 16, -24]}
        intensity={0.52}
        color="#e0f2fe"
      />

      {/* Zone-calibrated interior retail accent lights (3000K Bakery/Produce, 5500K Dairy, Neutral Aisles) */}
      {quality !== "low" && (
        <>
          {/* Warm 3000K bakery & west aisle accent */}
          <pointLight
            position={[-13.5, 4.2, 4.2]}
            intensity={8.5}
            distance={16}
            decay={2}
            color="#ffe8c2"
          />
          {/* Crisp neutral grocery/beverage mid-hall illumination */}
          <pointLight
            position={[-3.2, 4.4, 0.5]}
            intensity={8.5}
            distance={18}
            decay={2}
            color="#fffdf8"
          />
          {/* Cool 5500K dairy & beverage chiller zone accent */}
          <pointLight
            position={[12.5, 4.2, -4.5]}
            intensity={9.0}
            distance={17}
            decay={2}
            color="#e0f4ff"
          />
          {/* Warm 3000K fresh produce island highlight */}
          <pointLight
            position={[13.5, 4.0, 4.8]}
            intensity={8.0}
            distance={14}
            decay={2}
            color="#ffefd1"
          />
          {/* Back-of-house high-bay warehouse illumination */}
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
