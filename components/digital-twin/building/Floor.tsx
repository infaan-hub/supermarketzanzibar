"use client";

import * as React from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  getFloorAisleDecalTexture,
  getTerrazzoTextures,
  getWarehouseConcreteTexture,
} from "@/lib/digital-twin/procedural-textures";
import {
  BUILDING_DIMENSIONS,
  PHYSICAL_AREAS,
  isPointInsideObstacle,
} from "@/lib/digital-twin/spatial-plan";

const FLOOR_AISLE_MARKERS: Array<{
  label: string;
  subtitle?: string;
  x: number;
  z: number;
  width?: number;
}> = [
  { label: "AISLE 1", subtitle: "STAPLES", x: -8.5, z: 5.0 },
  { label: "AISLE 2", subtitle: "OILS", x: -5.1, z: 5.0 },
  { label: "AISLE 3", subtitle: "CEREALS", x: -1.5, z: 5.0 },
  { label: "AISLE 4", subtitle: "DRINKS", x: 2.1, z: 5.0 },
  { label: "AISLE 5", subtitle: "COOLERS", x: 5.4, z: 5.0 },
  { label: "FRESH", subtitle: "PRODUCE", x: 13.5, z: 8.8, width: 1.8 },
  { label: "DAIRY", subtitle: "CHILLED", x: 13.8, z: -5.0, width: 1.7 },
  { label: "BAKERY", subtitle: "FRESH", x: -14.2, z: 4.4, width: 1.7 },
  { label: "CHECKOUT", subtitle: "LANES 1–4", x: -0.6, z: 10.4, width: 2.1 },
];

