"use client";

import * as React from "react";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { GraphicsQuality } from "@/types/digital-twin";

export function StoreEnvironment({ quality }: { quality: GraphicsQuality }) {
  return (
    <>
      <color attach="background" args={["#edf6f5"]} />
      <fog attach="fog" args={["#edf6f5", 52, 112]} />

      {/* Offline procedural flagship supermarket IBL environment map:
          linear overhead luminaire strips reflect softly along the clearcoated terrazzo aisles,
          while cool coastal daylight enters through the south glass facade. */}
      {quality !== "low" && (
        <Environment resolution={quality === "high" ? 256 : 128}>
          {/* Linear ceiling luminaire reflection banks down the retail hall */}
          {[-10, -3.5, 3.5, 10].map((x) => (
            <Lightformer
              key={`ceil-${x}`}
              form="rect"
              intensity={2.4}
              position={[x, 11, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[1.8, 24, 1]}
              color="#fffdf9"
            />
          ))}

          {/* Bright coastal Zanzibar daylight entering the south glass facade */}
          <Lightformer
            form="rect"
            intensity={1.8}
            position={[0, 5.5, 22]}
            rotation={[0, Math.PI, 0]}
            scale={[28, 8, 1]}
            color="#e6f7fb"
          />

          {/* Cool dairy/chiller bounce on east wall */}
          <Lightformer
            form="rect"
            intensity={1.25}
            position={[20, 4.5, -2]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[18, 6, 1]}
            color="#dff3ff"
          />

          {/* Warm artisan bakery bounce on west wall */}
          <Lightformer
            form="rect"
            intensity={1.15}
            position={[-20, 4.5, 3]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[14, 5, 1]}
            color="#fff1d6"
          />

          {/* Soft terrazzo floor upward bounce fill */}
          <Lightformer
            form="rect"
            intensity={0.55}
            position={[0, -6, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[34, 28, 1]}
            color="#e6efed"
          />
        </Environment>
      )}

      {quality === "high" && (
        <ContactShadows
          position={[0, 0.01, -4]}
          opacity={0.26}
          scale={56}
          blur={1.9}
          far={7.5}
          resolution={512}
          color="#102a2e"
        />
      )}
    </>
  );
}
