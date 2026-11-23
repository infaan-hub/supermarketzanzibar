"use client";

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
} from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  categoryAccentPalette,
  getProductBackLabelTexture,
  getProductLabelTexture,
} from "@/lib/digital-twin/procedural-textures";
import { computeColumnRowPlan } from "@/lib/digital-twin/product-layout";
import { formatMoney } from "@/lib/format";
import type { TwinShelfPositionNode } from "@/types/digital-twin";
import { DetailedProductMesh } from "./ProductModel";

type CloseUpAngle = "front" | "back" | "angle";

function CloseUpStudioRig({
  product,
  autoSpin,
  angleCommand,
}: {
  product: NonNullable<TwinShelfPositionNode["product"]>;
  autoSpin: boolean;
  angleCommand: { angle: CloseUpAngle; nonce: number };
}) {
  const turntableRef = React.useRef<THREE.Group>(null);
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);

  const frontLabelTexture = React.useMemo(
    () =>
      getProductLabelTexture({
        productId: product.id,
        name: product.name,
        categoryName: product.categoryName,
        priceText: formatMoney(product.price),
        barcode: product.barcode,
        imageUrl: product.imageUrl,
        description: product.description,
      }),
    [product],
  );

  const backLabelTexture = React.useMemo(
    () =>
      getProductBackLabelTexture({
        productId: product.id,
        name: product.name,
        categoryName: product.categoryName,
        priceText: formatMoney(product.price),
        barcode: product.barcode,
        sku: product.sku,
        imageUrl: product.imageUrl,
        description: product.description,
      }),
    [product],
  );

  const accent = React.useMemo(
    () => categoryAccentPalette(product.categoryName, product.name),
    [product.categoryName, product.name],
  );

  // Snap smoothly to Front, Back, or 3/4 Angle when user clicks a preset button.
  React.useEffect(() => {
    const group = turntableRef.current;
    if (!group) return;
    gsap.killTweensOf(group.rotation);
    const targetY =
      angleCommand.angle === "back"
        ? Math.PI
        : angleCommand.angle === "angle"
          ? -0.45
          : 0;
    gsap.to(group.rotation, {
      y: targetY,
      duration: 0.6,
      ease: "power2.out",
    });
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, [angleCommand]);

  useFrame((_, delta) => {
    if (autoSpin && turntableRef.current) {
      turntableRef.current.rotation.y += Math.min(delta, 0.05) * 0.55;
    }
  });

  return (
    <>
      <color attach="background" args={["#f3f7f6"]} />

      {/* Three-point commercial studio lighting */}
      <hemisphereLight args={["#ffffff", "#d8e3e1", 0.95]} />
      <directionalLight
        position={[2.4, 3.6, 3.2]}
        intensity={1.5}
        color="#fffdf9"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[-2.6, 2.0, -2.2]}
        intensity={0.75}
        color="#e0f2fe"
      />
      <pointLight
        position={[0, 1.4, 1.8]}
        intensity={1.6}
        distance={5}
        decay={2}
        color="#ffffff"
      />

      {/* Offline procedural softbox environment for glossy retail laminate reflections */}
      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={2.8}
          position={[0, 5, 2]}
          rotation={[Math.PI / 2.4, 0, 0]}
          scale={[6, 4, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={1.8}
          position={[-4, 1.5, 2]}
          rotation={[0, Math.PI / 2.5, 0]}
          scale={[4, 3, 1]}
          color="#e0f2fe"
        />
        <Lightformer
          form="rect"
          intensity={1.7}
          position={[4, 1.5, -1.5]}
          rotation={[0, -Math.PI / 2.2, 0]}
          scale={[4, 3, 1]}
          color="#fff4e0"
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          position={[0, -3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
          color="#eef5f4"
        />
      </Environment>

      {/* Studio Pedestal Disc */}
      <mesh position={[0, -0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.03, 48]} />
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.22}
          metalness={0.05}
          clearcoat={0.35}
        />
      </mesh>
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.35}
        scale={1.4}
        blur={2.1}
        far={1.2}
        resolution={512}
        color="#0f2329"
      />

      {/* Hero Ultra-HD Product scaled generously for close-up inspection */}
      <group ref={turntableRef} position={[0, 0.002, 0]}>
        <React.Suspense
          fallback={
            <mesh position={[0, 0.24, 0]}>
              <boxGeometry args={[0.26, 0.44, 0.2]} />
              <meshStandardMaterial color={accent.primary} />
            </mesh>
          }
        >
          <DetailedProductMesh
            assetPath={product.assetPath}
            assetKey={product.assetKey}
            frontLabelTexture={frontLabelTexture}
            backLabelTexture={backLabelTexture}
            accentColor={accent.primary}
            scaleMultiplier={1.95}
          />
        </React.Suspense>
      </group>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0.22, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.38}
        maxDistance={1.5}
        minPolarAngle={0.22}
        maxPolarAngle={Math.PI * 0.56}
      />
    </>
  );
}

