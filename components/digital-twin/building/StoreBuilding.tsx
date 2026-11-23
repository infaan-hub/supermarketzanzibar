"use client";

import * as React from "react";
import { Text, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CHECKOUT_LANES } from "@/lib/digital-twin/spatial-plan";
import { Floor } from "./Floor";
import { Walls } from "./Walls";
import { Ceiling } from "./Ceiling";
import { Entrance } from "./Entrance";

function CheckoutLanes() {
  const { scene } = useGLTF("/models/furniture/checkout.glb");
  const lanes = React.useMemo(
    () =>
      CHECKOUT_LANES.map(() => {
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
      }),
    [scene],
  );

  return (
    <group name="Checkout_Counters_Group">
      {CHECKOUT_LANES.map((lane, idx) => (
        <group key={lane.code} name={lane.code} position={lane.position}>
          <primitive object={lanes[idx]} />
          {/* Illuminated Lane Number on both sides of the checkout pole box */}
          <Text
            position={[0.55, 2.28, -0.84]}
            fontSize={0.14}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {String(idx + 1)}
          </Text>
          <Text
            position={[0.55, 2.28, -0.96]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.14}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {String(idx + 1)}
          </Text>
        </group>
      ))}
    </group>
  );
}

export function StoreBuilding({
  showCeiling = true,
  highlightedDepartmentCode,
  shopperMode = false,
  onWalkToFloorPoint,
}: {
  showCeiling?: boolean;
  highlightedDepartmentCode?: string | null;
  shopperMode?: boolean;
  onWalkToFloorPoint?: (point: [number, number]) => void;
}) {
  return (
    <group name="Store_Building_Root">
      <Floor
        highlightedDepartmentCode={highlightedDepartmentCode}
        shopperMode={shopperMode}
        onWalkToFloorPoint={onWalkToFloorPoint}
      />
      <Walls />
      <Ceiling visible={showCeiling} />
      <Entrance />
      <React.Suspense fallback={null}>
        <CheckoutLanes />
      </React.Suspense>
    </group>
  );
}
