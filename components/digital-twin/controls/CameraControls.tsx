"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  BUILDING_DIMENSIONS,
  type Bounds2D,
  type Vec3,
} from "@/lib/digital-twin/spatial-plan";

export interface CameraGoal {
  position: Vec3;
  target: Vec3;
  nonce: number;
}

export interface CameraMovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

const FORWARD_VEC = new THREE.Vector3();
const RIGHT_VEC = new THREE.Vector3();
const MOVE_VEC = new THREE.Vector3();
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const TARGET_OFFSET = new THREE.Vector3();

export function CameraControls({
  goal,
  onControlsReady,
  movementRef,
  movementBounds,
}: {
  goal: CameraGoal | null;
  onControlsReady?: (controls: OrbitControlsImpl | null) => void;
  movementRef?: React.RefObject<CameraMovementInput>;
  movementBounds?: Bounds2D;
}) {
  const { camera } = useThree();
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);

  React.useEffect(() => {
    onControlsReady?.(controlsRef.current);
  }, [onControlsReady]);

  // Cancel any in-flight GSAP glide immediately when user grabs the scene.
  React.useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const cancelTween = () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(controls.target);
    };
    controls.addEventListener("start", cancelTween);
    return () => {
      controls.removeEventListener("start", cancelTween);
    };
  }, [camera]);

  React.useEffect(() => {
    if (!goal || !controlsRef.current) return;
    const controls = controlsRef.current;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    gsap.to(camera.position, {
      x: goal.position[0],
      y: goal.position[1],
      z: goal.position[2],
      duration: 0.95,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
    });

    gsap.to(controls.target, {
      x: goal.target[0],
      y: goal.target[1],
      z: goal.target[2],
      duration: 0.95,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
    });
  }, [camera, goal]);

  // Smooth 60fps keyboard / on-screen D-pad movement inside the store.
  useFrame((_, delta) => {
    const input = movementRef?.current;
    const controls = controlsRef.current;
    if (!input || !controls) return;

    const moving =
      input.forward ||
      input.backward ||
      input.left ||
      input.right ||
      input.turnLeft ||
      input.turnRight;
    if (!moving) return;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    const dt = Math.min(delta, 0.05);

    // Smooth yaw turn around current camera position (like looking around an aisle).
    if (input.turnLeft || input.turnRight) {
      const yaw = ((input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0)) * 1.65 * dt;
      TARGET_OFFSET.copy(controls.target).sub(camera.position);
      TARGET_OFFSET.applyAxisAngle(UP_AXIS, yaw);
      controls.target.copy(camera.position).add(TARGET_OFFSET);
    }

    // Horizontal forward & strafe translation.
    FORWARD_VEC.copy(controls.target).sub(camera.position);
    FORWARD_VEC.y = 0;
    if (FORWARD_VEC.lengthSq() < 1e-5) {
      FORWARD_VEC.set(0, 0, -1);
    } else {
      FORWARD_VEC.normalize();
    }
    RIGHT_VEC.crossVectors(FORWARD_VEC, UP_AXIS).normalize();

    MOVE_VEC.set(0, 0, 0);
    if (input.forward) MOVE_VEC.add(FORWARD_VEC);
    if (input.backward) MOVE_VEC.sub(FORWARD_VEC);
    if (input.right) MOVE_VEC.add(RIGHT_VEC);
    if (input.left) MOVE_VEC.sub(RIGHT_VEC);

    if (MOVE_VEC.lengthSq() > 0) {
      const speed = 6.5;
      MOVE_VEC.normalize().multiplyScalar(speed * dt);

      const bounds = movementBounds ?? {
        minX: BUILDING_DIMENSIONS.retail.bounds.minX + 1.2,
        maxX: BUILDING_DIMENSIONS.retail.bounds.maxX - 1.2,
        minZ: BUILDING_DIMENSIONS.retail.bounds.minZ + 1.2,
        maxZ: BUILDING_DIMENSIONS.retail.bounds.maxZ + 2.5,
      };

      const nextCamX = THREE.MathUtils.clamp(
        camera.position.x + MOVE_VEC.x,
        bounds.minX,
        bounds.maxX,
      );
      const nextCamZ = THREE.MathUtils.clamp(
        camera.position.z + MOVE_VEC.z,
        bounds.minZ,
        bounds.maxZ,
      );

      const appliedX = nextCamX - camera.position.x;
      const appliedZ = nextCamZ - camera.position.z;

      camera.position.x += appliedX;
      camera.position.z += appliedZ;
      controls.target.x += appliedX;
      controls.target.z += appliedZ;
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={1.4}
      maxDistance={BUILDING_DIMENSIONS.cameraLimits.maxDistance}
      minPolarAngle={BUILDING_DIMENSIONS.cameraLimits.minPolarAngle}
      maxPolarAngle={BUILDING_DIMENSIONS.cameraLimits.maxPolarAngle}
      panSpeed={0.95}
      rotateSpeed={0.78}
      zoomSpeed={0.95}
    />
  );
}
