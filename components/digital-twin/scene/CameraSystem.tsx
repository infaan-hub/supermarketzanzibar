"use client";

import * as React from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Bounds2D } from "@/lib/digital-twin/spatial-plan";
import {
  CameraControls,
  type CameraGoal,
  type CameraMovementInput,
  type CameraPose,
} from "@/components/digital-twin/controls/CameraControls";

export function CameraSystem({
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
  return (
    <CameraControls
      goal={goal}
      onControlsReady={onControlsReady}
      movementRef={movementRef}
      movementBounds={movementBounds}
      enableShelfCollision={enableShelfCollision}
      onCameraPoseChange={onCameraPoseChange}
    />
  );
}
