"use client";

import * as React from "react";
import { Text, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  getOakTimberTextures,
  getWelcomeMatTexture,
} from "@/lib/digital-twin/procedural-textures";

function groundCloneToZero(scene: THREE.Object3D): THREE.Object3D {
  const clone = scene.clone(true);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  if (Number.isFinite(box.min.y)) {
    clone.position.y -= box.min.y;
  }
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return clone;
}

function CartCorralModel() {
  const { scene: cartScene } = useGLTF("/models/furniture/shopping-cart.glb");
  const { scene: basketScene } = useGLTF("/models/furniture/basket.glb");

  const cartClones = React.useMemo(
    () => [0, 1, 2, 3, 4].map(() => groundCloneToZero(cartScene)),
    [cartScene],
  );
  const basketClones = React.useMemo(
    () => [0, 1, 2, 3].map(() => groundCloneToZero(basketScene)),
    [basketScene],
  );

  return (
    <group name="Shopping_Cart_Corral" position={[7.8, 0, 12.1]}>
      {/* Stainless steel cart corral rails & floor bollards */}
      <mesh position={[0, 0.45, -0.72]}>
        <boxGeometry args={[3.8, 0.055, 0.055]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.86} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.45, 0.72]}>
        <boxGeometry args={[3.8, 0.055, 0.055]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.86} roughness={0.18} />
      </mesh>
      {[-1.85, 0, 1.85].map((bx, idx) => (
        <React.Fragment key={`bollard-${idx}`}>
          <mesh position={[bx, 0.46, -0.72]} castShadow>
            <cylinderGeometry args={[0.032, 0.036, 0.92, 14]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.22} />
          </mesh>
          <mesh position={[bx, 0.46, 0.72]} castShadow>
            <cylinderGeometry args={[0.032, 0.036, 0.92, 14]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.22} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Nested shopping carts inside corral */}
      {cartClones.slice(0, 4).map((obj, idx) => (
        <group key={`corral-cart-${idx}`} position={[-1.25 + idx * 0.78, 0, 0]} rotation={[0, Math.PI, 0]}>
          <primitive object={obj} />
        </group>
      ))}

      {/* Lived-in solo shopping cart staged ready near lobby entrance */}
      <group position={[-4.2, 0, -0.85]} rotation={[0, -0.42, 0]}>
        <primitive object={cartClones[4]} />
      </group>

      {/* Stacked hand-baskets on wheeled steel caddy beside the cart bay */}
      <group position={[-2.55, 0, 0.25]} name="Hand_Basket_Stack">
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.52, 0.06, 0.38]} />
          <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.35} />
        </mesh>
        {basketClones.map((obj, idx) => (
          <group key={`basket-${idx}`} position={[0, 0.07 + idx * 0.135, 0]}>
            <primitive object={obj} />
          </group>
        ))}
      </group>

      {/* Cart & Basket bay vertical wayfinding sign */}
      <group position={[0, 1.48, -0.72]}>
        <mesh>
          <boxGeometry args={[1.45, 0.26, 0.045]} />
          <meshStandardMaterial color="#0f766e" roughness={0.35} />
        </mesh>
        <Text
          position={[0, 0, 0.028]}
          fontSize={0.11}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          CARTS &amp; BASKETS
        </Text>
      </group>
    </group>
  );
}

const AISLE_BLADES: Array<{
  num: string;
  label: string;
  accent: string;
  x: number;
  z: number;
}> = [
  { num: "01", label: "STAPLES", accent: "#15803d", x: -10.2, z: 4.15 },
  { num: "02", label: "OILS", accent: "#15803d", x: -6.8, z: 4.15 },
  { num: "03", label: "CEREALS", accent: "#15803d", x: -3.4, z: 4.15 },
  { num: "04", label: "DRINKS", accent: "#0284c7", x: 0.4, z: 4.15 },
  { num: "05", label: "WATER", accent: "#0284c7", x: 3.8, z: 4.15 },
  { num: "06", label: "CHILLED", accent: "#0369a1", x: 7.0, z: 3.75 },
  { num: "07", label: "CARE", accent: "#be185d", x: -6.8, z: -6.9 },
];

