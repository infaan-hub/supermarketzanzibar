"use client";

import * as React from "react";
import { useGLTF } from "@react-three/drei";
import { CHECKOUT_LANES } from "@/lib/digital-twin/spatial-plan";
import { Floor } from "./Floor";
import { Walls } from "./Walls";
import { Ceiling } from "./Ceiling";
import { Entrance } from "./Entrance";

function CheckoutLanes() {
  const { scene } = useGLTF("/models/furniture/checkout.glb");
  const lanes = React.useMemo(
    () => CHECKOUT_LANES.map(() => scene.clone(true)),
    [scene],
  );

  return (
    <group name="Checkout_Counters_Group">
      {CHECKOUT_LANES.map((lane, idx) => (
        <primitive
          key={lane.code}
          name={lane.code}
          object={lanes[idx]}
          position={lane.position}
        />
      ))}
    </group>
  );
}

export function StoreBuilding({
  showCeiling = true,
  highlightedDepartmentCode,
}: {
  showCeiling?: boolean;
  highlightedDepartmentCode?: string | null;
}) {
  return (
    <group name="Store_Building_Root">
      <Floor highlightedDepartmentCode={highlightedDepartmentCode} />
      <Walls />
      <Ceiling visible={showCeiling} />
      <Entrance />
      <React.Suspense fallback={null}>
        <CheckoutLanes />
      </React.Suspense>
    </group>
  );
}
