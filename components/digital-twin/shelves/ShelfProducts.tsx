"use client";

import * as React from "react";
import type {
  TwinShelfNode,
  TwinShelfPositionNode,
  TwinViewMode,
} from "@/types/digital-twin";
import { ProductModel } from "@/components/digital-twin/products/ProductModel";

export function ShelfProducts({
  shelf,
  viewMode,
  selectedPositionId,
  recentlyRestockedPositionIds,
  onSelectProduct,
}: {
  shelf: TwinShelfNode;
  viewMode: TwinViewMode;
  selectedPositionId: string | null;
  recentlyRestockedPositionIds: ReadonlySet<string>;
  onSelectProduct: (pos: TwinShelfPositionNode) => void;
}) {
  const [w, h, d] = shelf.size;
  const isZLong = d >= w;
  const span = isZLong ? d * 0.78 : w * 0.78;
  const frontOffset = isZLong ? w * 0.24 : d * 0.24;

  return (
    <group name={`${shelf.objectName}_Products`}>
      {shelf.positions.map((pos, idx) => {
        const tier =
          Math.floor(pos.slotIndex / Math.max(1, shelf.slotsPerTier)) %
          Math.max(1, shelf.tiers);
        const slot = pos.slotIndex % Math.max(1, shelf.slotsPerTier);
        const frac =
          shelf.slotsPerTier > 1
            ? slot / (shelf.slotsPerTier - 1) - 0.5
            : 0;
        const along = frac * span;
        const y =
          0.28 + tier * ((h - 0.48) / Math.max(1, shelf.tiers));

        const localPos: [number, number, number] = isZLong
          ? [idx % 2 === 0 ? frontOffset : -frontOffset, y, along]
          : [along, y, frontOffset];

        return (
          <ProductModel
            key={pos.id}
            positionNode={pos}
            localPosition={localPos}
            viewMode={viewMode}
            isSelected={selectedPositionId === pos.id}
            isRecentlyRestocked={recentlyRestockedPositionIds.has(pos.id)}
            onSelect={onSelectProduct}
          />
        );
      })}
    </group>
  );
}
