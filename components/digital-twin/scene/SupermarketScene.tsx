"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_PRESETS,
  PHYSICAL_AREAS,
  type Bounds2D,
} from "@/lib/digital-twin/spatial-plan";
import type {
  GraphicsQuality,
  TwinSceneScope,
  TwinSelection,
  TwinShelfNode,
  TwinShelfPositionNode,
  TwinViewMode,
  TwinWarehousePositionNode,
  TwinWarehouseRackNode,
} from "@/types/digital-twin";
import { StoreEnvironment } from "./StoreEnvironment";
import { LightingSystem } from "./LightingSystem";
import { CameraSystem } from "./CameraSystem";
import type {
  CameraGoal,
  CameraMovementInput,
} from "@/components/digital-twin/controls/CameraControls";
import { StoreBuilding } from "@/components/digital-twin/building/StoreBuilding";
import { Department } from "@/components/digital-twin/departments/Department";
import { Shelf } from "@/components/digital-twin/shelves/Shelf";
import { WarehouseScene } from "@/components/digital-twin/warehouse/WarehouseScene";

export interface SupermarketSceneProps {
  shelves: TwinShelfNode[];
  warehouseRacks: TwinWarehouseRackNode[];
  viewMode: TwinViewMode;
  sceneScope: TwinSceneScope;
  quality: GraphicsQuality;
  showCeiling: boolean;
  selection: TwinSelection;
  cameraGoal: CameraGoal | null;
  recentlyRestockedPositionIds: ReadonlySet<string>;
  onSelectDepartment: (code: string) => void;
  onSelectShelf: (shelf: TwinShelfNode) => void;
  onSelectProduct: (pos: TwinShelfPositionNode) => void;
  onSelectWarehousePosition: (pos: TwinWarehousePositionNode) => void;
  onClearSelection: () => void;
  onControlsReady?: (controls: OrbitControlsImpl | null) => void;
  movementRef?: React.RefObject<CameraMovementInput>;
  movementBounds?: Bounds2D;
  shopperMode?: boolean;
  basketQuantities?: Readonly<Record<string, number>>;
}

export function SupermarketScene({
  shelves,
  warehouseRacks,
  viewMode,
  sceneScope,
  quality,
  showCeiling,
  selection,
  cameraGoal,
  recentlyRestockedPositionIds,
  onSelectDepartment,
  onSelectShelf,
  onSelectProduct,
  onSelectWarehousePosition,
  onClearSelection,
  onControlsReady,
  movementRef,
  movementBounds,
  shopperMode = false,
  basketQuantities,
}: SupermarketSceneProps) {
  const highlightedDepartmentCode =
    selection?.type === "department" ? selection.departmentCode : null;
  const selectedShelfId = selection?.type === "shelf" ? selection.shelfId : null;
  const selectedPositionId =
    selection?.type === "product" ? selection.positionId : null;
  const selectedLocationId =
    selection?.type === "warehouse_position" ? selection.locationId : null;

  const dpr: [number, number] =
    quality === "high" ? [1, 2] : quality === "balanced" ? [1, 1.5] : [0.75, 1];

  const showRetail = sceneScope !== "warehouse";
  const showWarehouse = sceneScope !== "supermarket";

  const visibleAreas = PHYSICAL_AREAS.filter((area) => {
    if (sceneScope === "warehouse") {
      return area.category === "warehouse" || area.category === "operations";
    }
    if (sceneScope === "supermarket") {
      return area.category !== "warehouse" && area.category !== "operations";
    }
    return true;
  });

  return (
    <Canvas
      shadows={quality !== "low"}
      dpr={dpr}
      camera={{
        position: CAMERA_PRESETS.overview.position,
        fov: 45,
        near: 0.15,
        far: 160,
      }}
      gl={{
        antialias: quality !== "low",
        powerPreference: "high-performance",
      }}
      onPointerMissed={onClearSelection}
      className="h-full w-full"
    >
      <StoreEnvironment quality={quality} />
      <LightingSystem quality={quality} />
      <CameraSystem
        goal={cameraGoal}
        onControlsReady={onControlsReady}
        movementRef={movementRef}
        movementBounds={movementBounds}
      />

      <StoreBuilding
        showCeiling={showCeiling}
        highlightedDepartmentCode={highlightedDepartmentCode}
      />

      {/* Overhead 3D department signage */}
      {visibleAreas
        .filter((a) => a.category === "retail" || a.category === "warehouse")
        .map((area) => (
          <Department
            key={area.id}
            area={area}
            isSelected={highlightedDepartmentCode === area.code}
            isDimmed={Boolean(
              highlightedDepartmentCode &&
                highlightedDepartmentCode !== area.code,
            )}
            onSelect={onSelectDepartment}
          />
        ))}

      {/* Retail supermarket shelves & products */}
      {showRetail &&
        shelves.map((shelf) => (
          <Shelf
            key={shelf.id}
            shelf={shelf}
            viewMode={viewMode}
            isSelected={selectedShelfId === shelf.id}
            isDimmed={Boolean(
              highlightedDepartmentCode &&
                shelf.departmentCode.toUpperCase() !==
                  highlightedDepartmentCode.toUpperCase(),
            )}
            selectedPositionId={selectedPositionId}
            recentlyRestockedPositionIds={recentlyRestockedPositionIds}
            onSelectShelf={onSelectShelf}
            onSelectProduct={onSelectProduct}
            shopperMode={shopperMode}
            basketQuantities={basketQuantities}
          />
        ))}

      {/* Back-of-house Warehouse Digital Twin */}
      {showWarehouse && (
        <WarehouseScene
          racks={warehouseRacks}
          viewMode={viewMode}
          selectedLocationId={selectedLocationId}
          onSelectPosition={onSelectWarehousePosition}
        />
      )}
    </Canvas>
  );
}
