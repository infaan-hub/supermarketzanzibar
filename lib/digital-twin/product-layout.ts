// Pure product facing & 4-row single-product column planogram helpers for Supermarket Zanzibar 3D.
// Framework-free TypeScript so both R3F components and Vitest suites can import directly.

import { getAssetEntry } from "@/lib/digital-twin/asset-manifest";

export const DEFAULT_ROWS_PER_COLUMN = 4;
export const DEFAULT_UNITS_PER_ROW = 6;

export interface SlotFacingPlacement {
  row: number;
  col: number;
  xOffset: number;
  zBack: number;
  jitterY: number;
  isHero: boolean;
}

export interface ColumnRowFacing extends SlotFacingPlacement {
  /** Shelf row index inside the 4-row vertical column (0 = bottom Row 1 .. 3 = top Row 4). */
  shelfRowIndex: number;
  /** True for every front-line facing in a stocked row so the full merchandised row shows HD packaging labels. */
  isRowFrontLabel: boolean;
}

export interface ColumnRowPlan {
  /** 0 = bottom Row 1 .. 3 = top Row 4 */
  rowIndex: number;
  rowLabel: string;
  quantity: number;
  capacity: number;
  isFull: boolean;
  fillPercent: number;
}

const CYLINDRICAL_ASSET_RE =
  /(soda-can|energy-can|soda-bottle|water-bottle|glass-bottle|oil-bottle|canned-food|glass-jar|yogurt-cup|ice-cream-tub|shampoo-bottle|lotion-pump|cream-jar|spray-bottle|electric-kettle)/i;
const COMPACT_ASSET_RE =
  /(soda-can|energy-can|soda-bottle|water-bottle|glass-bottle|juice-carton|milk-carton|yogurt-cup|ice-cream-tub|canned-food|glass-jar|shampoo-bottle|lotion-pump|cream-jar|perfume-bottle|soap-box|spray-bottle|battery-pack)/i;

/** Returns true for cylindrical / curved bottles, cans, cups & jars that receive a curved label sleeve. */
export function isCylindricalProductAsset(assetKey: string): boolean {
  const entry = getAssetEntry(assetKey);
  if (entry?.labelWrap) {
    return (
      entry.labelWrap.style === "cylinder" ||
      entry.labelWrap.style === "tapered_cup" ||
      entry.labelWrap.style === "jug"
    );
  }
  return CYLINDRICAL_ASSET_RE.test(assetKey);
}

/** Returns true for narrow/compact shapes that pack more facings cleanly across a shelf column. */
export function isCompactProductAsset(assetKey: string): boolean {
  const entry = getAssetEntry(assetKey);
  if (entry && entry.compactOnShelf !== undefined) {
    return entry.compactOnShelf;
  }
  return COMPACT_ASSET_RE.test(assetKey);
}

/** True when all 4 rows in a product column have reached planned capacity. */
export function isColumnFull(quantity: number, maximumCapacity: number): boolean {
  return maximumCapacity > 0 && quantity >= maximumCapacity;
}

/**
 * Compute the planned per-row capacity & sequential row-by-row fill across the
 * 4 vertical rows (Row 1 bottom -> Row 4 top) of ONE single-product column.
 *
 * Example (maximumCapacity = 24 => 6 units planned per row):
 * - quantity = 14 => Row 1: 6/6 (Full), Row 2: 6/6 (Full), Row 3: 2/6, Row 4: 0/6
 * - quantity = 24 => Row 1..4 all 6/6 (Full) => column is 4/4 full, add new column for same product!
 */
export function computeColumnRowPlan(
  quantity: number,
  maximumCapacity = DEFAULT_ROWS_PER_COLUMN * DEFAULT_UNITS_PER_ROW,
  rowCount = DEFAULT_ROWS_PER_COLUMN,
): ColumnRowPlan[] {
  const safeRows = Math.max(1, rowCount);
  const safeCap = Math.max(safeRows, Math.floor(maximumCapacity || safeRows * DEFAULT_UNITS_PER_ROW));
  const safeQty = Math.max(0, Math.floor(quantity));

  const baseRowCap = Math.floor(safeCap / safeRows);
  const capRemainder = safeCap % safeRows;

  const plan: ColumnRowPlan[] = [];
  let remaining = safeQty;

  for (let r = 0; r < safeRows; r += 1) {
    const capacity = baseRowCap + (r < capRemainder ? 1 : 0);
    // On the top-most row, cap visual fill at capacity (overflow belongs in an added same-product column).
    const rowQty = Math.min(capacity, remaining);
    remaining = Math.max(0, remaining - rowQty);
    plan.push({
      rowIndex: r,
      rowLabel: `Row ${r + 1}`,
      quantity: rowQty,
      capacity,
      isFull: capacity > 0 && rowQty >= capacity,
      fillPercent: capacity > 0 ? Math.min(100, Math.round((rowQty / capacity) * 100)) : 0,
    });
  }

  return plan;
}

/** Convenience array of unit counts per row [Row1, Row2, Row3, Row4]. */
export function computeColumnRowQuantities(
  quantity: number,
  rowCount = DEFAULT_ROWS_PER_COLUMN,
  maximumCapacity = rowCount * DEFAULT_UNITS_PER_ROW,
): number[] {
  return computeColumnRowPlan(quantity, maximumCapacity, rowCount).map(
    (r) => r.quantity,
  );
}

/** Count how many of the 4 rows in this column currently hold at least 1 unit. */
export function filledRowCount(
  quantity: number,
  rowCount = DEFAULT_ROWS_PER_COLUMN,
  maximumCapacity = rowCount * DEFAULT_UNITS_PER_ROW,
): number {
  return computeColumnRowPlan(quantity, maximumCapacity, rowCount).filter(
    (r) => r.quantity > 0,
  ).length;
}

