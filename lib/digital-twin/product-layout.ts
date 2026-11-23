// Pure product facing layout & shape classification helpers for Supermarket Zanzibar 3D.
// Framework-free TypeScript so both R3F components and Vitest suites can import directly.

export interface SlotFacingPlacement {
  row: number;
  col: number;
  xOffset: number;
  zBack: number;
  jitterY: number;
  isHero: boolean;
}

const CYLINDRICAL_ASSET_RE =
  /(soda-can|soda-bottle|water-bottle|oil-bottle|canned-food|shampoo-bottle)/i;
const COMPACT_ASSET_RE =
  /(soda-can|soda-bottle|water-bottle|juice-carton|milk-carton|canned-food|shampoo-bottle|soap-box)/i;

/** Returns true for cylindrical bottles/cans that receive a curved label sleeve. */
export function isCylindricalProductAsset(assetKey: string): boolean {
  return CYLINDRICAL_ASSET_RE.test(assetKey);
}

/**
 * Granular back-to-front multi-row facing layout driven by actual live stock.
 * Renders 1..3 rows deep × 1..3 columns wide so shelves visibly thin out from
 * the rear row forward as items sell or get picked into the customer's basket.
 */
export function computeSlotFacings({
  quantity,
  assetKey,
  maxDepthBack,
  slotSeed = 0,
}: {
  quantity: number;
  assetKey: string;
  maxDepthBack: number;
  slotSeed?: number;
}): SlotFacingPlacement[] {
  if (quantity <= 0) return [];

  const isCompact = COMPACT_ASSET_RE.test(assetKey);
  const maxCols = isCompact ? 3 : 2;
  const colSpacing = isCompact ? 0.125 : 0.195;

  // Map live quantity to visible unit count (up to 9 compact or 6 wide facings across 3 depth rows)
  let visibleUnits: number;
  if (isCompact) {
    if (quantity <= 3) visibleUnits = quantity;
    else if (quantity <= 5) visibleUnits = 4;
    else if (quantity <= 7) visibleUnits = 5;
    else if (quantity <= 10) visibleUnits = 6;
    else if (quantity <= 13) visibleUnits = 7;
    else if (quantity <= 17) visibleUnits = 8;
    else visibleUnits = 9;
  } else {
    if (quantity <= 2) visibleUnits = quantity;
    else if (quantity <= 4) visibleUnits = 3;
    else if (quantity <= 7) visibleUnits = 4;
    else if (quantity <= 12) visibleUnits = 5;
    else visibleUnits = 6;
  }

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
      // Deterministic micro-jitter on non-hero units for hand-stocked realism
      const hash = ((slotSeed * 31 + row * 17 + col * 13) % 11) - 5;
      const jitterY = isHero ? 0 : hash * 0.011;
      const jitterZ = isHero ? 0 : (hash % 3) * 0.004;

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