export function ProductCloseUpModal({
  position,
  departmentName,
  shelfName,
  imageUrl,
  description,
  effectiveQuantity,
  footerActions,
  onClose,
}: {
  position: TwinShelfPositionNode;
  departmentName?: string;
  shelfName?: string;
  imageUrl?: string | null;
  description?: string;
  effectiveQuantity?: number;
  footerActions?: React.ReactNode;
  onClose: () => void;
}) {
  const product = position.product;
  const resolvedImage = imageUrl ?? product?.imageUrl ?? null;
  const resolvedDesc = description ?? product?.description ?? "";
  const [stageTab, setStageTab] = React.useState<"3d" | "photo">("3d");
  const [autoSpin, setAutoSpin] = React.useState(true);
  const [angleCommand, setAngleCommand] = React.useState<{
    angle: CloseUpAngle;
    nonce: number;
  }>({ angle: "angle", nonce: 0 });
  const [photoFailed, setPhotoFailed] = React.useState(false);

  React.useEffect(() => {
    setPhotoFailed(false);
    setStageTab("3d");
    setAutoSpin(true);
    setAngleCommand({ angle: "angle", nonce: Date.now() });
  }, [position.id]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!product) return null;

  const qty = effectiveQuantity ?? position.quantity;
  const rowPlan = computeColumnRowPlan(qty, position.maximumCapacity, 4);
  const filledRows = rowPlan.filter((r) => r.quantity > 0).length;

  const jumpToAngle = (angle: CloseUpAngle) => {
    setAutoSpin(false);
    setAngleCommand({ angle, nonce: Date.now() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Close-up inspection of ${product.name}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Ultra-HD 360° 3D Studio + Expanded HD Photo Stage */}
        <div className="relative flex min-h-[340px] flex-col bg-[#f3f7f6] sm:min-h-[420px] lg:w-[58%] lg:min-h-[540px]">
          {/* Stage Top Controls */}
          <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-white/90 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={stageTab === "3d" ? "default" : "secondary"}
                className="h-7 text-xs"
                onClick={() => setStageTab("3d")}
              >
                3D 360° Package (HD)
              </Button>
              {resolvedImage && !photoFailed && (
                <Button
                  size="sm"
                  variant={stageTab === "photo" ? "default" : "secondary"}
                  className="h-7 text-xs"
                  onClick={() => setStageTab("photo")}
                >
                  Expanded Photo
                </Button>
              )}
            </div>

            {stageTab === "3d" && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => jumpToAngle("front")}
                >
                  Front
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => jumpToAngle("back")}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  variant={autoSpin ? "default" : "secondary"}
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setAutoSpin((v) => !v)}
                >
                  {autoSpin ? "Spin: On" : "Spin: Off"}
                </Button>
              </div>
            )}
          </div>

          {/* Interactive Stage Viewport */}
          <div className="relative flex-1">
            {stageTab === "photo" && resolvedImage && !photoFailed ? (
              <div className="flex h-full min-h-[300px] w-full items-center justify-center bg-gradient-to-b from-white to-slate-100 p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedImage}
                  alt={product.name}
                  onError={() => setPhotoFailed(true)}
                  className="max-h-[440px] max-w-full rounded-lg object-contain shadow-md"
                />
              </div>
            ) : (
              <div className="h-[320px] w-full sm:h-[400px] lg:h-full">
                <Canvas
                  shadows
                  dpr={[1.5, 2.5]}
                  camera={{
                    position: [0.16, 0.3, 0.82],
                    fov: 35,
                    near: 0.04,
                    far: 20,
                  }}
                  gl={{
                    antialias: true,
                    powerPreference: "high-performance",
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.08,
                    outputColorSpace: THREE.SRGBColorSpace,
                  }}
                >
                  <CloseUpStudioRig
                    product={product}
                    autoSpin={autoSpin}
                    angleCommand={angleCommand}
                  />
                </Canvas>
              </div>
            )}

            <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-center justify-between text-[11px]">
              <span className="rounded-md bg-white/90 px-2.5 py-1 font-medium text-muted shadow-sm backdrop-blur-sm">
                {stageTab === "3d"
                  ? "Drag to spin 360° · Scroll/pinch to zoom · Front & Back HD labels"
                  : "High-resolution uploaded product photograph"}
              </span>
              <span className="rounded-md bg-teal-700/90 px-2 py-1 font-semibold text-white shadow-sm">
                ULTRA HD
              </span>
            </div>
          </div>
        </div>

        {/* Right: Expanded Photo Preview + Clear Product Information */}
        <div className="flex flex-1 flex-col overflow-y-auto border-t border-border bg-white lg:w-[42%] lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Product Close-Up &amp; Details
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              onClick={onClose}
            >
              Close ✕
            </Button>
          </div>

          <div className="flex-1 space-y-4 p-5">
            {/* Header & Badges */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {product.categoryName && (
                  <Badge variant="secondary">{product.categoryName}</Badge>
                )}
                <Badge
                  variant={
                    qty <= 0
                      ? "danger"
                      : qty <= position.reorderLevel
                        ? "warning"
                        : "success"
                  }
                >
                  {qty > 0 ? `${qty} available on shelf` : "Out of stock"}
                </Badge>
              </div>
              <h2 className="text-xl font-bold leading-snug text-foreground">
                {product.name}
              </h2>
              <p className="font-display text-2xl font-bold tabular-nums text-primary">
                {formatMoney(product.price)}
              </p>
            </div>

            {/* Product Description */}
            <div className="rounded-lg border border-border bg-surface-subtle/70 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Product Information
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                {resolvedDesc.trim()
                  ? resolvedDesc
                  : `Quality ${product.categoryName ?? "supermarket"} item stocked fresh at Supermarket Zanzibar. Inspect both the front and back of the 3D package on the left.`}
              </p>
            </div>

            {/* Structured Specs & Shelf Placement */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border bg-white p-2.5">
                <p className="text-[10px] font-medium uppercase text-muted">
                  Shelf Location
                </p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {departmentName ? `${departmentName} · ` : ""}
                  {position.shelfCode}
                </p>
                {shelfName && (
                  <p className="truncate text-[11px] text-muted">{shelfName}</p>
                )}
              </div>
              <div className="rounded-md border border-border bg-white p-2.5">
                <p className="text-[10px] font-medium uppercase text-muted">
                  Column &amp; Rows
                </p>
                <p className="mt-0.5 font-semibold text-primary">
                  Col {position.slotIndex + 1} ({position.positionCode})
                </p>
                <p className="text-[11px] text-muted">
                  {filledRows}/4 rows stocked ({qty}/{position.maximumCapacity})
                </p>
              </div>
              <div className="rounded-md border border-border bg-white p-2.5">
                <p className="text-[10px] font-medium uppercase text-muted">
                  SKU
                </p>
                <p className="mt-0.5 font-mono font-semibold text-foreground">
                  {product.sku}
                </p>
              </div>
              <div className="rounded-md border border-border bg-white p-2.5">
                <p className="text-[10px] font-medium uppercase text-muted">
                  Barcode
                </p>
                <p className="mt-0.5 truncate font-mono font-semibold text-foreground">
                  {product.barcode || "—"}
                </p>
              </div>
            </div>

            {/* 4-Row Vertical Column Visual Breakdown */}
            <div className="space-y-1.5 rounded-lg border border-border bg-white p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground">
                  4-Row Shelf Column Plan
                </span>
                <span className="font-mono text-muted">
                  {qty}/{position.maximumCapacity} units
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {rowPlan.map((row) => (
                  <div
                    key={row.rowIndex}
                    className={`rounded border px-1.5 py-1.5 text-center font-mono text-[10px] ${
                      row.isFull
                        ? "border-teal-300 bg-teal-50 font-semibold text-teal-900"
                        : row.quantity > 0
                          ? "border-border bg-surface-subtle font-medium text-foreground"
                          : "border-dashed border-border bg-white text-muted"
                    }`}
                  >
                    <div className="font-sans text-[10px] font-semibold">
                      {row.rowLabel}
                    </div>
                    <div>
                      {row.quantity}/{row.capacity}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Real Scannable Barcode Strip */}
            {product.barcode && (
              <div className="flex flex-col items-center rounded-lg border border-border bg-surface-subtle/60 px-3 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/barcodes/label?value=${encodeURIComponent(product.barcode)}&format=svg&height=10&scale=2`}
                  alt={`Barcode ${product.barcode}`}
                  className="max-h-12 w-auto"
                />
              </div>
            )}

            {/* Context-specific actions (Add to Basket in Storefront OR Edit/POS in Digital Twin) */}
            {footerActions && <div className="pt-1">{footerActions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
