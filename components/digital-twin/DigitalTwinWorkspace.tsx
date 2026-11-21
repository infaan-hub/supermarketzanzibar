"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/components/auth/auth-provider";
import { isInventoryRole, isManagerRole } from "@/lib/auth/roles";
import {
  fetchDigitalTwin,
  initializeDigitalTwin,
  locateInTwin,
  transferWarehouseStockToShelf,
} from "@/lib/api";
import { useDigitalTwinRealtime } from "@/hooks/useDigitalTwinRealtime";
import {
  CAMERA_PRESETS,
  findAreaByCode,
  findFixtureByCode,
  shelfSlotWorldPosition,
} from "@/lib/digital-twin/spatial-plan";
import type { CameraGoal } from "@/components/digital-twin/controls/CameraControls";
import { SelectionControls } from "@/components/digital-twin/controls/SelectionControls";
import { NavigationControls } from "@/components/digital-twin/controls/NavigationControls";
import { DepartmentNavigation } from "@/components/digital-twin/departments/DepartmentNavigation";
import { SceneToolbar } from "@/components/digital-twin/interface/SceneToolbar";
import { InventoryOverlay } from "@/components/digital-twin/interface/InventoryOverlay";
import { ObjectInformationPanel } from "@/components/digital-twin/interface/ObjectInformationPanel";
import { FloorPlan2DFallback } from "@/components/digital-twin/interface/FloorPlan2DFallback";
import {
  WebGLErrorBoundary,
  isWebGLAvailable,
} from "@/components/digital-twin/interface/WebGLErrorBoundary";
import type {
  DigitalTwinSnapshot,
  GraphicsQuality,
  TwinLocateResult,
  TwinSceneScope,
  TwinSelection,
  TwinShelfNode,
  TwinShelfPositionNode,
  TwinViewMode,
  TwinWarehousePositionNode,
  TwinWarehouseRackNode,
} from "@/types/digital-twin";

const SupermarketScene = dynamic(
  () =>
    import("@/components/digital-twin/scene/SupermarketScene").then(
      (mod) => mod.SupermarketScene,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#f0faf9]">
        <div className="rounded-2xl border border-teal-200 bg-white/90 px-6 py-4 text-center shadow-sm">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="font-display text-sm font-semibold text-teal-950">
            Loading 3D Digital Twin Engine…
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Streaming PBR GLB store models & PostgreSQL stock state
          </p>
        </div>
      </div>
    ),
  },
);

export interface DigitalTwinWorkspaceProps {
  initialScope?: TwinSceneScope;
  initialDepartment?: string | null;
  initialShelfCode?: string | null;
  initialSearch?: string | null;
  embedded?: boolean;
}

