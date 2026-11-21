"use client";

import * as React from "react";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { GraphicsQuality } from "@/types/digital-twin";

export function StoreEnvironment({ quality }: { quality: GraphicsQuality }) {
  return (
    <>
      <color attach="background" args={["#edf7f6"]} />
      <fog attach="fog" args={["#edf7f6", 48, 105]} />

      {/* Procedural studio/supermarket environment map — works 100% offline */}
      {quality !== "low" && (
        <Environment resolution={quality === "high" ? 256 : 128}>
          <Lightformer
            form="rect"
            intensity={2.2}
            position={[0, 12, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[28, 18, 1]}
            color="#ffffff"
          />
          <Lightformer
            form="rect"
            intensity={1.2}
            position={[18, 5, 10]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[14, 6, 1]}
            color="#e0f2fe"
          />
          <Lightformer
            form="rect"
            intensity={1.0}
            position={[-18, 5, -6]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[14, 6, 1]}
            color="#f0fdfa"
          />
        </Environment>
      )}

      {quality === "high" && (
        <ContactShadows
          position={[0, 0.012, -4]}
          opacity={0.28}
          scale={56}
          blur={1.8}
          far={8}
          resolution={512}
          color="#134e4a"
        />
      )}
    </>
  );
}
