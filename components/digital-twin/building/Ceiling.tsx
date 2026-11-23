"use client";

import * as React from "react";
import * as THREE from "three";

const LIGHT_POSITIONS: Array<[number, number, number]> = [];
for (let x = -14; x <= 14; x += 7) {
  for (let z = -10; z <= 10; z += 5) {
    LIGHT_POSITIONS.push([x, 4.94, z]);
  }
}

export function Ceiling({ visible = true }: { visible?: boolean }) {
  const housingRef = React.useRef<THREE.InstancedMesh>(null);
  const diffuserRef = React.useRef<THREE.InstancedMesh>(null);

  React.useEffect(() => {
    const housing = housingRef.current;
    const diffuser = diffuserRef.current;
    if (!housing || !diffuser) return;
    const dummy = new THREE.Object3D();
    LIGHT_POSITIONS.forEach(([x, y, z], idx) => {
      dummy.position.set(x, y + 0.03, z);
      dummy.updateMatrix();
      housing.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, y - 0.015, z);
      dummy.updateMatrix();
      diffuser.setMatrixAt(idx, dummy.matrix);
    });
    housing.instanceMatrix.needsUpdate = true;
    diffuser.instanceMatrix.needsUpdate = true;
  }, [visible]);

  if (!visible) return null;

  return (
    <group name="Supermarket_Ceiling_Group">
      {/* Architectural high-bay steel primary & secondary roof trusses */}
      {[-12, -6, 0, 6, 12].map((z) => (
        <mesh key={`truss-z-${z}`} position={[0, 5.1, z]}>
          <boxGeometry args={[38, 0.2, 0.22]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.62} roughness={0.38} />
        </mesh>
      ))}
      {[-14, -7, 0, 7, 14].map((x) => (
        <mesh key={`truss-x-${x}`} position={[x, 5.12, 0]}>
          <boxGeometry args={[0.2, 0.18, 28]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.58} roughness={0.42} />
        </mesh>
      ))}

      {/* Subtle acoustic ceiling deck slab above trusses (seen when looking up in Walk aisles mode) */}
      <mesh position={[0, 5.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[38, 28]} />
        <meshStandardMaterial color="#e9f0f0" roughness={0.88} metalness={0.05} />
      </mesh>

      {/* Instanced anodized aluminum linear luminaire housings */}
      <instancedMesh
        ref={housingRef}
        args={[undefined, undefined, LIGHT_POSITIONS.length]}
        name="Instanced_Ceiling_Light_Housings"
      >
        <boxGeometry args={[2.8, 0.06, 0.34]} />
        <meshStandardMaterial color="#475569" metalness={0.72} roughness={0.28} />
      </instancedMesh>

      {/* Instanced high-output LED luminaire diffusers (emissive > 1.05 catches restrained Bloom) */}
      <instancedMesh
        ref={diffuserRef}
        args={[undefined, undefined, LIGHT_POSITIONS.length]}
        name="Instanced_Ceiling_Lights"
      >
        <boxGeometry args={[2.68, 0.035, 0.24]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#f4fffd"
          emissiveIntensity={1.25}
          roughness={0.15}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
