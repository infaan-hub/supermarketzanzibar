"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StorefrontHeader } from "@/components/storefront/guest-storefront";
import { fetchPublicDigitalTwin } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  CAMERA_PRESETS,
  findAreaByCode,
  findFixtureByCode,
  shelfSlotWorldPosition,
} from "@/lib/digital-twin/spatial-plan";
import type { CameraGoal } from "@/components/digital-twin/controls/CameraControls";
import { FloorPlan2DFallback } from "@/components/digital-twin/interface/FloorPlan2DFallback";
import {
  WebGLErrorBoundary,
  isWebGLAvailable,
} from "@/components/digital-twin/interface/WebGLErrorBoundary";
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
      <div className="flex h-full items-center justify-center bg-[#f0faf9]">
        <p className="text-sm font-medium text-teal-900">
          Loading interactive 3D Supermarket Tour…
        </p>
      </div>
    ),
  },
);

const EMPTY_SET: ReadonlySet<string> = new Set();

export default function PublicStore3DPage() {
  const [snapshot, setSnapshot] = React.useState<DigitalTwinSnapshot | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [is2D, setIs2D] = React.useState(false);
  const [webglOk, setWebglOk] = React.useState(true);
  const [selection, setSelection] = React.useState<TwinSelection>(null);
  const [cameraGoal, setCameraGoal] = React.useState<CameraGoal | null>({
    position: CAMERA_PRESETS.overview.position,
    target: CAMERA_PRESETS.overview.target,
    nonce: 1,
  });

  React.useEffect(() => {
    const ok = isWebGLAvailable();
    setWebglOk(ok);
    if (!ok) setIs2D(true);
  }, []);

  React.useEffect(() => {
    fetchPublicDigitalTwin()
      .then(setSnapshot)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Unable to load 3D Store Tour.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const flyTo = (
    position: [number, number, number],
    target: [number, number, number],
  ) => {
    setCameraGoal({ position, target, nonce: Date.now() + Math.random() });
  };

  const handleSelectDepartment = (code: string) => {
    const area = findAreaByCode(code);
    setSelection({ type: "department", departmentCode: code });
    if (area) flyTo(area.cameraPosition, area.cameraTarget);
  };

  const handleSelectShelf = (shelf: TwinShelfNode) => {
    setSelection({ type: "shelf", shelfId: shelf.id, shelfCode: shelf.code });
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
  };

  const handleSelectProduct = (pos: TwinShelfPositionNode) => {
    if (!pos.product) return;
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
    const offset = fixture?.cameraOffset ?? [2.8, 1.4, 2.8];
    flyTo(
      [
        target[0] + offset[0] * 0.58,
        target[1] + 0.9,
        target[2] + offset[2] * 0.58,
      ],
      target,
    );
  };

  const selectedShelf =
    selection?.type === "shelf"
      ? snapshot?.shelves.find((s) => s.id === selection.shelfId) ?? null
      : null;

  const selectedPos =
    selection?.type === "product"
      ? snapshot?.shelves
          .flatMap((s) => s.positions)
          .find((p) => p.id === selection.positionId) ?? null
      : null;

  const fallback2D = (
    <FloorPlan2DFallback
      shelves={snapshot?.shelves ?? []}
      warehouseRacks={[]}
      viewMode="realistic"
      selection={selection}
      onSelectDepartment={handleSelectDepartment}
      onSelectShelf={handleSelectShelf}
      onSelectWarehousePosition={() => undefined}
      reason="Public read-only 2D supermarket floor plan."
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-[#f2fbfa]">
      <StorefrontHeader activePage="3d" />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/70 bg-white/95 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-teal-900">
            Public 3D Store Tour (Read-Only):
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() => {
              setSelection(null);
              flyTo(
                CAMERA_PRESETS.overview.position,
                CAMERA_PRESETS.overview.target,
              );
            }}
          >
            Overview
          </Button>
          {(snapshot?.departments ?? []).slice(0, 6).map((d) => (
            <Button
              key={d.id}
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => handleSelectDepartment(d.code)}
            >
              {d.name}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() => setIs2D((v) => !v)}
          >
            {is2D ? "3D View" : "2D Floorplan"}
          </Button>
          <Link href="/">
            <Button size="sm" className="h-7 text-xs">
              Shop Catalog
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-teal-900">Loading 3D store…</p>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6">
              <p className="rounded-xl border border-danger/25 bg-white px-5 py-4 text-sm text-danger">
                {error}
              </p>
            </div>
          ) : !snapshot?.initialized ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-teal-200 bg-white p-6 text-center shadow-sm">
                <p className="font-display text-base font-bold">
                  3D Store Tour Coming Soon
                </p>
                <p className="mt-1 text-xs text-muted">
                  The store manager has not initialized the 3D floor layout yet.
                  You can browse all live products in the storefront catalog.
                </p>
                <Link href="/" className="mt-4 inline-block">
                  <Button size="sm">Browse Products</Button>
                </Link>
              </div>
            </div>
          ) : is2D || !webglOk ? (
            fallback2D
          ) : (
            <WebGLErrorBoundary fallback={fallback2D}>
              <SupermarketScene
                shelves={snapshot.shelves}
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
              />
            </WebGLErrorBoundary>
          )}
        </div>

        {(selectedPos || selectedShelf) && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-teal-200/70 bg-white/95 p-4 text-sm">
            {selectedPos?.product ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] font-bold text-teal-700">
                      {selectedPos.shelfCode} · {selectedPos.positionCode}
                    </p>
                    <h2 className="font-display text-lg font-bold">
                      {selectedPos.product.name}
                    </h2>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelection(null)}
                  >
                    ✕
                  </Button>
                </div>
                <p className="font-display text-2xl font-bold text-teal-900">
                  {formatMoney(selectedPos.product.price)}
                </p>
                <Badge variant={selectedPos.quantity > 0 ? "success" : "danger"}>
                  {selectedPos.quantity > 0 ? "Available in Aisle" : "Out of Stock"}
                </Badge>
                <Link href="/" className="block pt-2">
                  <Button size="sm" className="w-full">
                    Find in Online Catalog
                  </Button>
                </Link>
              </div>
            ) : selectedShelf ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] font-bold text-teal-700">
                      {selectedShelf.code}
                    </p>
                    <h2 className="font-display text-lg font-bold">
                      {selectedShelf.name}
                    </h2>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelection(null)}
                  >
                    ✕
                  </Button>
                </div>
                <p className="text-xs text-muted">
                  Department: {selectedShelf.departmentName}
                </p>
                <div className="space-y-2">
                  {selectedShelf.positions
                    .filter((p) => p.product !== null)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-subtle p-2 text-left text-xs hover:border-teal-500"
                      >
                        <span className="truncate font-medium">
                          {p.product!.name}
                        </span>
                        <span className="ml-2 font-mono font-semibold text-teal-900">
                          {formatMoney(p.product!.price)}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}