function FloorAisleDecal({
  label,
  subtitle,
  x,
  z,
  width = 1.55,
}: {
  label: string;
  subtitle?: string;
  x: number;
  z: number;
  width?: number;
}) {
  const texture = React.useMemo(
    () => getFloorAisleDecalTexture(label, subtitle),
    [label, subtitle],
  );
  if (!texture) return null;

  return (
    <mesh
      position={[x, 0.008, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[width, width * 0.375]} />
      <meshStandardMaterial
        map={texture}
        transparent
        roughness={0.45}
        metalness={0.04}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Matterport-style breathing walk target ring + expanding click ripple feedback. */
function WalkFloorReticle({
  hoverPoint,
  clickRipple,
}: {
  hoverPoint: [number, number] | null;
  clickRipple: { x: number; z: number; startedAt: number } | null;
}) {
  const outerRingRef = React.useRef<THREE.Mesh>(null);
  const rippleRef = React.useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (outerRingRef.current) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 5.2) * 0.07;
      outerRingRef.current.scale.set(pulse, pulse, 1);
    }
    if (rippleRef.current && clickRipple) {
      const elapsed = (performance.now() - clickRipple.startedAt) / 600;
      if (elapsed >= 1) {
        rippleRef.current.visible = false;
      } else {
        rippleRef.current.visible = true;
        const s = 0.7 + elapsed * 1.9;
        rippleRef.current.scale.set(s, s, 1);
        const mat = rippleRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - elapsed) * 0.75);
      }
    }
  });

  return (
    <>
      {hoverPoint && (
        <group position={[hoverPoint[0], 0.014, hoverPoint[1]]}>
          <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.21, 0.29, 36]} />
            <meshBasicMaterial
              color="#0f766e"
              transparent
              opacity={0.78}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.14, 0.21, 36]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.065, 24]} />
            <meshBasicMaterial
              color="#0f766e"
              transparent
              opacity={0.52}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {clickRipple && (
        <mesh
          ref={rippleRef}
          position={[clickRipple.x, 0.016, clickRipple.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.22, 0.3, 36]} />
          <meshBasicMaterial
            color="#14b8a6"
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}

export function Floor({
  showZoneGuides = true,
  highlightedDepartmentCode,
  shopperMode = false,
  onWalkToFloorPoint,
}: {
  showZoneGuides?: boolean;
  highlightedDepartmentCode?: string | null;
  shopperMode?: boolean;
  onWalkToFloorPoint?: (point: [number, number]) => void;
}) {
  const terrazzo = React.useMemo(() => getTerrazzoTextures(), []);
  const warehouseConcrete = React.useMemo(() => getWarehouseConcreteTexture(), []);
  const [hoverPoint, setHoverPoint] = React.useState<[number, number] | null>(
    null,
  );
  const [clickRipple, setClickRipple] = React.useState<{
    x: number;
    z: number;
    startedAt: number;
  } | null>(null);
  const pointerDownPosRef = React.useRef<{ x: number; y: number } | null>(null);

  const isWalkable = (x: number, z: number) => {
    const b = BUILDING_DIMENSIONS.retail.bounds;
    if (x < b.minX + 1.0 || x > b.maxX - 1.0 || z < b.minZ + 1.0 || z > b.maxZ - 0.8) {
      return false;
    }
    return !isPointInsideObstacle(x, z, 0.45);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!onWalkToFloorPoint) return;
    const x = e.point.x;
    const z = e.point.z;
    if (isWalkable(x, z)) {
      setHoverPoint([x, z]);
      document.body.style.cursor = "pointer";
    } else {
      setHoverPoint(null);
      document.body.style.cursor = "auto";
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onWalkToFloorPoint) return;
    // Ignore drag-release clicks so orbiting never triggers accidental walking.
    const start = pointerDownPosRef.current;
    if (start) {
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved > 6) return;
    }
    const x = e.point.x;
    const z = e.point.z;
    if (isWalkable(x, z)) {
      e.stopPropagation();
      setClickRipple({ x, z, startedAt: performance.now() });
      onWalkToFloorPoint([x, z]);
    }
  };

  return (
    <group name="Supermarket_Floor_Group">
      {/* Main 1024px HD procedural PBR polished terrazzo retail floor with soft clearcoat reflections */}
      <mesh
        name="Retail_Floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerOut={() => {
          setHoverPoint(null);
          document.body.style.cursor = "auto";
        }}
        onClick={handleClick}
      >
        <planeGeometry args={[38, 28]} />
        <meshPhysicalMaterial
          color="#ffffff"
          map={terrazzo?.map}
          roughnessMap={terrazzo?.roughnessMap}
          bumpMap={terrazzo?.bumpMap}
          bumpScale={0.015}
          roughness={0.36}
          metalness={0.04}
          clearcoat={0.16}
          clearcoatRoughness={0.22}
          reflectivity={0.65}
        />
      </mesh>

      {/* Industrial sealed epoxy concrete warehouse & back-of-house floor */}
      <mesh
        name="Warehouse_Floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, -22]}
        receiveShadow
      >
        <planeGeometry args={[38, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          map={warehouseConcrete?.map}
          bumpMap={warehouseConcrete?.bumpMap}
          bumpScale={0.014}
          roughness={0.72}
          metalness={0.06}
        />
      </mesh>

      {/* Exterior coral-stone apron & parking promenade */}
      <mesh
        name="Exterior_Apron"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, -4]}
        receiveShadow
      >
        <planeGeometry args={[78, 78]} />
        <meshStandardMaterial color="#d8e3e0" roughness={0.94} />
      </mesh>

      {/* Crisp realistic inlaid floor aisle markers in Shopper Mode */}
      {shopperMode &&
        FLOOR_AISLE_MARKERS.map((marker) => (
          <FloorAisleDecal
            key={marker.label}
            label={marker.label}
            subtitle={marker.subtitle}
            x={marker.x}
            z={marker.z}
            width={marker.width}
          />
        ))}

      {/* Matterport-style Click-to-Walk animated floor hover reticle & click ripple */}
      {onWalkToFloorPoint && (
        <WalkFloorReticle hoverPoint={hoverPoint} clickRipple={clickRipple} />
      )}

      {/* Translucent colored department floor inlays — strictly hidden in customer shopperMode,
          reserved for Staff/Admin heatmap & operations view. */}
      {showZoneGuides &&
        !shopperMode &&
        PHYSICAL_AREAS.map((area) => {
          const isHighlighted = Boolean(
            highlightedDepartmentCode &&
              highlightedDepartmentCode.toUpperCase() ===
                area.code.toUpperCase(),
          );

          const width = area.bounds.maxX - area.bounds.minX;
          const depth = area.bounds.maxZ - area.bounds.minZ;
          const cx = (area.bounds.minX + area.bounds.maxX) / 2;
          const cz = (area.bounds.minZ + area.bounds.maxZ) / 2;

          return (
            <mesh
              key={area.id}
              name={`Zone_Floor_${area.code}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[cx, 0.007, cz]}
              receiveShadow
            >
              <planeGeometry args={[width - 0.16, depth - 0.16]} />
              <meshStandardMaterial
                color={area.accentColor}
                transparent
                opacity={isHighlighted ? 0.16 : 0.055}
                roughness={0.7}
              />
            </mesh>
          );
        })}
    </group>
  );
}
