"use client";

import * as React from "react";
import * as THREE from "three";

const LIGHT_POSITIONS: Array<[number, number, number]> = [];
for (let x = -14; x <= 14; x += 7) {
  for (let z = -10; z <= 10; z += 5) {
    LIGHT_POSITIONS.push([x, 4.95, z]);
  }
}

export function Ceiling({ visible = true }: { visible?: boolean }) {
  const instancedRef = React.useRef<THREE.InstancedMesh>(null);

  React.useEffect(() => {
    const mesh = instancedRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    LIGHT_POSITIONS.forEach(([x, y, z], idx) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [visible]);

  if (!visible) return null;

  return (
    <group name="Supermarket_Ceiling_Group">
      {/* Exposed architectural trusses — open enough for top-down inspection */}
      {[-10, -4, 2, 8].map((z) => (
        <mesh key={z} position={[0, 5.1, z]}>
          <boxGeometry args={[38, 0.22, 0.24]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.45} />
        </mesh>
      ))}
      {[-12, 0, 12].map((x) => (
        <mesh key={x} position={[x, 5.1, 0]}>
          <boxGeometry args={[0.24, 0.22, 28]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.45} />
        </mesh>
      ))}

      {/* Instanced LED luminaire strips */}
      <instancedMesh
        ref={instancedRef}
        args={[undefined, undefined, LIGHT_POSITIONS.length]}
        name="Instanced_Ceiling_Lights"
      >
        <boxGeometry args={[2.6, 0.08, 0.28]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#e6fffb"
          emissiveIntensity={0.85}
          roughness={0.2}
        />
      </instancedMesh>
    </group>
  );
}
