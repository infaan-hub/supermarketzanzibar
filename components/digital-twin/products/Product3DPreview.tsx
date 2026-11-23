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
  getAssetEntry,
  resolveProductAsset,
} from "@/lib/digital-twin/asset-manifest";
import {
  categoryAccentPalette,
  getProductBackLabelTexture,
  getProductLabelTexture,
} from "@/lib/digital-twin/procedural-textures";
import { formatMoney } from "@/lib/format";
import { DetailedProductMesh } from "./ProductModel";

type PreviewAngle = "front" | "back" | "angle";

export interface Product3DPreviewProps {
  /** Product display name (updates label live as user types). */
  name: string;
  /** Category display name (drives accent palette & packaging header). */
  categoryName?: string | null;
  /** Selling price (numeric or string, formatted as TSh on package). */
  price?: number | string | null;
  /** Optional barcode or SKU printed on front/back barcode strips. */
  barcode?: string | null;
  /** Optional description rendered on back-of-package info card. */
  description?: string | null;
  /** Active image URL — accepts uploaded `/api/products/.../image` OR local `blob:` URL before upload! */
  imageUrl?: string | null;
  /** Explicit 3D shape assetKey from ASSET_MANIFEST (empty/null = auto-detect from name & category). */
  assetKey?: string | null;
  /** Optional badge notice when previewing an unuploaded local image or unsaved changes. */
  pendingUploadLabel?: string | null;
  /** Compact height variant for inline cards vs taller studio stage. */
  heightClassName?: string;
}

function PreviewStudioScene({
  assetKey,
  assetPath,
  name,
  categoryName,
  priceText,
  barcode,
  description,
  imageUrl,
  autoSpin,
  angleCommand,
}: {
  assetKey: string;
  assetPath: string;
  name: string;
  categoryName: string | null;
  priceText: string;
  barcode: string;
  description: string;
  imageUrl: string | null;
  autoSpin: boolean;
  angleCommand: { angle: PreviewAngle; nonce: number };
}) {
  const turntableRef = React.useRef<THREE.Group>(null);
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);

  const safeName = name.trim() || "New Supermarket Product";
  const previewId = React.useMemo(
    () => `preview-${assetKey}`,
    [assetKey],
  );

  const frontLabelTexture = React.useMemo(
    () =>
      getProductLabelTexture({
        productId: previewId,
        name: safeName,
        categoryName,
        priceText,
        barcode: barcode || "ZN00000001",
        imageUrl,
        description,
      }),
    [previewId, safeName, categoryName, priceText, barcode, imageUrl, description],
  );

  const backLabelTexture = React.useMemo(
    () =>
      getProductBackLabelTexture({
        productId: previewId,
        name: safeName,
        categoryName,
        priceText,
        barcode: barcode || "ZN00000001",
        sku: barcode || "PREVIEW",
        imageUrl,
        description,
      }),
    [previewId, safeName, categoryName, priceText, barcode, imageUrl, description],
  );

  const accent = React.useMemo(
    () => categoryAccentPalette(categoryName, safeName),
    [categoryName, safeName],
  );

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
      duration: 0.55,
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

      <hemisphereLight args={["#ffffff", "#d8e3e1", 0.95]} />
      <directionalLight
        position={[2.2, 3.4, 3.0]}
        intensity={1.45}
        color="#fffdf9"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <directionalLight
        position={[-2.4, 1.8, -2.0]}
        intensity={0.75}
        color="#e0f2fe"
      />
      <pointLight
        position={[0, 1.3, 1.7]}
        intensity={1.5}
        distance={5}
        decay={2}
        color="#ffffff"
      />

      {/* Offline procedural softbox environment */}
      <Environment resolution={128}>
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[0, 5, 2]}
          rotation={[Math.PI / 2.4, 0, 0]}
          scale={[6, 4, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={1.7}
          position={[-4, 1.5, 2]}
          rotation={[0, Math.PI / 2.5, 0]}
          scale={[4, 3, 1]}
          color="#e0f2fe"
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          position={[4, 1.5, -1.5]}
          rotation={[0, -Math.PI / 2.2, 0]}
          scale={[4, 3, 1]}
          color="#fff4e0"
        />
        <Lightformer
          form="rect"
          intensity={0.85}
          position={[0, -3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
          color="#eef5f4"
        />
      </Environment>

      {/* Studio Pedestal Disc */}
      <mesh position={[0, -0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.03, 40]} />
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.22}
          metalness={0.05}
          clearcoat={0.35}
        />
      </mesh>
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.32}
        scale={1.3}
        blur={2.0}
        far={1.2}
        resolution={256}
        color="#0f2329"
      />

      <group ref={turntableRef} position={[0, 0.002, 0]}>
        <React.Suspense
          fallback={
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.2, 0.36, 0.16]} />
              <meshStandardMaterial color={accent.primary} />
            </mesh>
          }
        >
          <DetailedProductMesh
            key={assetPath}
            assetPath={assetPath}
            assetKey={assetKey}
            frontLabelTexture={frontLabelTexture}
            backLabelTexture={backLabelTexture}
            accentColor={accent.primary}
            scaleMultiplier={1.75}
          />
        </React.Suspense>
      </group>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0.2, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.38}
        maxDistance={1.55}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI * 0.56}
      />
    </>
  );
}

