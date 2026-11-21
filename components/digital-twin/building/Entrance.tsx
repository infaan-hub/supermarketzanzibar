"use client";

import * as React from "react";
import { Text, useGLTF } from "@react-three/drei";

function CartCorralModel() {
  const { scene } = useGLTF("/models/furniture/shopping-cart.glb");
  const clones = React.useMemo(
    () => [0, 1, 2, 3].map(() => scene.clone(true)),
    [scene],
  );

  return (
    <group name="Shopping_Cart_Corral" position={[7.8, 0, 12.1]}>
      {/* Stainless corral rails */}
      <mesh position={[0, 0.45, -0.7]}>
        <boxGeometry args={[3.4, 0.06, 0.06]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.45, 0.7]}>
        <boxGeometry args={[3.4, 0.06, 0.06]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
      </mesh>
      {clones.map((obj, idx) => (
        <primitive
          key={idx}
          object={obj}
          position={[-1.1 + idx * 0.72, 0, 0]}
          rotation={[0, Math.PI, 0]}
        />
      ))}
    </group>
  );
}

export function Entrance() {
  return (
    <group name="Supermarket_Entrance_Group">
      {/* South glass storefront left & right of sliding doors */}
      <mesh position={[-11.5, 2.2, 14]}>
        <boxGeometry args={[15, 4.4, 0.12]} />
        <meshPhysicalMaterial
          color="#cffafe"
          transparent
          opacity={0.32}
          roughness={0.08}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[11.5, 2.2, 14]}>
        <boxGeometry args={[15, 4.4, 0.12]} />
        <meshPhysicalMaterial
          color="#cffafe"
          transparent
          opacity={0.32}
          roughness={0.08}
          metalness={0.05}
        />
      </mesh>

      {/* Automated sliding glass entrance doors */}
      <mesh position={[-2.2, 1.5, 14]}>
        <boxGeometry args={[1.9, 3.0, 0.08]} />
        <meshPhysicalMaterial
          color="#a5f3fc"
          transparent
          opacity={0.42}
          roughness={0.1}
        />
      </mesh>
      <mesh position={[2.2, 1.5, 14]}>
        <boxGeometry args={[1.9, 3.0, 0.08]} />
        <meshPhysicalMaterial
          color="#a5f3fc"
          transparent
          opacity={0.42}
          roughness={0.1}
        />
      </mesh>

      {/* Storefront teal fascia & signage */}
      <mesh position={[0, 4.7, 14.15]} castShadow>
        <boxGeometry args={[38.4, 0.95, 0.5]} />
        <meshStandardMaterial color="#0f766e" roughness={0.35} metalness={0.15} />
      </mesh>
      <Text
        position={[0, 4.72, 14.44]}
        fontSize={0.58}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        SUPERMARKET ZANZIBAR · DIGITAL TWIN
      </Text>

      {/* Welcome mat */}
      <mesh position={[0, 0.015, 12.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.8, 2.2]} />
        <meshStandardMaterial color="#134e4a" roughness={0.95} />
      </mesh>

      {/* Customer reception kiosk */}
      <group position={[-7.2, 0, 12.0]} name="Customer_Reception_Kiosk">
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 1.1, 0.9]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <boxGeometry args={[2.9, 0.06, 0.96]} />
          <meshStandardMaterial color="#0d9488" roughness={0.35} />
        </mesh>
      </group>

      {/* Customer service desk */}
      <group position={[-14.8, 0, 11.4]} name="Customer_Service_Desk">
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.4, 1.1, 1.1]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <boxGeometry args={[4.5, 0.08, 1.16]} />
          <meshStandardMaterial color="#0891b2" roughness={0.35} />
        </mesh>
        <Text
          position={[0, 1.85, 0]}
          fontSize={0.28}
          color="#0f766e"
          anchorX="center"
          anchorY="middle"
        >
          CUSTOMER SERVICE
        </Text>
      </group>

      {/* Shopping cart collection */}
      <React.Suspense fallback={null}>
        <CartCorralModel />
      </React.Suspense>
    </group>
  );
}
