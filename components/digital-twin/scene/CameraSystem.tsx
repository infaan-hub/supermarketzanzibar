"use client";

import * as React from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CameraControls,
  type CameraGoal,
} from "@/components/digital-twin/controls/CameraControls";

export function CameraSystem({
  goal,
  onControlsReady,
}: {
  goal: CameraGoal | null;
  onControlsReady?: (controls: OrbitControlsImpl | null) => void;
}) {
  return <CameraControls goal={goal} onControlsReady={onControlsReady} />;
}
