"use client";

import * as React from "react";
import {
  BUILDING_DIMENSIONS,
  CHECKOUT_LANES,
  SHELF_FIXTURES,
  type Vec3,
} from "@/lib/digital-twin/spatial-plan";
import type { CameraPose } from "@/components/digital-twin/controls/CameraControls";

const ZONE_LABELS: Array<{ text: string; x: number; z: number }> = [
  { text: "GROCERY", x: -6.8, z: -4.7 },
  { text: "DRINKS", x: 3.4, z: -4.7 },
  { text: "FRESH", x: 13.8, z: 0.4 },
  { text: "DAIRY", x: 14.2, z: -5.0 },
  { text: "BAKERY", x: -15.4, z: 4.4 },
  { text: "MEAT", x: -15.4, z: -5.0 },
  { text: "CHECKOUT", x: -0.6, z: 10.7 },
];

/**
 * Compact 2D corner radar minimap overlaid on the 3D viewport.
 * Displays all 18 shelves, department zones, live shopper position & viewing cone,
 * basket item pins, search spotlight pins, guided route, and click-to-walk.
 */
export function StoreMinimap({
  pose,
  basketShelfCodes,
  searchShelfCodes,
  pathPoints,
  onWalkToPoint,
}: {
  pose: CameraPose;
  basketShelfCodes: ReadonlySet<string>;
  searchShelfCodes: ReadonlySet<string>;
  pathPoints: Vec3[];
  onWalkToPoint: (point: [number, number]) => void;
}) {
  const b = BUILDING_DIMENSIONS.retail.bounds;
  const vbX = b.minX - 1;
  const vbY = b.minZ - 1;
  const vbW = b.maxX - b.minX + 2;
  const vbH = b.maxZ - b.minZ + 2;

  const clampedX = Math.min(b.maxX - 0.5, Math.max(b.minX + 0.5, pose.x));
  const clampedZ = Math.min(b.maxZ - 0.5, Math.max(b.minZ + 0.5, pose.z));

  // Build viewing cone triangle pointing along camera yaw
  const coneLen = 5.2;
  const halfSpread = 0.45;
  const leftX = clampedX + Math.sin(pose.yaw - halfSpread) * coneLen;
  const leftZ = clampedZ + Math.cos(pose.yaw - halfSpread) * coneLen;
  const rightX = clampedX + Math.sin(pose.yaw + halfSpread) * coneLen;
  const rightZ = clampedZ + Math.cos(pose.yaw + halfSpread) * coneLen;

  // Directional nose indicator inside shopper marker
  const tipX = clampedX + Math.sin(pose.yaw) * 1.45;
  const tipZ = clampedZ + Math.cos(pose.yaw) * 1.45;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    const worldX = vbX + normX * vbW;
    const worldZ = vbY + normY * vbH;
    onWalkToPoint([worldX, worldZ]);
  };

  return (
    <div className="pointer-events-auto w-[184px] overflow-hidden rounded-md border border-border bg-white/95 shadow-md backdrop-blur-xs">
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1 text-[10px]">
        <span className="font-semibold text-foreground">Radar map</span>
        <span className="text-muted">Click to walk</span>
      </div>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="block h-[132px] w-full cursor-crosshair bg-surface-subtle"
        onClick={handleSvgClick}
        role="img"
        aria-label="Live 2D store radar minimap"
      >
        <defs>
          <radialGradient id="sz-cone-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.06" />
          </radialGradient>
        </defs>

        {/* Retail hall floor outline */}
        <rect
          x={b.minX}
          y={b.minZ}
          width={b.maxX - b.minX}
          height={b.maxZ - b.minZ}
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth={0.45}
        />

        {/* South entrance opening indicator */}
        <line
          x1={-3.5}
          y1={b.maxZ}
          x2={3.5}
          y2={b.maxZ}
          stroke="#0f766e"
          strokeWidth={0.75}
        />

        {/* Subtle department micro-labels */}
        {ZONE_LABELS.map((z) => (
          <text
            key={z.text}
            x={z.x}
            y={z.z}
            textAnchor="middle"
            fontSize="1.65"
            fontWeight="700"
            fill="#94a3b8"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {z.text}
          </text>
        ))}

        {/* Checkout counters */}
        {CHECKOUT_LANES.map((lane) => (
          <rect
            key={lane.code}
            x={lane.position[0] - lane.size[0] / 2}
            y={lane.position[2] - lane.size[2] / 2}
            width={lane.size[0]}
            height={lane.size[2]}
            fill="#cbd5e1"
            rx={0.22}
          />
        ))}

        {/* 18 Retail shelves with live basket & spotlight pins */}
        {SHELF_FIXTURES.map((f) => {
          const [w, , d] = f.size;
          const cos = Math.abs(Math.cos(f.rotationY));
          const sin = Math.abs(Math.sin(f.rotationY));
          const rw = w * cos + d * sin;
          const rd = w * sin + d * cos;
          const inBasket = basketShelfCodes.has(f.code);
          const inSearch = searchShelfCodes.has(f.code);
          const fill = inSearch
            ? "#d97706"
            : inBasket
              ? "#0f766e"
              : "#94a3b8";

          return (
            <g key={f.code}>
              <rect
                x={f.position[0] - rw / 2}
                y={f.position[2] - rd / 2}
                width={rw}
                height={rd}
                fill={fill}
                opacity={inBasket || inSearch ? 0.96 : 0.62}
                rx={0.22}
              />
              {inBasket && (
                <circle
                  cx={f.position[0]}
                  cy={f.position[2]}
                  r={0.85}
                  fill="#ffffff"
                  stroke="#0f766e"
                  strokeWidth={0.42}
                />
              )}
              {inSearch && (
                <circle
                  cx={f.position[0]}
                  cy={f.position[2]}
                  r={1.15}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={0.42}
                />
              )}
            </g>
          );
        })}

        {/* Guided shopping route preview */}
        {pathPoints.length >= 2 && (
          <polyline
            points={pathPoints.map((p) => `${p[0]},${p[2]}`).join(" ")}
            fill="none"
            stroke="#0f766e"
            strokeWidth={0.5}
            strokeDasharray="0.9 0.55"
          />
        )}

        {/* Shopper viewing cone */}
        <polygon
          points={`${clampedX},${clampedZ} ${leftX},${leftZ} ${rightX},${rightZ}`}
          fill="url(#sz-cone-grad)"
        />

        {/* Shopper heading indicator + live position dot */}
        <line
          x1={clampedX}
          y1={clampedZ}
          x2={tipX}
          y2={tipZ}
          stroke="#0f766e"
          strokeWidth={0.55}
          strokeLinecap="round"
        />
        <circle
          cx={clampedX}
          cy={clampedZ}
          r={0.92}
          fill="#0f766e"
          stroke="#ffffff"
          strokeWidth={0.42}
        />
      </svg>

      {/* Compact legend bar */}
      <div className="flex items-center justify-between border-t border-border bg-white px-2.5 py-1 text-[9px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> You
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full border border-primary bg-white" />{" "}
          Basket ({basketShelfCodes.size})
        </span>
        {searchShelfCodes.size > 0 && (
          <span className="inline-flex items-center gap-1 text-warning font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />{" "}
            Match ({searchShelfCodes.size})
          </span>
        )}
      </div>
    </div>
  );
}
