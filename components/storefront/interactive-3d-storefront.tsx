"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  BUILDING_DIMENSIONS,
  CAMERA_PRESETS,
  findAreaByCode,
  findFixtureByCode,
  shelfSlotWorldPosition,
} from "@/lib/digital-twin/spatial-plan";
import type {
  CameraGoal,
  CameraMovementInput,
} from "@/components/digital-twin/controls/CameraControls";
import { FloorPlan2DFallback } from "@/components/digital-twin/interface/FloorPlan2DFallback";
import {
  WebGLErrorBoundary,
  isWebGLAvailable,
} from "@/components/digital-twin/interface/WebGLErrorBoundary";
import type { PublicCatalogProduct } from "@/types/api";
import type {
  DigitalTwinSnapshot,
  TwinSelection,
  TwinShelfNode,
  TwinShelfPositionNode,
} from "@/types/digital-twin";

const SupermarketScene = dynamic(
  () =>
    import("@/components/digital-twin/scene/SupermarketScene").then(
      (mod) => mod.SupermarketScene,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <div className="rounded-md border border-border bg-white px-5 py-3 text-center shadow-card">
          <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Loading 3D store…</p>
        </div>
      </div>
    ),
  },
);

const EMPTY_SET: ReadonlySet<string> = new Set();

const WALK_START_GOAL: Omit<CameraGoal, "nonce"> = {
  position: [-1.4, 1.72, 9.8],
  target: [-1.4, 1.35, 1.5],
};

const RETAIL_WALK_BOUNDS = {
  minX: BUILDING_DIMENSIONS.retail.bounds.minX + 1.2,
  maxX: BUILDING_DIMENSIONS.retail.bounds.maxX - 1.2,
  minZ: BUILDING_DIMENSIONS.retail.bounds.minZ + 1.2,
  maxZ: BUILDING_DIMENSIONS.retail.bounds.maxZ + 2.0,
};

export interface ShelfPickPayload {
  productId: string;
  name: string;
  price: number;
  maxQuantity: number;
  categoryName: string | null;
}

export interface Interactive3DStorefrontProps {
  snapshot: DigitalTwinSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  refreshing?: boolean;
  catalogById?: ReadonlyMap<string, PublicCatalogProduct>;
  basketQuantities: Readonly<Record<string, number>>;
  basketCount: number;
  onAddItem: (item: ShelfPickPayload) => void;
  onAdjustItem: (productId: string, delta: number, maxQuantity?: number) => void;
  onOpenBasket?: () => void;
  focusProductRequest?: { productId: string; nonce: number } | null;
  fullHeight?: boolean;
}

type ViewPreset = "walk" | "overview" | "2d";