export function DigitalTwinWorkspace({
  initialScope = "combined",
  initialDepartment = null,
  initialShelfCode = null,
  initialSearch = null,
  embedded = false,
}: DigitalTwinWorkspaceProps) {
  const { user } = useAuth();
  const canRestock = isInventoryRole(user?.role);
  const canInitialize = isManagerRole(user?.role);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const initialFocusAppliedRef = React.useRef(false);

  const [snapshot, setSnapshot] = React.useState<DigitalTwinSnapshot | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [initializing, setInitializing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [sceneScope, setSceneScope] =
    React.useState<TwinSceneScope>(initialScope);
  const [viewMode, setViewMode] = React.useState<TwinViewMode>("realistic");
  const [quality, setQuality] = React.useState<GraphicsQuality>("balanced");
  const [showCeiling, setShowCeiling] = React.useState(false);
  const [is2DMode, setIs2DMode] = React.useState(false);
  const [webglSupported, setWebglSupported] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const [leftOpen, setLeftOpen] = React.useState(!embedded);
  const [rightOpen, setRightOpen] = React.useState(true);

  const [selection, setSelection] = React.useState<TwinSelection>(null);
  const [cameraGoal, setCameraGoal] = React.useState<CameraGoal | null>(
    initialScope === "warehouse"
      ? {
          position: CAMERA_PRESETS.warehouse.position,
          target: CAMERA_PRESETS.warehouse.target,
          nonce: 1,
        }
      : {
          position: CAMERA_PRESETS.overview.position,
          target: CAMERA_PRESETS.overview.target,
          nonce: 1,
        },
  );

  // Phase 14 Heatmap & inventory filters
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [zoneFilter, setZoneFilter] = React.useState<string>("ALL");

  // Phase 15 Global 3D Locator state
  const [searchQuery, setSearchQuery] = React.useState(initialSearch ?? "");
  const [searching, setSearching] = React.useState(false);
  const [locateResult, setLocateResult] =
    React.useState<TwinLocateResult | null>(null);

  // Phase 13 Post-commit GSAP restocking animation tracker
  const [recentlyRestockedIds, setRecentlyRestockedIds] = React.useState<
    Set<string>
  >(() => new Set());
  const [lastEventMessage, setLastEventMessage] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    const ok = isWebGLAvailable();
    setWebglSupported(ok);
    if (!ok) setIs2DMode(true);
  }, []);

  React.useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const flyTo = React.useCallback(
    (position: [number, number, number], target: [number, number, number]) => {
      setCameraGoal({ position, target, nonce: Date.now() + Math.random() });
    },
    [],
  );

  const loadSnapshot = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDigitalTwin();
      setSnapshot(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load 3D Digital Twin data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSnapshot(false);
  }, [loadSnapshot]);

  // Mark a shelf position for Phase 13 GSAP restock highlight animation for 4s.
  const triggerRestockHighlight = React.useCallback((positionId: string) => {
    setRecentlyRestockedIds((prev) => {
      const next = new Set(prev);
      next.add(positionId);
      return next;
    });
    window.setTimeout(() => {
      setRecentlyRestockedIds((prev) => {
        const next = new Set(prev);
        next.delete(positionId);
        return next;
      });
    }, 4200);
  }, []);

  // Phase 12 Live SSE subscription (updates React state without reloading Canvas).
  const { connected: realtimeConnected } = useDigitalTwinRealtime(
    React.useCallback(
      (evt) => {
        const msg = evt.summary ?? `Live update: ${evt.type.replace("_", " ")}`;
        setLastEventMessage(msg);
        if (evt.type === "stock_transferred" && evt.positionId) {
          triggerRestockHighlight(evt.positionId);
        }
        void loadSnapshot(true);
        window.setTimeout(() => {
          setLastEventMessage((cur) => (cur === msg ? null : cur));
        }, 5000);
      },
      [loadSnapshot, triggerRestockHighlight],
    ),
    true,
  );

  const handleSelectDepartment = React.useCallback(
    (code: string) => {
      const area = findAreaByCode(code);
      setSelection({ type: "department", departmentCode: code });
      setRightOpen(true);
      if (area) {
        flyTo(area.cameraPosition, area.cameraTarget);
      }
    },
    [flyTo],
  );

  const handleSelectShelf = React.useCallback(
    (shelf: TwinShelfNode) => {
      setSelection({
        type: "shelf",
        shelfId: shelf.id,
        shelfCode: shelf.code,
      });
      setRightOpen(true);
      const fixture = findFixtureByCode(shelf.code);
      const offset = fixture?.cameraOffset ?? [4.2, 2.5, 4.2];
      flyTo(
        [
          shelf.position[0] + offset[0],
          shelf.position[1] + offset[1],
          shelf.position[2] + offset[2],
        ],
        [shelf.position[0], shelf.position[1] + 1.0, shelf.position[2]],
      );
    },
    [flyTo],
  );

  const handleSelectProduct = React.useCallback(
    (pos: TwinShelfPositionNode) => {
      if (!pos.product) return;
      setSelection({
        type: "product",
        productId: pos.product.id,
        positionId: pos.id,
        shelfCode: pos.shelfCode,
        objectName: pos.objectName,
      });
      setRightOpen(true);
      const fixture = findFixtureByCode(pos.shelfCode);
      const target = fixture
        ? shelfSlotWorldPosition(fixture, pos.slotIndex)
        : ([0, 1.2, 0] as [number, number, number]);
      const offset = fixture?.cameraOffset ?? [2.8, 1.4, 2.8];
      flyTo(
        [
          target[0] + offset[0] * 0.58,
          target[1] + 0.9,
          target[2] + offset[2] * 0.58,
        ],
        target,
      );
    },
    [flyTo],
  );

  const handleSelectWarehousePosition = React.useCallback(
    (pos: TwinWarehousePositionNode) => {
      setSelection({
        type: "warehouse_position",
        locationId: pos.id,
        rackCode: pos.rackCode,
        objectName: pos.objectName,
      });
      setRightOpen(true);
      const rack = snapshot?.warehouseRacks.find(
        (r) => r.rackCode === pos.rackCode,
      );
      if (rack) {
        flyTo(
          [rack.position[0] + 4.5, 4.2, rack.position[2] + 5.0],
          [rack.position[0], 1.6, rack.position[2]],
        );
      }
    },
    [flyTo, snapshot],
  );

  const handleSelectWarehouseRack = React.useCallback(
    (rack: TwinWarehouseRackNode) => {
      const firstPopulated =
        rack.positions.find((p) => p.product !== null) ?? rack.positions[0];
      if (firstPopulated) {
        handleSelectWarehousePosition(firstPopulated);
      } else {
        flyTo(
          [rack.position[0] + 5.2, 4.8, rack.position[2] + 5.5],
          [rack.position[0], 1.6, rack.position[2]],
        );
      }
    },
    [flyTo, handleSelectWarehousePosition],
  );

  // Apply deep-link URL focus once after initial snapshot loads.
  React.useEffect(() => {
    if (!snapshot?.initialized || initialFocusAppliedRef.current) return;
    initialFocusAppliedRef.current = true;

    if (initialShelfCode) {
      const match = snapshot.shelves.find(
        (s) => s.code.toLowerCase() === initialShelfCode.toLowerCase(),
      );
      if (match) {
        handleSelectShelf(match);
        return;
      }
    }
    if (initialDepartment) {
      handleSelectDepartment(initialDepartment.toUpperCase());
      return;
    }
    if (initialSearch) {
      void (async () => {
        setSearching(true);
        try {
          const res = await locateInTwin(initialSearch);
          setLocateResult(res);
          const firstLoc = res.matches[0]?.locations[0];
          if (firstLoc) {
            setSelection(firstLoc.selection);
            flyTo(firstLoc.cameraPosition, firstLoc.cameraTarget);
          }
        } finally {
          setSearching(false);
        }
      })();
    }
  }, [
    snapshot,
    initialDepartment,
    initialShelfCode,
    initialSearch,
    handleSelectDepartment,
    handleSelectShelf,
    flyTo,
  ]);

  const handleInitialize = async () => {
    setInitializing(true);
    setError(null);
    try {
      const next = await initializeDigitalTwin();
      setSnapshot(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to initialize Digital Twin store layout.",
      );
    } finally {
      setInitializing(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await locateInTwin(q);
      setLocateResult(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "3D location search failed.",
      );
    } finally {
      setSearching(false);
    }
  };

  const handlePickLocateResult = (
    loc: TwinLocateResult["matches"][number]["locations"][number],
  ) => {
    setLocateResult(null);
    if (loc.kind === "warehouse" && sceneScope === "supermarket") {
      setSceneScope("combined");
    } else if (loc.kind === "shelf" && sceneScope === "warehouse") {
      setSceneScope("combined");
    }
    setSelection(loc.selection);
    setRightOpen(true);
    flyTo(loc.cameraPosition, loc.cameraTarget);
  };

  const handleRestockShelfPosition = async (
    positionId: string,
    quantity: number,
  ) => {
    const res = await transferWarehouseStockToShelf({
      shelfPositionId: positionId,
      quantity,
    });
    triggerRestockHighlight(res.positionId);
    setLastEventMessage(
      `Restocked +${quantity} ${res.productName} onto ${res.shelfCode}`,
    );
    await loadSnapshot(true);
  };

  const handleTransferFromWarehouse = async (
    warehouseLocationId: string,
    targetShelfPositionId: string,
    quantity: number,
  ) => {
    const res = await transferWarehouseStockToShelf({
      warehouseLocationId,
      shelfPositionId: targetShelfPositionId,
      quantity,
    });
    triggerRestockHighlight(res.positionId);
    setLastEventMessage(
      `Transferred +${quantity} ${res.productName} to ${res.shelfCode}`,
    );
    await loadSnapshot(true);
  };

  const handleSceneScopeChange = (scope: TwinSceneScope) => {
    setSceneScope(scope);
    if (scope === "warehouse") {
      flyTo(
        CAMERA_PRESETS.warehouse.position,
        CAMERA_PRESETS.warehouse.target,
      );
    } else if (scope === "supermarket") {
      flyTo(CAMERA_PRESETS.overview.position, CAMERA_PRESETS.overview.target);
    } else {
      flyTo(CAMERA_PRESETS.overview.position, CAMERA_PRESETS.overview.target);
    }
  };

  const handleZoom = (factor: number) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const cam = ctrl.object;
    const dir = cam.position.clone().sub(ctrl.target);
    const nextLen = Math.min(48, Math.max(2.5, dir.length() * factor));
    dir.setLength(nextLen);
    const nextPos = ctrl.target.clone().add(dir);
    flyTo([nextPos.x, Math.max(1.2, nextPos.y), nextPos.z], [
      ctrl.target.x,
      ctrl.target.y,
      ctrl.target.z,
    ]);
  };

  const handleToggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  };

  // Filtered shelves & warehouse racks for Phase 14 heatmap / focus filtering.
  const filteredShelves = React.useMemo(() => {
    if (!snapshot) return [];
    return snapshot.shelves.filter((shelf) => {
      if (deptFilter !== "ALL" && shelf.departmentCode !== deptFilter) {
        return false;
      }
      if (statusFilter === "LOW") {
        return shelf.visualState === "low";
      }
      if (statusFilter === "OUT") {
        return shelf.visualState === "out";
      }
      if (statusFilter === "EXPIRED") {
        return shelf.visualState === "expired";
      }
      return true;
    });
  }, [snapshot, deptFilter, statusFilter]);

  const filteredRacks = React.useMemo(() => {
    if (!snapshot) return [];
    return snapshot.warehouseRacks.filter((rack) => {
      if (zoneFilter !== "ALL" && rack.zoneCode !== zoneFilter) return false;
      return true;
    });
  }, [snapshot, zoneFilter]);

  const fallback2D = (
    <FloorPlan2DFallback
      shelves={filteredShelves}
      warehouseRacks={filteredRacks}
      viewMode={viewMode}
      selection={selection}
      onSelectDepartment={handleSelectDepartment}
      onSelectShelf={handleSelectShelf}
      onSelectWarehousePosition={handleSelectWarehousePosition}
      reason={
        webglSupported
          ? "Interactive 2D architectural floor plan synchronized with PostgreSQL."
          : "WebGL is not available on this device. Showing synchronized 2D interactive floor plan."
      }
    />
  );

  return (
    <div
      ref={containerRef}
      className={`flex flex-col overflow-hidden bg-[#f2fbfa] ${
        embedded
          ? "h-[640px] rounded-2xl border border-teal-200/80 shadow-sm"
          : "h-full w-full"
      }`}
    >
      <SelectionControls onClearSelection={() => setSelection(null)} />

      {/* Top Interactive Toolbar */}
      <SceneToolbar
        storeName={snapshot?.store?.name ?? "3D Digital Twin Supermarket"}
        sceneScope={sceneScope}
        onSceneScopeChange={handleSceneScopeChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        quality={quality}
        onQualityChange={setQuality}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searching={searching}
        locateResult={locateResult}
        onPickLocation={handlePickLocateResult}
        onClearLocate={() => setLocateResult(null)}
        onToggleLeftSidebar={() => setLeftOpen((v) => !v)}
        onToggleRightPanel={() => setRightOpen((v) => !v)}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        onRefresh={() => void loadSnapshot(true)}
        refreshing={refreshing}
      />

      {/* Phase 14 Filter Strip (active when in Heatmap or Inventory mode) */}
      {viewMode !== "realistic" && snapshot?.initialized && (
        <div className="flex flex-wrap items-center gap-2 border-b border-teal-200/60 bg-teal-50/70 px-3 py-1.5 text-xs">
          <span className="font-semibold text-teal-900">
            {viewMode === "heatmap" ? "Heatmap Filters:" : "Inventory Filters:"}
          </span>
          <Select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-7 w-44 text-xs"
            aria-label="Filter by department"
          >
            <option value="ALL">All Departments</option>
            {snapshot.departments.map((d) => (
              <option key={d.id} value={d.code}>
                {d.name} ({d.totalUnits})
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-7 w-40 text-xs"
            aria-label="Filter by stock status"
          >
            <option value="ALL">All Stock States</option>
            <option value="LOW">Low Stock Only</option>
            <option value="OUT">Out of Stock Only</option>
            <option value="EXPIRED">Expired Batches</option>
          </Select>
          <Select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="h-7 w-36 text-xs"
            aria-label="Filter by warehouse zone"
          >
            <option value="ALL">All WH Zones</option>
            <option value="Zone_A">Zone A (Ambient)</option>
            <option value="Zone_B">Zone B (Beverages)</option>
            <option value="Zone_C">Zone C (Chilled)</option>
            <option value="Zone_D">Zone D (Household)</option>
          </Select>
          {(deptFilter !== "ALL" ||
            statusFilter !== "ALL" ||
            zoneFilter !== "ALL") && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => {
                setDeptFilter("ALL");
                setStatusFilter("ALL");
                setZoneFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      )}

      {/* Main Split Workspace: Left Tree | Center 3D/2D Viewport | Right Inspector */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Collapsible Left Navigation Tree */}
        {leftOpen && snapshot?.initialized && (
          <aside className="z-10 hidden w-64 shrink-0 border-r border-teal-200/70 bg-white/95 backdrop-blur-md md:flex md:flex-col">
            <DepartmentNavigation
              departments={snapshot.departments}
              shelves={filteredShelves}
              warehouseRacks={filteredRacks}
              selection={selection}
              onSelectDepartment={handleSelectDepartment}
              onSelectShelf={handleSelectShelf}
              onSelectWarehouseRack={handleSelectWarehouseRack}
              onResetOverview={() => {
                setSelection(null);
                flyTo(
                  CAMERA_PRESETS.overview.position,
                  CAMERA_PRESETS.overview.target,
                );
              }}
            />
          </aside>
        )}

        {/* Center Viewport */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {loading && !snapshot ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-xl border border-teal-200 bg-white px-6 py-4 text-center shadow-sm">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                <p className="text-sm font-medium text-teal-950">
                  Loading live supermarket inventory…
                </p>
              </div>
            </div>
          ) : error && !snapshot ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-danger/25 bg-white p-6 text-center shadow-sm">
                <p className="font-display text-base font-bold text-foreground">
                  3D Digital Twin Unavailable
                </p>
                <p className="mt-2 text-xs text-muted">{error}</p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => void loadSnapshot(false)}
                >
                  Retry Connection
                </Button>
              </div>
            </div>
          ) : snapshot && !snapshot.initialized ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-lg rounded-2xl border border-teal-200 bg-white/95 p-6 text-center shadow-md">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                  First-Time Store Twin Setup
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-foreground">
                  Initialize 3D Supermarket Layout in PostgreSQL
                </h2>
                <p className="mt-2 text-sm text-muted">
                  This maps the 10 retail departments, 18 shelves, 8 warehouse
                  racks (Zones A–D), and all 31 GLB models to your real product
                  catalog using actual on-hand stock quantities (never mock or
                  random data).
                </p>
                {error && (
                  <p className="mt-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {error}
                  </p>
                )}
                {canInitialize ? (
                  <Button
                    className="mt-5"
                    isLoading={initializing}
                    onClick={() => void handleInitialize()}
                  >
                    Initialize 3D Store & Sync Inventory
                  </Button>
                ) : (
                  <p className="mt-4 text-xs font-medium text-amber-800">
                    Ask a Manager or Administrator to initialize the 3D Store
                    layout.
                  </p>
                )}
              </div>
            </div>
          ) : snapshot ? (
            <>
              {/* Top Floating Status & Heatmap Legend Overlay */}
              <div className="pointer-events-none absolute inset-x-3 top-3 z-10">
                <InventoryOverlay
                  summary={snapshot.summary}
                  viewMode={viewMode}
                  realtimeConnected={realtimeConnected}
                  lastEventMessage={lastEventMessage}
                />
              </div>

              {/* 3D Canvas or Interactive 2D Floorplan */}
              {is2DMode || !webglSupported ? (
                fallback2D
              ) : (
                <WebGLErrorBoundary fallback={fallback2D}>
                  <SupermarketScene
                    shelves={filteredShelves}
                    warehouseRacks={filteredRacks}
                    viewMode={viewMode}
                    sceneScope={sceneScope}
                    quality={quality}
                    showCeiling={showCeiling}
                    selection={selection}
                    cameraGoal={cameraGoal}
                    recentlyRestockedPositionIds={recentlyRestockedIds}
                    onSelectDepartment={handleSelectDepartment}
                    onSelectShelf={handleSelectShelf}
                    onSelectProduct={handleSelectProduct}
                    onSelectWarehousePosition={handleSelectWarehousePosition}
                    onClearSelection={() => setSelection(null)}
                    onControlsReady={(ctrl) => {
                      controlsRef.current = ctrl;
                    }}
                  />
                </WebGLErrorBoundary>
              )}

              {/* Bottom Floating Navigation & Camera Controls */}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
                <NavigationControls
                  onZoomIn={() => handleZoom(0.75)}
                  onZoomOut={() => handleZoom(1.32)}
                  onResetCamera={() => {
                    setSelection(null);
                    flyTo(
                      sceneScope === "warehouse"
                        ? CAMERA_PRESETS.warehouse.position
                        : CAMERA_PRESETS.overview.position,
                      sceneScope === "warehouse"
                        ? CAMERA_PRESETS.warehouse.target
                        : CAMERA_PRESETS.overview.target,
                    );
                  }}
                  onTopDown={() =>
                    flyTo(
                      CAMERA_PRESETS.topDown.position,
                      CAMERA_PRESETS.topDown.target,
                    )
                  }
                  onToggleCeiling={() => setShowCeiling((v) => !v)}
                  showCeiling={showCeiling}
                  is2DMode={is2DMode}
                  onToggle2DMode={() => setIs2DMode((v) => !v)}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Collapsible Right Context Inspector */}
        {rightOpen && snapshot?.initialized && (
          <aside className="z-10 w-80 shrink-0 overflow-y-auto border-l border-teal-200/70 bg-white/95 backdrop-blur-md">
            <ObjectInformationPanel
              snapshot={snapshot}
              selection={selection}
              canRestock={canRestock}
              onSelectShelf={handleSelectShelf}
              onSelectProduct={handleSelectProduct}
              onRestockShelfPosition={handleRestockShelfPosition}
              onTransferFromWarehouse={handleTransferFromWarehouse}
              onClose={() => setSelection(null)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
