"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function NavigationControls({
  onZoomIn,
  onZoomOut,
  onResetCamera,
  onTopDown,
  onToggleCeiling,
  showCeiling,
  is2DMode,
  onToggle2DMode,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCamera: () => void;
  onTopDown: () => void;
  onToggleCeiling: () => void;
  showCeiling: boolean;
  is2DMode: boolean;
  onToggle2DMode: () => void;
}) {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-white/95 px-2.5 py-1.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {!is2DMode && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={onZoomIn}
              title="Zoom in"
            >
              + Zoom
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onZoomOut}
              title="Zoom out"
            >
              − Zoom
            </Button>
            <Button size="sm" variant="secondary" onClick={onResetCamera}>
              Overview
            </Button>
            <Button size="sm" variant="secondary" onClick={onTopDown}>
              Top-Down
            </Button>
            <Button size="sm" variant="secondary" onClick={onToggleCeiling}>
              {showCeiling ? "Hide roof" : "Show roof"}
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant={is2DMode ? "default" : "secondary"}
          onClick={onToggle2DMode}
        >
          {is2DMode ? "3D View" : "2D Floor Plan"}
        </Button>
      </div>
      <p className="hidden text-[11px] text-muted md:block">
        Drag to orbit · Scroll to zoom · Right-drag to pan · Click objects to inspect
      </p>
    </div>
  );
}