/** Count how many of the 4 rows in this column are completely at capacity. */
export function fullRowCount(
  quantity: number,
  maximumCapacity = DEFAULT_ROWS_PER_COLUMN * DEFAULT_UNITS_PER_ROW,
  rowCount = DEFAULT_ROWS_PER_COLUMN,
): number {
  return computeColumnRowPlan(quantity, maximumCapacity, rowCount).filter(
    (r) => r.isFull,
  ).length;
}

/**
 * Neat edge-to-edge merchandised facing layout for a single shelf row inside a column.
 * Arranges products in straight horizontal rows spanning the column width with
 * back-to-front depth rows behind the front line.
 */
export function computeSlotFacings({
  quantity,
  assetKey,
  maxDepthBack,
  slotSeed = 0,
  maxColumnWidth,
}: {
  quantity: number;
  assetKey: string;
  maxDepthBack: number;
  slotSeed?: number;
  maxColumnWidth?: number;
}): SlotFacingPlacement[] {
  if (quantity <= 0) return [];

  const isCompact = isCompactProductAsset(assetKey);
  const unitPitch = isCompact ? 0.145 : 0.255;

  // Fill the planned column width cleanly edge-to-edge (with subtle divider clearance)
  const usableW = maxColumnWidth ? Math.max(0.28, maxColumnWidth - 0.16) : isCompact ? 0.48 : 0.52;
  const maxCols = Math.max(
    1,
    Math.min(isCompact ? 6 : 4, Math.floor(usableW / unitPitch)),
  );
  const colSpacing =
    maxCols > 1
      ? Math.min(unitPitch * 1.18, usableW / maxCols)
      : unitPitch;

  // Up to 3 depth rows behind the front facing line
  const maxVisible = maxCols * 3;
  const visibleUnits = Math.min(maxVisible, Math.max(1, quantity));

  const totalRows = Math.min(3, Math.ceil(visibleUnits / maxCols));
  const rowStepZ = Math.min(
    isCompact ? 0.125 : 0.145,
    maxDepthBack / Math.max(1, totalRows),
  );

  const placements: SlotFacingPlacement[] = [];
  let remaining = visibleUnits;

  for (let row = 0; row < totalRows && remaining > 0; row += 1) {
    const colsInRow = Math.min(maxCols, remaining);
    remaining -= colsInRow;
    const zBack = -row * rowStepZ;

    for (let col = 0; col < colsInRow; col += 1) {
      const centerIndex = (colsInRow - 1) / 2;
      const xOffset = (col - centerIndex) * colSpacing;
      const isHero = row === 0 && col === Math.floor(colsInRow / 2);
      // Keep rows crisp and neatly faced (subtle natural micro-variance on back stock only)
      const hash = ((slotSeed * 31 + row * 17 + col * 13) % 9) - 4;
      const jitterY = row === 0 ? 0 : hash * 0.005;
      const jitterZ = row === 0 ? 0 : (hash % 2) * 0.003;

      placements.push({
        row,
        col,
        xOffset,
        zBack: zBack + jitterZ,
        jitterY,
        isHero,
      });
    }
  }

  return placements;
}

/**
 * Compute all 3D unit placements across all 4 vertical rows of ONE single-product
 * shelf column using its planned row-by-row fill (`computeColumnRowPlan`).
 *
 * - Every front-line unit (`depthRow === 0`) across all stocked rows gets
 *   `isRowFrontLabel = true` so the entire merchandised horizontal row wears the
 *   crisp HD packaging label (no mismatched blank boxes next to labeled units!).
 * - One eye-level front-center unit gets `isHero = true` for GSAP inspect/pick animations.
 * - All rear depth rows (`depthRow > 0`) batch cleanly into GPU `InstancedMesh`.
 */
export function computeColumnFacings({
  quantity,
  maximumCapacity = DEFAULT_ROWS_PER_COLUMN * DEFAULT_UNITS_PER_ROW,
  assetKey,
  maxDepthBack,
  columnWidth,
  rowCount = DEFAULT_ROWS_PER_COLUMN,
  slotSeed = 0,
}: {
  quantity: number;
  maximumCapacity?: number;
  assetKey: string;
  maxDepthBack: number;
  columnWidth: number;
  rowCount?: number;
  slotSeed?: number;
}): ColumnRowFacing[] {
  const rowPlans = computeColumnRowPlan(quantity, maximumCapacity, rowCount);
  const all: ColumnRowFacing[] = [];

  // Preferred eye-level hero row: Row 3 (index 2) if stocked, otherwise highest stocked row.
  let heroRowIdx = -1;
  if (rowPlans[2]?.quantity > 0) {
    heroRowIdx = 2;
  } else {
    for (let r = rowPlans.length - 1; r >= 0; r -= 1) {
      if (rowPlans[r].quantity > 0) {
        heroRowIdx = r;
        break;
      }
    }
  }

  for (const rowPlan of rowPlans) {
    if (rowPlan.quantity <= 0) continue;
    const rowUnits = computeSlotFacings({
      quantity: rowPlan.quantity,
      assetKey,
      maxDepthBack,
      slotSeed: slotSeed * 7 + rowPlan.rowIndex + 1,
      maxColumnWidth: columnWidth,
    });
    for (const u of rowUnits) {
      all.push({
        ...u,
        shelfRowIndex: rowPlan.rowIndex,
        isRowFrontLabel: u.row === 0,
        isHero: rowPlan.rowIndex === heroRowIdx && u.isHero,
      });
    }
  }

  return all;
}
