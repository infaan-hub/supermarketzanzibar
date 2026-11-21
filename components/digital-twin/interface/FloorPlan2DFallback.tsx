"use client";

import * as React from "react";
import {
  BUILDING_DIMENSIONS,
  PHYSICAL_AREAS,
} from "@/lib/digital-twin/spatial-plan";
import {
  INVENTORY_STATE_STYLES,
  heatmapColorForState,
} from "@/lib/digital-twin/inventory-state";
import type {
  TwinSelection,
  TwinShelfNode,
  TwinViewMode,
  TwinWarehousePositionNode,
  TwinWarehouseRackNode,
} from "@/types/digital-twin";

export function FloorPlan2DFallback({
  shelves,
  warehouseRacks,
  viewMode,
  selection,
  onSelectDepartment,
  onSelectShelf,
  onSelectWarehousePosition,
  reason,
}: {
  shelves: TwinShelfNode[];
  warehouseRacks: TwinWarehouseRackNode[];
  viewMode: TwinViewMode;
  selection: TwinSelection;
  onSelectDepartment: (code: string) => void;
  onSelectShelf: (shelf: TwinShelfNode) => void;
  onSelectWarehousePosition: (pos: TwinWarehousePositionNode) => void;
  reason?: string;
}) {
  const { minX, maxX, minZ, maxZ } = BUILDING_DIMENSIONS.totalBounds;
  const vbWidth = maxX - minX + 2;
  const vbHeight = maxZ - minZ + 2;

  return (
    <div className="flex h-full w-full flex-col bg-[#f4fbfa] p-4 overflow-auto">
      {reason && (
        <div className="mb-3 rounded-lg border border-teal-200 bg-white/90 px-3 py-2 text-xs text-slate-700">
          <strong>2D Floor-Plan Mode:</strong> {reason}
        </div>
      )}

      <div className="mx-auto flex flex-1 w-full max-w-[920px] items-center justify-center">
        <svg
          viewBox={`${minX - 1} ${minZ - 1} ${vbWidth} ${vbHeight}`}
          className="h-full max-h-[680px] w-full rounded-xl border border-teal-200/80 bg-white shadow-sm"
          role="img"
          aria-label="Interactive 2D supermarket and warehouse floor plan"
        >
          {/* Building envelope */}
          <rect
            x={-19}
            y={-30}
            width={38}
            height={16}
            fill="#eef2f5"
            stroke="#94a3b8"
            strokeWidth={0.25}
          />
          <rect
            x={-19}
            y={-14}
            width={38}
            height={28}
            fill="#f7fcfb"
            stroke="#0f766e"
            strokeWidth={0.28}
          />

          {/* 18 Physical areas */}
          {PHYSICAL_AREAS.map((area) => {
            const w = area.bounds.maxX - area.bounds.minX;
            const h = area.bounds.maxZ - area.bounds.minZ;
            const isSelected =
              selection?.type === "department" &&
              selection.departmentCode === area.code;

            return (
              <g
                key={area.id}
                onClick={() => onSelectDepartment(area.code)}
                className="cursor-pointer"
              >
                <rect
                  x={area.bounds.minX}
                  y={area.bounds.minZ}
                  width={w}
                  height={h}
                  rx={0.35}
                  fill={area.accentColor}
                  fillOpacity={isSelected ? 0.28 : 0.08}
                  stroke={area.accentColor}
                  strokeOpacity={isSelected ? 0.95 : 0.4}
                  strokeWidth={isSelected ? 0.24 : 0.1}
                />
                <text
                  x={area.bounds.minX + w / 2}
                  y={area.bounds.minZ + 1.05}
                  fontSize={0.78}
                  fontWeight={700}
                  fill="#0f172a"
                  textAnchor="middle"
                >
                  {area.code}
                </text>
              </g>
            );
          })}

          {/* Clickable retail shelves */}
          {shelves.map((shelf) => {
            const isSelected =
              selection?.type === "shelf" && selection.shelfId === shelf.id;
            const isRotated = Math.abs(Math.sin(shelf.rotationY)) > 0.5;
            const w = isRotated ? shelf.size[2] : shelf.size[0];
            const d = isRotated ? shelf.size[0] : shelf.size[2];
            const color =
              viewMode === "heatmap"
                ? heatmapColorForState(shelf.visualState, true)
                : INVENTORY_STATE_STYLES[shelf.visualState].color;

            return (
              <g
                key={shelf.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectShelf(shelf);
                }}
                className="cursor-pointer"
              >
                <rect
                  x={shelf.position[0] - w / 2}
                  y={shelf.position[2] - d / 2}
                  width={w}
                  height={d}
                  rx={0.18}
                  fill={color}
                  fillOpacity={isSelected ? 0.95 : 0.72}
                  stroke={isSelected ? "#0f172a" : "#ffffff"}
                  strokeWidth={isSelected ? 0.22 : 0.08}
                />
                <text
                  x={shelf.position[0]}
                  y={shelf.position[2] + 0.2}
                  fontSize={0.55}
                  fontWeight={700}
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  {shelf.totalUnits}
                </text>
              </g>
            );
          })}

          {/* Clickable warehouse racks */}
          {warehouseRacks.map((rack) => {
            const firstPos = rack.positions[0];
            const color =
              viewMode === "heatmap"
                ? heatmapColorForState(rack.visualState, true)
                : "#ea580c";

            return (
              <g
                key={rack.rackCode}
                onClick={(e) => {
                  e.stopPropagation();
                  if (firstPos) onSelectWarehousePosition(firstPos);
                }}
                className="cursor-pointer"
              >
                <rect
                  x={rack.position[0] - rack.size[0] / 2}
                  y={rack.position[2] - rack.size[2] / 2}
                  width={rack.size[0]}
                  height={rack.size[2]}
                  rx={0.18}
                  fill={color}
                  fillOpacity={0.82}
                  stroke="#ffffff"
                  strokeWidth={0.1}
                />
                <text
                  x={rack.position[0]}
                  y={rack.position[2] + 0.22}
                  fontSize={0.62}
                  fontWeight={700}
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  {rack.rackCode} ({rack.totalUnits})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