export function Product3DPreview({
  name,
  categoryName = null,
  price = 0,
  barcode = "",
  description = "",
  imageUrl = null,
  assetKey = null,
  pendingUploadLabel = null,
  heightClassName = "h-[300px]",
}: Product3DPreviewProps) {
  const [autoSpin, setAutoSpin] = React.useState(true);
  const [angleCommand, setAngleCommand] = React.useState<{
    angle: PreviewAngle;
    nonce: number;
  }>({ angle: "angle", nonce: 0 });

  const autoResolved = React.useMemo(
    () => resolveProductAsset(name || "Product", categoryName),
    [name, categoryName],
  );
  const explicitEntry = assetKey ? getAssetEntry(assetKey) : undefined;
  const activeEntry =
    explicitEntry && explicitEntry.category === "product"
      ? explicitEntry
      : autoResolved;
  const isExplicit = Boolean(
    explicitEntry && explicitEntry.category === "product",
  );

  const numericPrice = Number(price);
  const priceText =
    Number.isFinite(numericPrice) && numericPrice > 0
      ? formatMoney(numericPrice)
      : "TSh 0";

  const jumpTo = (angle: PreviewAngle) => {
    setAutoSpin(false);
    setAngleCommand({ angle, nonce: Date.now() });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {/* Studio Preview Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-subtle/80 px-3.5 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Live 3D Shelf Preview
            </span>
            <Badge variant={isExplicit ? "default" : "secondary"}>
              {isExplicit ? "Selected Shape" : "Auto Shape"}
            </Badge>
            {pendingUploadLabel && (
              <Badge variant="warning">{pendingUploadLabel}</Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {activeEntry.departmentLabel ? `${activeEntry.departmentLabel} · ` : ""}
            <span className="font-medium text-foreground">
              {activeEntry.name}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-[11px]"
            onClick={() => jumpTo("front")}
          >
            Front
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-[11px]"
            onClick={() => jumpTo("back")}
          >
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            variant={autoSpin ? "default" : "secondary"}
            className="h-7 px-2 text-[11px]"
            onClick={() => setAutoSpin((v) => !v)}
          >
            {autoSpin ? "Spin: On" : "Spin: Off"}
          </Button>
        </div>
      </div>

      {/* Interactive 3D Viewport */}
      <div className={`relative w-full bg-[#f3f7f6] ${heightClassName}`}>
        <Canvas
          shadows
          dpr={[1.25, 2]}
          camera={{
            position: [0.16, 0.28, 0.8],
            fov: 36,
            near: 0.04,
            far: 20,
          }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.06,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
        >
          <PreviewStudioScene
            assetKey={activeEntry.key}
            assetPath={activeEntry.path}
            name={name}
            categoryName={categoryName}
            priceText={priceText}
            barcode={barcode ?? ""}
            description={description ?? ""}
            imageUrl={imageUrl}
            autoSpin={autoSpin}
            angleCommand={angleCommand}
          />
        </Canvas>

        <div className="pointer-events-none absolute right-2.5 bottom-2.5 left-2.5 flex items-center justify-between gap-2 text-[10px]">
          <span className="truncate rounded bg-white/90 px-2 py-0.5 font-medium text-muted shadow-sm backdrop-blur-sm">
            Drag to inspect 360° · Scroll to zoom · Front &amp; Back HD wrap
          </span>
          <span className="shrink-0 rounded bg-teal-700/90 px-1.5 py-0.5 font-semibold text-white shadow-sm">
            3D HD
          </span>
        </div>
      </div>

      {/* Shape Description Footer */}
      {activeEntry.shapeSummary && (
        <div className="border-t border-border bg-white px-3.5 py-2 text-[11px] text-muted">
          <span className="font-semibold text-foreground">3D Shape: </span>
          {activeEntry.shapeSummary}
        </div>
      )}
    </div>
  );
}
