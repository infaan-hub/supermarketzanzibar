"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@/lib/digital-twin/spatial-plan";

const BEAD_COUNT = 14;
const BEAD_POS = new THREE.Vector3();
const BEAD_DUMMY = new THREE.Object3D();

/**
 * Guided 3D floor shopping route connecting the store entrance through every
 * shelf holding items in the customer's basket to the checkout lanes, with
 * animated directional pulse beads gliding gently along the path.
 */
export function ShoppingPath3D({ points }: { points: Vec3[] }) {
  const beadsRef = React.useRef<THREE.InstancedMesh>(null);

  const { curve, tubeGeometry } = React.useMemo(() => {
    if (points.length < 2) return { curve: null, tubeGeometry: null };
    const vectors = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const c = new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.14);
    const geo = new THREE.TubeGeometry(
      c,
      Math.max(28, points.length * 16),
      0.068,
      10,
      false,
    );
    return { curve: c, tubeGeometry: geo };
  }, [points]);

  React.useEffect(() => {
    return () => {
      tubeGeometry?.dispose();
    };
  }, [tubeGeometry]);

  useFrame(({ clock }) => {
    const mesh = beadsRef.current;
    if (!mesh || !curve) return;
    const tBase = (clock.getElapsedTime() * 0.12) % 1;
    for (let i = 0; i < BEAD_COUNT; i += 1) {
      const t = (tBase + i / BEAD_COUNT) % 1;
      curve.getPointAt(t, BEAD_POS);
      BEAD_DUMMY.position.set(BEAD_POS.x, 0.036, BEAD_POS.z);
      const pulse = 0.85 + Math.sin(clock.getElapsedTime() * 4 + i) * 0.18;
      BEAD_DUMMY.scale.set(pulse, 0.4, pulse);
      BEAD_DUMMY.updateMatrix();
      mesh.setMatrixAt(i, BEAD_DUMMY.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!tubeGeometry || !curve || points.length < 2) return null;

  return (
    <group name="Guided_Shopping_Path">
      {/* Subtle glowing floor route ribbon */}
      <mesh geometry={tubeGeometry} scale={[1, 0.22, 1]}>
        <meshStandardMaterial
          color="#0f766e"
          emissive="#14b8a6"
          emissiveIntensity={0.82}
          transparent
          opacity={0.78}
          roughness={0.28}
        />
      </mesh>

      {/* Flowing animated directional guide beads along the curve */}
      <instancedMesh
        ref={beadsRef}
        args={[undefined, undefined, BEAD_COUNT]}
        name="Shopping_Path_Guide_Beads"
      >
        <sphereGeometry args={[0.075, 12, 10]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#5eead4"
          emissiveIntensity={1.3}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Floor waypoint rings at entrance, shelf stops, and checkout */}
      {points.map((pt, idx) => {
        const isEnd = idx === points.length - 1;
        const isStart = idx === 0;
        const color = isEnd ? "#16a34a" : isStart ? "#0284c7" : "#0f766e";
        return (
          <group key={idx} position={[pt[0], 0.025, pt[2]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.17, 0.27, 28]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.88}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.08, 18]} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={0.7}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
