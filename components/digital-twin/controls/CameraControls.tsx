"use client";

import * as React from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import gsap from "gsap";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  BUILDING_DIMENSIONS,
  type Vec3,
} from "@/lib/digital-twin/spatial-plan";

export interface CameraGoal {
  position: Vec3;
  target: Vec3;
  nonce: number;
}

export function CameraControls({
  goal,
  onControlsReady,
}: {
  goal: CameraGoal | null;
  onControlsReady?: (controls: OrbitControlsImpl | null) => void;
}) {
  const { camera } = useThree();
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);

  React.useEffect(() => {
    onControlsReady?.(controlsRef.current);
  }, [onControlsReady]);

  React.useEffect(() => {
    if (!goal || !controlsRef.current) return;
    const controls = controlsRef.current;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    gsap.to(camera.position, {
      x: goal.position[0],
      y: goal.position[1],
      z: goal.position[2],
      duration: 1.05,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
    });

    gsap.to(controls.target, {
      x: goal.target[0],
      y: goal.target[1],
      z: goal.target[2],
      duration: 1.05,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
    });
  }, [camera, goal]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={BUILDING_DIMENSIONS.cameraLimits.minDistance}
      maxDistance={BUILDING_DIMENSIONS.cameraLimits.maxDistance}
      minPolarAngle={BUILDING_DIMENSIONS.cameraLimits.minPolarAngle}
      maxPolarAngle={BUILDING_DIMENSIONS.cameraLimits.maxPolarAngle}
      panSpeed={0.9}
      rotateSpeed={0.75}
      zoomSpeed={0.9}
    />
  );
}
