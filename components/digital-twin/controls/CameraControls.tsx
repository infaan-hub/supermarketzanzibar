"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  BUILDING_DIMENSIONS,
  resolveWalkCollision,
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

export interface CameraPose {
  x: number;
  z: number;
  yaw: number;
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
  enableShelfCollision = false,
  onCameraPoseChange,
}: {
  goal: CameraGoal | null;
  onControlsReady?: (controls: OrbitControlsImpl | null) => void;
  movementRef?: React.RefObject<CameraMovementInput>;
  movementBounds?: Bounds2D;
  enableShelfCollision?: boolean;
  onCameraPoseChange?: (pose: CameraPose) => void;
}) {
  const { camera } = useThree();
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const lastPoseEmitRef = React.useRef(0);
  const lastPoseValRef = React.useRef<CameraPose>({ x: 999, z: 999, yaw: 999 });
  const prevSafeCamRef = React.useRef<{ x: number; z: number } | null>(null);
  const isGlidingRef = React.useRef(false);

  React.useEffect(() => {
    onControlsReady?.(controlsRef.current);
  }, [onControlsReady]);

  // Cancel any in-flight GSAP glide immediately when user grabs the scene.
  React.useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const cancelTween = () => {
      isGlidingRef.current = false;
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
    isGlidingRef.current = true;

    gsap.to(camera.position, {
      x: goal.position[0],
      y: goal.position[1],
      z: goal.position[2],
      duration: 0.9,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
      onComplete: () => {
        isGlidingRef.current = false;
        prevSafeCamRef.current = { x: camera.position.x, z: camera.position.z };
      },
    });

    gsap.to(controls.target, {
      x: goal.target[0],
      y: goal.target[1],
      z: goal.target[2],
      duration: 0.9,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
    });
  }, [camera, goal]);

  // Smooth 60fps keyboard / on-screen D-pad walking with AABB shelf collision sliding.
  useFrame(({ clock }, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const input = movementRef?.current;
    if (input) {
      const moving =
        input.forward ||
        input.backward ||
        input.left ||
        input.right ||
        input.turnLeft ||
        input.turnRight;

      if (moving) {
        gsap.killTweensOf(camera.position);
        gsap.killTweensOf(controls.target);

        const dt = Math.min(delta, 0.05);

        if (input.turnLeft || input.turnRight) {
          const yaw =
            ((input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0)) * 1.65 * dt;
          TARGET_OFFSET.copy(controls.target).sub(camera.position);
          TARGET_OFFSET.applyAxisAngle(UP_AXIS, yaw);
          controls.target.copy(camera.position).add(TARGET_OFFSET);
        }

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
          const speed = 6.2;
          MOVE_VEC.normalize().multiplyScalar(speed * dt);

          const bounds = movementBounds ?? {
            minX: BUILDING_DIMENSIONS.retail.bounds.minX + 1.0,
            maxX: BUILDING_DIMENSIONS.retail.bounds.maxX - 1.0,
            minZ: BUILDING_DIMENSIONS.retail.bounds.minZ + 1.0,
            maxZ: BUILDING_DIMENSIONS.retail.bounds.maxZ + 2.0,
          };

          const desiredX = camera.position.x + MOVE_VEC.x;
          const desiredZ = camera.position.z + MOVE_VEC.z;

          // Apply AABB shelf/counter collision (+0.45m shopper radius) with axis-separated sliding.
          let nextCamX: number;
          let nextCamZ: number;
          if (enableShelfCollision && camera.position.y < 3.6) {
            [nextCamX, nextCamZ] = resolveWalkCollision(
              camera.position.x,
              camera.position.z,
              desiredX,
              desiredZ,
              0.45,
              bounds,
            );
          } else {
            nextCamX = THREE.MathUtils.clamp(desiredX, bounds.minX, bounds.maxX);
            nextCamZ = THREE.MathUtils.clamp(desiredZ, bounds.minZ, bounds.maxZ);
          }

          const appliedX = nextCamX - camera.position.x;
          const appliedZ = nextCamZ - camera.position.z;

          camera.position.x += appliedX;
          camera.position.z += appliedZ;
          controls.target.x += appliedX;
          controls.target.z += appliedZ;
        }

        controls.update();
      }
    }

    // Also enforce AABB shelf collision during low-altitude OrbitControls pan/zoom dragging.
    if (enableShelfCollision && !isGlidingRef.current && camera.position.y < 3.0) {
      const bounds = movementBounds ?? {
        minX: BUILDING_DIMENSIONS.retail.bounds.minX + 1.0,
        maxX: BUILDING_DIMENSIONS.retail.bounds.maxX - 1.0,
        minZ: BUILDING_DIMENSIONS.retail.bounds.minZ + 1.0,
        maxZ: BUILDING_DIMENSIONS.retail.bounds.maxZ + 2.0,
      };
      const prev = prevSafeCamRef.current ?? {
        x: camera.position.x,
        z: camera.position.z,
      };
      const [safeX, safeZ] = resolveWalkCollision(
        prev.x,
        prev.z,
        camera.position.x,
        camera.position.z,
        0.45,
        bounds,
      );
      const corrX = safeX - camera.position.x;
      const corrZ = safeZ - camera.position.z;
      if (Math.abs(corrX) > 1e-4 || Math.abs(corrZ) > 1e-4) {
        camera.position.x = safeX;
        camera.position.z = safeZ;
        controls.target.x += corrX;
        controls.target.z += corrZ;
        controls.update();
      }
    }
    prevSafeCamRef.current = { x: camera.position.x, z: camera.position.z };

    // Throttled pose callback (~10 Hz) to update the corner 2D radar minimap.
    if (onCameraPoseChange) {
      const now = clock.getElapsedTime();
      if (now - lastPoseEmitRef.current > 0.1) {
        lastPoseEmitRef.current = now;
        const dx = controls.target.x - camera.position.x;
        const dz = controls.target.z - camera.position.z;
        const yaw = Math.atan2(dx, dz);
        const prev = lastPoseValRef.current;
        if (
          Math.abs(prev.x - camera.position.x) > 0.08 ||
          Math.abs(prev.z - camera.position.z) > 0.08 ||
          Math.abs(prev.yaw - yaw) > 0.04
        ) {
          const next = { x: camera.position.x, z: camera.position.z, yaw };
          lastPoseValRef.current = next;
          onCameraPoseChange(next);
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={1.35}
      maxDistance={BUILDING_DIMENSIONS.cameraLimits.maxDistance}
      minPolarAngle={BUILDING_DIMENSIONS.cameraLimits.minPolarAngle}
      maxPolarAngle={BUILDING_DIMENSIONS.cameraLimits.maxPolarAngle}
      panSpeed={0.95}
      rotateSpeed={0.78}
      zoomSpeed={0.95}
    />
  );
}