export function Interactive3DStorefront({
  snapshot,
  loading,
  error,
  onRefresh,
  refreshing = false,
  catalogById,
  basketQuantities,
  basketCount,
  onAddItem,
  onAdjustItem,
  onOpenBasket,
  focusProductRequest,
  fullHeight = false,
}: Interactive3DStorefrontProps) {
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const movementRef = React.useRef<CameraMovementInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
  });

  const [viewPreset, setViewPreset] = React.useState<ViewPreset>("overview");
  const [webglOk, setWebglOk] = React.useState(true);
  const [selection, setSelection] = React.useState<TwinSelection>(null);
  const [activeDeptCode, setActiveDeptCode] = React.useState<string>("");
  const [cameraGoal, setCameraGoal] = React.useState<CameraGoal | null>({
    position: CAMERA_PRESETS.overview.position,
    target: CAMERA_PRESETS.overview.target,
    nonce: 1,
  });

  React.useEffect(() => {
    const ok = isWebGLAvailable();
    setWebglOk(ok);
    if (!ok) setViewPreset("2d");
  }, []);

  // Keyboard walking (WASD / Arrow keys / Q-E turn) when not typing in an input.
  React.useEffect(() => {
    const setKey = (key: string, pressed: boolean) => {
      const m = movementRef.current;
      switch (key) {
        case "w":
        case "arrowup":
          m.forward = pressed;
          return true;
        case "s":
        case "arrowdown":
          m.backward = pressed;
          return true;
        case "a":
        case "arrowleft":
          m.left = pressed;
          return true;
        case "d":
        case "arrowright":
          m.right = pressed;
          return true;
        case "q":
          m.turnLeft = pressed;
          return true;
        case "e":
          m.turnRight = pressed;
          return true;
        default:
          return false;
      }
    };

    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
      const handled = setKey(e.key.toLowerCase(), true);
      if (handled && e.key.startsWith("Arrow")) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      setKey(e.key.toLowerCase(), false);
    };

    const clearAll = () => {
      movementRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        turnLeft: false,
        turnRight: false,
      };
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearAll);
    };
  }, []);

  const flyTo = React.useCallback(
    (position: [number, number, number], target: [number, number, number]) => {
      setCameraGoal({ position, target, nonce: Date.now() + Math.random() });
    },
    [],
  );

  const handleSelectDepartment = React.useCallback(
    (code: string) => {
      setActiveDeptCode(code);
      if (!code) {
        setSelection(null);
        setViewPreset((prev) => (prev === "2d" ? "2d" : "overview"));
        flyTo(
          CAMERA_PRESETS.overview.position,
          CAMERA_PRESETS.overview.target,
        );
        return;
      }
      const area = findAreaByCode(code);
      setSelection({ type: "department", departmentCode: code });
      if (area) {
        flyTo(area.cameraPosition, area.cameraTarget);
      }
    },
    [flyTo],
  );

  const handleSelectShelf = React.useCallback(
    (shelf: TwinShelfNode) => {
      setActiveDeptCode(shelf.departmentCode);
      setSelection({ type: "shelf", shelfId: shelf.id, shelfCode: shelf.code });
      const fixture = findFixtureByCode(shelf.code);
      const offset = fixture?.cameraOffset ?? [3.6, 2.0, 3.4];
      flyTo(
        [
          shelf.position[0] + offset[0] * 0.85,
          Math.min(2.6, Math.max(1.5, shelf.position[1] + offset[1] * 0.82)),
          shelf.position[2] + offset[2] * 0.85,
        ],
        [shelf.position[0], shelf.position[1] + 1.05, shelf.position[2]],
      );
    },
    [flyTo],
  );

  const handleSelectProduct = React.useCallback(
    (pos: TwinShelfPositionNode) => {
      if (!pos.product) return;
      const shelf = snapshot?.shelves.find((s) => s.id === pos.shelfId);
      if (shelf) setActiveDeptCode(shelf.departmentCode);
      setSelection({
        type: "product",
        productId: pos.product.id,
        positionId: pos.id,
        shelfCode: pos.shelfCode,
        objectName: pos.objectName,
      });
      const fixture = findFixtureByCode(pos.shelfCode);
      const target = fixture
        ? shelfSlotWorldPosition(fixture, pos.slotIndex)
        : ([0, 1.2, 0] as [number, number, number]);
      const offset = fixture?.cameraOffset ?? [2.5, 1.2, 2.5];
      flyTo(
        [
          target[0] + offset[0] * 0.48,
          Math.max(1.25, target[1] + 0.52),
          target[2] + offset[2] * 0.48,
        ],
        target,
      );
    },
    [flyTo, snapshot],
  );

  // External focus request from catalog ("View on shelf" button).
  React.useEffect(() => {
    if (!focusProductRequest || !snapshot) return;
    const match = snapshot.shelves
      .flatMap((s) => s.positions)
      .find((p) => p.product?.id === focusProductRequest.productId);
    if (match) {
      setViewPreset((prev) => (prev === "2d" && webglOk ? "walk" : prev));
      handleSelectProduct(match);
    }
  }, [focusProductRequest, snapshot, handleSelectProduct, webglOk]);

  const handleZoom = (factor: number) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const cam = ctrl.object;
    const dir = cam.position.clone().sub(ctrl.target);
    const nextLen = Math.min(44, Math.max(1.6, dir.length() * factor));
    dir.setLength(nextLen);
    const nextPos = ctrl.target.clone().add(dir);
    flyTo([nextPos.x, Math.max(1.1, nextPos.y), nextPos.z], [
      ctrl.target.x,
      ctrl.target.y,
      ctrl.target.z,
    ]);
  };

  const handleSwitchPreset = (preset: ViewPreset) => {
    setViewPreset(preset);
    if (preset === "walk") {
      setSelection(null);
      setActiveDeptCode("");
      flyTo(WALK_START_GOAL.position, WALK_START_GOAL.target);
    } else if (preset === "overview") {
      setSelection(null);
      setActiveDeptCode("");
      flyTo(CAMERA_PRESETS.overview.position, CAMERA_PRESETS.overview.target);
    }
  };

  const setMoveFlag = (key: keyof CameraMovementInput, active: boolean) => {
    movementRef.current[key] = active;
  };

  const movePadButtonProps = (key: keyof CameraMovementInput) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      setMoveFlag(key, true);
    },
    onPointerUp: () => setMoveFlag(key, false),
    onPointerLeave: () => setMoveFlag(key, false),
    onPointerCancel: () => setMoveFlag(key, false),
  });

  // Resolve currently selected product / shelf / department items for the right panel.
  const selectedPos = React.useMemo(() => {
    if (selection?.type !== "product" || !snapshot) return null;
    return (
      snapshot.shelves
        .flatMap((s) => s.positions)
        .find((p) => p.id === selection.positionId) ?? null
    );
  }, [selection, snapshot]);

  const selectedShelf = React.useMemo(() => {
    if (!snapshot) return null;
    if (selection?.type === "shelf") {
      return snapshot.shelves.find((s) => s.id === selection.shelfId) ?? null;
    }
    if (selectedPos) {
      return (
        snapshot.shelves.find((s) => s.id === selectedPos.shelfId) ?? null
      );
    }
    return null;
  }, [selection, selectedPos, snapshot]);

  const stockedShelves = React.useMemo(() => {
    const all = snapshot?.shelves ?? [];
    const filtered = activeDeptCode
      ? all.filter(
          (s) => s.departmentCode.toUpperCase() === activeDeptCode.toUpperCase(),
        )
      : all;
    return filtered.filter((s) => s.positions.some((p) => p.product !== null));
  }, [snapshot, activeDeptCode]);

  const allPlacedPositions = React.useMemo(() => {
    return stockedShelves.flatMap((s) =>
      s.positions
        .filter((p) => p.product !== null)
        .map((pos) => ({ shelf: s, pos })),
    );
  }, [stockedShelves]);

  const is2D = viewPreset === "2d" || !webglOk;

  const fallback2D = (
    <FloorPlan2DFallback
      shelves={snapshot?.shelves ?? []}
      warehouseRacks={[]}
      viewMode="realistic"
      selection={selection}
      onSelectDepartment={handleSelectDepartment}
      onSelectShelf={handleSelectShelf}
      onSelectWarehousePosition={() => undefined}
      reason="Interactive 2D store map — click any department or shelf to pick live products."
    />
  );

  const selectedProductCatalog = selectedPos?.product
    ? catalogById?.get(selectedPos.product.id)
    : undefined;

  const renderBasketControl = (pos: TwinShelfPositionNode) => {
    if (!pos.product) return null;
    const inBasket = basketQuantities[pos.product.id] ?? 0;
    const available = Math.max(0, pos.quantity);

    if (inBasket > 0) {
      return (
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-white p-0.5">
          <button
            type="button"
            onClick={() => onAdjustItem(pos.product!.id, -1, available)}
            className="flex h-6 w-6 items-center justify-center rounded text-xs font-semibold text-foreground hover:bg-surface-subtle cursor-pointer"
            aria-label={`Remove one ${pos.product.name}`}
          >
            −
          </button>
          <span className="min-w-5 text-center font-mono text-xs font-semibold text-foreground">
            {inBasket}
          </span>
          <button
            type="button"
            disabled={inBasket >= available}
            onClick={() =>
              onAddItem({
                productId: pos.product!.id,
                name: pos.product!.name,
                price: pos.product!.price,
                maxQuantity: available,
                categoryName: pos.product!.categoryName,
              })
            }
            className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-40 cursor-pointer"
            aria-label={`Add one more ${pos.product.name}`}
          >
            +
          </button>
        </div>
      );
    }

    return (
      <Button
        size="sm"
        disabled={available <= 0}
        onClick={() =>
          onAddItem({
            productId: pos.product!.id,
            name: pos.product!.name,
            price: pos.product!.price,
            maxQuantity: available,
            categoryName: pos.product!.categoryName,
          })
        }
      >
        {available > 0 ? "Add" : "Out"}
      </Button>
    );
  };

  return (
    <section
      aria-label="Interactive 3D Supermarket"
      className={
        fullHeight
          ? "flex min-h-0 flex-1 flex-col bg-canvas"
          : "overflow-hidden rounded-lg border border-border bg-white shadow-card"
      }
    >
      {/* Top Toolbar: Camera Mode + Department Aisles + Zoom/Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="3D view mode"
            className="inline-flex rounded-md border border-border bg-surface-muted p-0.5"
          >
            <button
              type="button"
              disabled={!webglOk}
              onClick={() => handleSwitchPreset("walk")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                viewPreset === "walk"
                  ? "bg-white font-semibold text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Walk aisles
            </button>
            <button
              type="button"
              disabled={!webglOk}
              onClick={() => handleSwitchPreset("overview")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                viewPreset === "overview"
                  ? "bg-white font-semibold text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Store view
            </button>
            <button
              type="button"
              onClick={() => handleSwitchPreset("2d")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                is2D
                  ? "bg-white font-semibold text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              2D map
            </button>
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            {!is2D && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleZoom(0.75)}
                  title="Zoom in"
                >
                  +
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleZoom(1.32)}
                  title="Zoom out"
                >
                  −
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            isLoading={refreshing}
            onClick={onRefresh}
          >
            Refresh stock
          </Button>
          {!fullHeight && (
            <Link href="/store-3d">
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                Full screen
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Department / Aisle Quick-Jump Strip */}
      {(snapshot?.departments?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-surface-subtle px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => handleSelectDepartment("")}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              activeDeptCode === ""
                ? "bg-primary text-white"
                : "border border-border bg-white text-muted hover:border-border-hover hover:text-foreground"
            }`}
          >
            All aisles
          </button>
          {(snapshot?.departments ?? []).map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => handleSelectDepartment(dept.code)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                activeDeptCode.toUpperCase() === dept.code.toUpperCase()
                  ? "bg-primary text-white"
                  : "border border-border bg-white text-muted hover:border-border-hover hover:text-foreground"
              }`}
            >
              {dept.name}
              {dept.productCount > 0 && (
                <span className="ml-1 opacity-75 tabular-nums">
                  ({dept.productCount})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Split Body: Movable 3D Viewport + Live Shelf Product Picker */}
      <div
        className={
          fullHeight
            ? "flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
            : "flex flex-col lg:h-[580px] lg:flex-row"
        }
      >
        {/* Movable 3D Canvas */}
        <div
          className={
            fullHeight
              ? "relative min-h-[380px] flex-1 bg-canvas"
              : "relative h-[420px] sm:h-[500px] lg:h-full lg:flex-1 bg-canvas"
          }
        >
          {loading && !snapshot ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-md border border-border bg-white px-5 py-3 text-center shadow-card">
                <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs font-medium text-muted">
                  Loading live 3D shelves…
                </p>
              </div>
            </div>
          ) : error && !snapshot ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-sm rounded-lg border border-danger/25 bg-white p-5 text-center shadow-card">
                <p className="text-sm font-semibold text-foreground">
                  Unable to load 3D store
                </p>
                <p className="mt-1 text-xs text-muted">{error}</p>
                <Button size="sm" className="mt-3" onClick={onRefresh}>
                  Try again
                </Button>
              </div>
            </div>
          ) : is2D ? (
            fallback2D
          ) : (
            <WebGLErrorBoundary fallback={fallback2D}>
              <SupermarketScene
                shelves={snapshot?.shelves ?? []}
                warehouseRacks={[]}
                viewMode="realistic"
                sceneScope="supermarket"
                quality="balanced"
                showCeiling={false}
                selection={selection}
                cameraGoal={cameraGoal}
                recentlyRestockedPositionIds={EMPTY_SET}
                onSelectDepartment={handleSelectDepartment}
                onSelectShelf={handleSelectShelf}
                onSelectProduct={handleSelectProduct}
                onSelectWarehousePosition={() => undefined}
                onClearSelection={() => setSelection(null)}
                onControlsReady={(ctrl) => {
                  controlsRef.current = ctrl;
                }}
                movementRef={movementRef}
                movementBounds={RETAIL_WALK_BOUNDS}
                shopperMode
                basketQuantities={basketQuantities}
              />
            </WebGLErrorBoundary>
          )}

          {/* Top-Left Minimal Live Store Indicator */}
          {snapshot && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
              <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-white/95 px-2.5 py-1 text-[11px] text-muted shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span>
                  <strong className="font-semibold text-foreground tabular-nums">
                    {snapshot.summary.totalShelfUnits}
                  </strong>{" "}
                  units live on shelves
                </span>
                {selectedShelf && (
                  <>
                    <span className="text-border">·</span>
                    <span className="font-medium text-foreground">
                      {selectedShelf.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bottom-Left Tactile Move Pad (Works with Mouse, Touch & WASD/Arrows) */}
          {!is2D && snapshot && (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2">
              <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-white/95 p-1.5 shadow-sm">
                <div
                  className="grid grid-cols-3 gap-1"
                  aria-label="Move inside 3D store"
                >
                  <button
                    type="button"
                    {...movePadButtonProps("turnLeft")}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-subtle text-xs font-medium text-foreground hover:bg-surface-muted active:bg-primary active:text-white cursor-pointer select-none"
                    title="Turn left (Q)"
                    aria-label="Turn left"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    {...movePadButtonProps("forward")}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border bg-white text-xs font-semibold text-foreground hover:bg-surface-subtle active:bg-primary active:text-white cursor-pointer select-none"
                    title="Move forward (W / Up arrow)"
                    aria-label="Move forward"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    {...movePadButtonProps("turnRight")}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-subtle text-xs font-medium text-foreground hover:bg-surface-muted active:bg-primary active:text-white cursor-pointer select-none"
                    title="Turn right (E)"
                    aria-label="Turn right"
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    {...movePadButtonProps("left")}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border bg-white text-xs font-semibold text-foreground hover:bg-surface-subtle active:bg-primary active:text-white cursor-pointer select-none"
                    title="Move left (A / Left arrow)"
                    aria-label="Move left"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    {...movePadButtonProps("backward")}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border bg-white text-xs font-semibold text-foreground hover:bg-surface-subtle active:bg-primary active:text-white cursor-pointer select-none"
                    title="Move back (S / Down arrow)"
                    aria-label="Move back"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    {...movePadButtonProps("right")}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border bg-white text-xs font-semibold text-foreground hover:bg-surface-subtle active:bg-primary active:text-white cursor-pointer select-none"
                    title="Move right (D / Right arrow)"
                    aria-label="Move right"
                  >
                    →
                  </button>
                </div>
                <p className="hidden max-w-[165px] pr-1 text-[11px] leading-snug text-muted sm:block">
                  Drag to look · <strong className="font-medium text-foreground">WASD</strong> or
                  pad to move · Click any product on a shelf
                </p>
              </div>

              <div className="pointer-events-auto flex items-center gap-1.5">
                {viewPreset !== "walk" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 bg-white/95 text-xs"
                    onClick={() => handleSwitchPreset("walk")}
                  >
                    Step inside
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Live Shelf Picker */}
        <aside className="flex w-full shrink-0 flex-col border-t border-border bg-white lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {selectedPos?.product
                  ? "Product on shelf"
                  : selectedShelf
                    ? selectedShelf.name
                    : activeDeptCode
                      ? (findAreaByCode(activeDeptCode)?.name ?? "Aisle")
                      : "Pick live from shelves"}
              </h2>
              <p className="truncate text-[11px] text-muted">
                {selectedPos?.product && selectedShelf
                  ? `${selectedShelf.departmentName} · ${selectedPos.positionCode}`
                  : selectedShelf
                    ? `${selectedShelf.departmentName} · ${selectedShelf.productCount} products`
                    : `${allPlacedPositions.length} live products on display`}
              </p>
            </div>
            {selection ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setSelection(null)}
              >
                All shelves
              </Button>
            ) : onOpenBasket && basketCount > 0 ? (
              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onOpenBasket}>
                Basket ({basketCount})
              </Button>
            ) : null}
          </div>

          <div className="max-h-[340px] flex-1 overflow-y-auto p-4 lg:max-h-none">
            {/* 1. Selected Product Detail + Siblings on Same Shelf */}
            {selectedPos?.product ? (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle p-1.5">
                    {selectedProductCatalog?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedProductCatalog.imageUrl}
                        alt={selectedPos.product.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-muted">
                        {selectedPos.product.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {selectedPos.product.categoryName && (
                      <p className="text-[11px] text-muted">
                        {selectedPos.product.categoryName}
                      </p>
                    )}
                    <h3 className="text-sm font-semibold leading-snug text-foreground">
                      {selectedPos.product.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {formatMoney(selectedPos.product.price)}
                      </span>
                      <Badge
                        variant={
                          selectedPos.quantity <= 0
                            ? "danger"
                            : selectedPos.quantity <= 10
                              ? "warning"
                              : "success"
                        }
                      >
                        {selectedPos.quantity > 0
                          ? `${selectedPos.quantity} on shelf`
                          : "Out of stock"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {selectedProductCatalog?.description && (
                  <p className="text-xs leading-relaxed text-muted">
                    {selectedProductCatalog.description}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-subtle p-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Choose from this shelf
                    </p>
                    <p className="text-[11px] text-muted">
                      Slot {selectedPos.positionCode} · {selectedPos.shelfCode}
                    </p>
                  </div>
                  {renderBasketControl(selectedPos)}
                </div>

                {selectedShelf && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted">
                        Also on {selectedShelf.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSelectShelf(selectedShelf)}
                        className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        Full shelf
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {selectedShelf.positions
                        .filter(
                          (p) =>
                            p.product !== null && p.id !== selectedPos.id,
                        )
                        .map((pos) => (
                          <div
                            key={pos.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-border bg-white p-2 transition-colors hover:border-border-hover"
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectProduct(pos)}
                              className="min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <p className="truncate text-xs font-medium text-foreground hover:text-primary">
                                {pos.product!.name}
                              </p>
                              <p className="text-[11px] text-muted tabular-nums">
                                {formatMoney(pos.product!.price)} ·{" "}
                                {pos.quantity > 0
                                  ? `${pos.quantity} left`
                                  : "Out of stock"}
                              </p>
                            </button>
                            {renderBasketControl(pos)}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : selectedShelf ? (
              /* 2. Selected Shelf Contents */
              <div className="space-y-2.5">
                {selectedShelf.positions.filter((p) => p.product !== null)
                  .length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted">
                    No products are currently placed on this shelf.
                  </p>
                ) : (
                  selectedShelf.positions
                    .filter((p) => p.product !== null)
                    .map((pos) => (
                      <div
                        key={pos.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-white p-2.5 transition-colors hover:border-border-hover"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectProduct(pos)}
                          className="min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <p className="truncate text-xs font-semibold text-foreground hover:text-primary">
                            {pos.product!.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted tabular-nums">
                            <span className="font-medium text-foreground">
                              {formatMoney(pos.product!.price)}
                            </span>{" "}
                            ·{" "}
                            {pos.quantity > 0
                              ? `${pos.quantity} on shelf`
                              : "Out of stock"}
                          </p>
                        </button>
                        {renderBasketControl(pos)}
                      </div>
                    ))
                )}
              </div>
            ) : (
              /* 3. Default / Department Live Shelves Browser */
              <div className="space-y-3">
                {allPlacedPositions.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs font-medium text-foreground">
                      No shelf items in this aisle yet
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      Select another aisle above or browse the full catalog
                      below.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted">
                      Click any product below or tap directly on a 3D shelf to
                      inspect and add it to your basket.
                    </p>
                    <div className="space-y-2">
                      {allPlacedPositions.slice(0, 24).map(({ shelf, pos }) => (
                        <div
                          key={pos.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border bg-white p-2.5 transition-colors hover:border-border-hover"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(pos)}
                            className="min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <p className="truncate text-xs font-semibold text-foreground hover:text-primary">
                              {pos.product!.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted tabular-nums">
                              <span className="font-medium text-foreground">
                                {formatMoney(pos.product!.price)}
                              </span>{" "}
                              · {shelf.departmentName} ·{" "}
                              {pos.quantity > 0
                                ? `${pos.quantity} left`
                                : "Out"}
                            </p>
                          </button>
                          {renderBasketControl(pos)}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {onOpenBasket && basketCount > 0 && (
            <div className="border-t border-border bg-surface-subtle px-4 py-3">
              <Button size="sm" className="w-full" onClick={onOpenBasket}>
                View basket ({basketCount}{" "}
                {basketCount === 1 ? "item" : "items"})
              </Button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
