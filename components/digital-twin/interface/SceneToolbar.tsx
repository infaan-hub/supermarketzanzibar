"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  GraphicsQuality,
  TwinLocateResult,
  TwinSceneScope,
  TwinViewMode,
} from "@/types/digital-twin";

export function SceneToolbar({
  storeName,
  sceneScope,
  onSceneScopeChange,
  viewMode,
  onViewModeChange,
  quality,
  onQualityChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searching,
  locateResult,
  onPickLocation,
  onClearLocate,
  onToggleLeftSidebar,
  onToggleRightPanel,
  onToggleFullscreen,
  isFullscreen,
  onRefresh,
  refreshing,
}: {
  storeName: string;
  sceneScope: TwinSceneScope;
  onSceneScopeChange: (scope: TwinSceneScope) => void;
  viewMode: TwinViewMode;
  onViewModeChange: (mode: TwinViewMode) => void;
  quality: GraphicsQuality;
  onQualityChange: (q: GraphicsQuality) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  searching: boolean;
  locateResult: TwinLocateResult | null;
  onPickLocation: (
    loc: TwinLocateResult["matches"][number]["locations"][number],
  ) => void;
  onClearLocate: () => void;
  onToggleLeftSidebar: () => void;
  onToggleRightPanel: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onToggleLeftSidebar}
          aria-label="Toggle navigation sidebar"
        >
          Map Tree
        </Button>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-foreground">{storeName}</p>
        </div>

        <Select
          value={sceneScope}
          onChange={(e) => onSceneScopeChange(e.target.value as TwinSceneScope)}
          className="h-8 w-36 text-xs"
          aria-label="Scene area scope"
        >
          <option value="combined">Full Complex</option>
          <option value="supermarket">Retail Store</option>
          <option value="warehouse">3D Warehouse</option>
        </Select>

        <Select
          value={viewMode}
          onChange={(e) => onViewModeChange(e.target.value as TwinViewMode)}
          className="h-8 w-36 text-xs"
          aria-label="Visualization mode"
        >
          <option value="realistic">Realistic Mode</option>
          <option value="inventory">Inventory State</option>
          <option value="heatmap">3D Heatmap</option>
        </Select>
      </div>

      {/* Phase 15 Global 3D Product & Location Finder */}
      <div className="relative flex-1 min-w-[210px] max-w-md">
        <form onSubmit={onSearchSubmit} className="flex gap-1.5">
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Locate product, barcode, SKU, shelf, or rack…"
            className="h-8 text-xs"
            aria-label="Locate product or location in 3D"
          />
          <Button
            type="submit"
            size="sm"
            isLoading={searching}
            disabled={!searchQuery.trim()}
          >
            Locate
          </Button>
        </form>

        {locateResult && (
          <div className="absolute left-0 right-0 top-10 z-50 max-h-72 overflow-y-auto rounded-lg border border-border bg-white p-2 shadow-[var(--shadow-popover)]">
            <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] text-muted">
              <span>
                {locateResult.matches.length} match(es) for &ldquo;
                {locateResult.query}&rdquo;
              </span>
              <button
                type="button"
                onClick={onClearLocate}
                className="font-medium text-primary hover:underline cursor-pointer"
              >
                Close
              </button>
            </div>
            {locateResult.matches.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted">
                No matching products, shelves, or warehouse slots found.
              </p>
            ) : (
              <div className="space-y-1.5">
                {locateResult.matches.map((m) => (
                  <div
                    key={m.productId}
                    className="rounded-md border border-border bg-surface-subtle p-2"
                  >
                    <p className="text-xs font-medium text-foreground">
                      {m.productName}{" "}
                      <span className="font-mono text-[10px] text-muted">
                        ({m.barcode})
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.locations.length === 0 ? (
                        <span className="text-[11px] text-muted">
                          Not yet placed on a shelf or warehouse rack
                        </span>
                      ) : (
                        m.locations.map((loc) => (
                          <button
                            key={`${loc.kind}-${loc.id}`}
                            type="button"
                            onClick={() => onPickLocation(loc)}
                            className="rounded border border-border bg-white px-2 py-1 text-[11px] font-medium text-foreground hover:border-border-hover hover:bg-surface-subtle cursor-pointer"
                          >
                            {loc.kind === "shelf" ? "Shelf" : "Warehouse"}:{" "}
                            <strong>{loc.code}</strong> ({loc.quantity} u)
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={quality}
          onChange={(e) => onQualityChange(e.target.value as GraphicsQuality)}
          className="h-8 w-28 text-xs"
          aria-label="Graphics quality"
        >
          <option value="low">Low 3D</option>
          <option value="balanced">Balanced</option>
          <option value="high">High 3D</option>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          isLoading={refreshing}
        >
          Sync
        </Button>
        <Button size="sm" variant="secondary" onClick={onToggleRightPanel}>
          Inspector
        </Button>
        <Button size="sm" variant="secondary" onClick={onToggleFullscreen}>
          {isFullscreen ? "Exit Full" : "Fullscreen"}
        </Button>
      </div>
    </div>
  );
}