export function Entrance() {
  const oakTimber = React.useMemo(() => getOakTimberTextures(), []);
  const welcomeMatTex = React.useMemo(() => getWelcomeMatTexture(), []);

  return (
    <group name="Supermarket_Entrance_Group">
      {/* South double-glazed storefront curtain wall with realistic reflections */}
      <mesh position={[-11.5, 2.2, 14]}>
        <boxGeometry args={[15, 4.4, 0.09]} />
        <meshPhysicalMaterial
          color="#d9f4f9"
          transparent
          opacity={0.22}
          roughness={0.04}
          metalness={0.08}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          reflectivity={0.96}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[11.5, 2.2, 14]}>
        <boxGeometry args={[15, 4.4, 0.09]} />
        <meshPhysicalMaterial
          color="#d9f4f9"
          transparent
          opacity={0.22}
          roughness={0.04}
          metalness={0.08}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          reflectivity={0.96}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle frosted eye-level glazing safety manifestation band */}
      {[-11.5, 11.5].map((gx) => (
        <mesh key={`band-${gx}`} position={[gx, 1.35, 13.94]}>
          <boxGeometry args={[14.8, 0.09, 0.01]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.32}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Architectural dark anodized aluminum mullions, transoms & floor sill */}
      {[-18.8, -15.2, -11.5, -7.8, -4.1, 4.1, 7.8, 11.5, 15.2, 18.8].map((x) => (
        <mesh key={`mul-${x}`} position={[x, 2.2, 14.03]}>
          <boxGeometry args={[0.095, 4.4, 0.16]} />
          <meshStandardMaterial color="#273440" metalness={0.78} roughness={0.26} />
        </mesh>
      ))}
      {/* Horizontal transom bar at door-header height (3.1m) + base sill */}
      <mesh position={[0, 3.12, 14.03]}>
        <boxGeometry args={[38, 0.12, 0.17]} />
        <meshStandardMaterial color="#273440" metalness={0.78} roughness={0.26} />
      </mesh>
      <mesh position={[-11.5, 0.09, 14.03]}>
        <boxGeometry args={[15.1, 0.18, 0.18]} />
        <meshStandardMaterial color="#1e293b" metalness={0.68} roughness={0.32} />
      </mesh>
      <mesh position={[11.5, 0.09, 14.03]}>
        <boxGeometry args={[15.1, 0.18, 0.18]} />
        <meshStandardMaterial color="#1e293b" metalness={0.68} roughness={0.32} />
      </mesh>

      {/* Automated sliding glass vestibule doors + motion sensor header + chrome pull bars */}
      {[-2.2, 2.2].map((dx, idx) => (
        <group key={`door-${idx}`} position={[dx, 1.52, 13.96]}>
          <mesh>
            <boxGeometry args={[1.9, 3.0, 0.06]} />
            <meshPhysicalMaterial
              color="#bceef7"
              transparent
              opacity={0.3}
              roughness={0.04}
              clearcoat={1.0}
              reflectivity={0.96}
              depthWrite={false}
            />
          </mesh>
          {/* Door aluminum stiles */}
          <mesh position={[-0.93, 0, 0]}>
            <boxGeometry args={[0.06, 3.02, 0.08]} />
            <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.26} />
          </mesh>
          <mesh position={[0.93, 0, 0]}>
            <boxGeometry args={[0.06, 3.02, 0.08]} />
            <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.26} />
          </mesh>
          {/* Brushed stainless push bar */}
          <mesh position={[0, -0.25, 0.055]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, 1.4, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.16} />
          </mesh>
        </group>
      ))}
      {/* Overhead automatic sliding door sensor bar */}
      <mesh position={[0, 3.22, 14.12]}>
        <boxGeometry args={[4.6, 0.12, 0.14]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Storefront teal architectural fascia & backlit flagship signage */}
      <mesh position={[0, 4.72, 14.16]} castShadow>
        <boxGeometry args={[38.4, 0.96, 0.52]} />
        <meshStandardMaterial color="#0f766e" roughness={0.32} metalness={0.18} />
      </mesh>
      <mesh position={[0, 4.24, 14.42]}>
        <boxGeometry args={[38.4, 0.05, 0.06]} />
        <meshStandardMaterial
          color="#99f6e4"
          emissive="#5eead4"
          emissiveIntensity={1.15}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 4.74, 14.45]}
        fontSize={0.56}
        letterSpacing={0.06}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        SUPERMARKET ZANZIBAR
      </Text>

      {/* Hanging architectural aisle blades suspended above gondola end-caps */}
      {AISLE_BLADES.map((blade) => (
        <group
          key={blade.num}
          position={[blade.x, 2.62, blade.z]}
          name={`Aisle_Blade_${blade.num}`}
        >
          {/* Steel ceiling suspension cables */}
          <mesh position={[-0.28, 1.25, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 2.35, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.82} roughness={0.25} />
          </mesh>
          <mesh position={[0.28, 1.25, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 2.35, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.82} roughness={0.25} />
          </mesh>
          {/* Main matte slate blade housing + colored department top accent bar */}
          <mesh castShadow>
            <boxGeometry args={[0.74, 0.38, 0.055]} />
            <meshStandardMaterial color="#102022" roughness={0.36} metalness={0.24} />
          </mesh>
          <mesh position={[0, 0.175, 0]}>
            <boxGeometry args={[0.76, 0.045, 0.065]} />
            <meshStandardMaterial color={blade.accent} roughness={0.32} />
          </mesh>
          {/* Front & rear legible typography */}
          <Text
            position={[0, 0.045, 0.033]}
            fontSize={0.145}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {blade.num}
          </Text>
          <Text
            position={[0, -0.1, 0.033]}
            fontSize={0.072}
            letterSpacing={0.06}
            color="#99f6e4"
            anchorX="center"
            anchorY="middle"
          >
            {blade.label}
          </Text>
          <Text
            position={[0, 0.045, -0.033]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.145}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {blade.num}
          </Text>
          <Text
            position={[0, -0.1, -0.033]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.072}
            letterSpacing={0.06}
            color="#99f6e4"
            anchorX="center"
            anchorY="middle"
          >
            {blade.label}
          </Text>
        </group>
      ))}

      {/* Commercial ribbed "KARIBU" entrance welcome mat */}
      <mesh position={[0, 0.012, 12.65]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.8, 2.3]} />
        <meshStandardMaterial
          color="#ffffff"
          map={welcomeMatTex ?? undefined}
          roughness={0.94}
        />
      </mesh>

      {/* Customer reception & store directory kiosk (slatted warm oak + quartz top + info screen) */}
      <group position={[-7.2, 0, 12.0]} name="Customer_Reception_Kiosk">
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[2.72, 0.14, 0.84]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.82, 0.96, 0.9]} />
          <meshStandardMaterial
            color="#d4a373"
            map={oakTimber?.map}
            bumpMap={oakTimber?.bumpMap}
            bumpScale={0.012}
            roughness={0.62}
          />
        </mesh>
        <mesh position={[0, 1.13, 0]} castShadow>
          <boxGeometry args={[2.94, 0.065, 0.98]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.08} />
        </mesh>
        {/* Directory info monitor */}
        <mesh position={[0, 1.38, 0.05]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.56, 0.36, 0.04]} />
          <meshStandardMaterial color="#0f172a" roughness={0.25} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.38, 0.072]} rotation={[-0.18, 0, 0]}>
          <planeGeometry args={[0.5, 0.3]} />
          <meshStandardMaterial
            color="#ccfbf1"
            emissive="#14b8a6"
            emissiveIntensity={0.45}
          />
        </mesh>
      </group>

      {/* Customer service desk (slatted oak cladding + teal architectural fascia + monitor) */}
      <group position={[-14.8, 0, 11.4]} name="Customer_Service_Desk">
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[4.3, 0.14, 1.02]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.42, 0.96, 1.1]} />
          <meshStandardMaterial
            color="#d4a373"
            map={oakTimber?.map}
            bumpMap={oakTimber?.bumpMap}
            bumpScale={0.012}
            roughness={0.64}
          />
        </mesh>
        <mesh position={[0, 1.14, 0]} castShadow>
          <boxGeometry args={[4.54, 0.08, 1.18]} />
          <meshStandardMaterial color="#0f766e" roughness={0.32} />
        </mesh>
        <Text
          position={[0, 1.88, 0]}
          fontSize={0.26}
          letterSpacing={0.05}
          color="#0f766e"
          anchorX="center"
          anchorY="middle"
        >
          CUSTOMER SERVICE
        </Text>
      </group>

      {/* Shopping cart collection corral + stacked hand baskets + lobby cart */}
      <React.Suspense fallback={null}>
        <CartCorralModel />
      </React.Suspense>
    </group>
  );
}
