// Shared product shelf placement serialization & transactional assignment helpers.
// Keeps Product Information forms, Product Cards, and the 3D Digital Twin
// synchronized with the 4-row single-product vertical column planogram model.

import type { Prisma } from "@prisma/client";
import {
  DEFAULT_ROWS_PER_COLUMN,
  computeColumnRowPlan,
  type ColumnRowPlan,
} from "@/lib/digital-twin/product-layout";
import { resolveProductAsset } from "@/lib/digital-twin/asset-manifest";
import {
  findFixtureByCode,
  shelfSlotWorldPosition,
} from "@/lib/digital-twin/spatial-plan";

export const MAX_COLUMNS_PER_SHELF = 12;

export interface ProductShelfPlacementDTO {
  positionId: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  shelfId: string;
  shelfCode: string;
  shelfName: string;
  positionCode: string;
  slotIndex: number;
  columnNumber: number;
  quantity: number;
  maximumCapacity: number;
  reorderLevel: number;
  rowCount: number;
  filledRows: number;
  activeRowLabel: string;
  rowPlan: ColumnRowPlan[];
}

export interface ShelfPositionWithHierarchy {
  id: string;
  shelfId: string;
  positionCode: string;
  slotIndex: number;
  quantity: number;
  maximumCapacity: number;
  reorderLevel: number;
  shelf: {
    id: string;
    shelfCode: string;
    shelfName: string;
    department: {
      id: string;
      code: string;
      name: string;
    };
  };
}

export function formatActiveRowLabel(rowPlan: ColumnRowPlan[]): string {
  const filled = rowPlan.filter((r) => r.quantity > 0);
  if (filled.length === 0) {
    return "Row 1 (Not stocked yet)";
  }
  const allFull = rowPlan.every((r) => r.isFull);
  if (allFull) {
    return `Rows 1–${rowPlan.length} (Full)`;
  }
  if (filled.length === 1) {
    return `Row ${filled[0].rowIndex + 1}`;
  }
  const first = filled[0].rowIndex + 1;
  const last = filled[filled.length - 1].rowIndex + 1;
  return `Rows ${first}–${last}`;
}

export function serializeShelfPositions(
  positions: ShelfPositionWithHierarchy[] | undefined | null,
): ProductShelfPlacementDTO[] {
  if (!positions || positions.length === 0) return [];

  return [...positions]
    .sort((a, b) => {
      const codeCmp = a.shelf.shelfCode.localeCompare(b.shelf.shelfCode);
      if (codeCmp !== 0) return codeCmp;
      return a.slotIndex - b.slotIndex;
    })
    .map((pos) => {
      const rowPlan = computeColumnRowPlan(
        pos.quantity,
        pos.maximumCapacity,
        DEFAULT_ROWS_PER_COLUMN,
      );
      const filledRows = rowPlan.filter((r) => r.quantity > 0).length;
      return {
        positionId: pos.id,
        departmentId: pos.shelf.department.id,
        departmentCode: pos.shelf.department.code,
        departmentName: pos.shelf.department.name,
        shelfId: pos.shelf.id,
        shelfCode: pos.shelf.shelfCode,
        shelfName: pos.shelf.shelfName,
        positionCode: pos.positionCode,
        slotIndex: pos.slotIndex,
        columnNumber: pos.slotIndex + 1,
        quantity: pos.quantity,
        maximumCapacity: pos.maximumCapacity,
        reorderLevel: pos.reorderLevel,
        rowCount: DEFAULT_ROWS_PER_COLUMN,
        filledRows,
        activeRowLabel: formatActiveRowLabel(rowPlan),
        rowPlan,
      };
    });
}

/**
 * Compute target shelf units for a desired row coverage (1..4 rows) inside a
 * 4-row column of capacity `maximumCapacity`.
 */
export function unitsForTargetRows(
  rowNumber: number,
  maximumCapacity: number,
  availableProductStock?: number,
): number {
  const clampedRows = Math.min(
    DEFAULT_ROWS_PER_COLUMN,
    Math.max(1, Math.floor(rowNumber)),
  );
  const plan = computeColumnRowPlan(
    maximumCapacity,
    maximumCapacity,
    DEFAULT_ROWS_PER_COLUMN,
  );
  const plannedForRows = plan
    .slice(0, clampedRows)
    .reduce((sum, row) => sum + row.capacity, 0);

  if (
    availableProductStock !== undefined &&
    Number.isFinite(availableProductStock) &&
    availableProductStock > 0
  ) {
    return Math.min(plannedForRows, Math.floor(availableProductStock));
  }
  return plannedForRows;
}

export class ShelfPlacementError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "ShelfPlacementError";
  }
}

export interface ApplyShelfPlacementInput {
  shelfId?: string | null;
  positionId?: string | null;
  previousPositionId?: string | null;
  rowNumber?: number | null;
}

export async function applyProductShelfPlacement(
  tx: Prisma.TransactionClient,
  args: {
    productId: bigint;
    productName: string;
    categoryName: string | null;
    productQuantity: number;
    placement: ApplyShelfPlacementInput;
  },
): Promise<{
  changed: boolean;
  shelfId?: string;
  shelfCode?: string;
  positionId?: string;
  quantity?: number;
}> {
  const { productId, productName, categoryName, productQuantity, placement } =
    args;
  const rawPosId =
    typeof placement.positionId === "string" ? placement.positionId.trim() : "";
  const rawShelfId =
    typeof placement.shelfId === "string" ? placement.shelfId.trim() : "";
  const prevPosId =
    typeof placement.previousPositionId === "string"
      ? placement.previousPositionId.trim()
      : "";
  const targetRow =
    typeof placement.rowNumber === "number" &&
    Number.isInteger(placement.rowNumber) &&
    placement.rowNumber >= 1 &&
    placement.rowNumber <= DEFAULT_ROWS_PER_COLUMN
      ? placement.rowNumber
      : null;

  // Explicit unassign: positionId is null/empty AND shelfId is empty.
  if (!rawPosId && !rawShelfId) {
    if (!prevPosId) return { changed: false };
    const prev = await tx.shelfPosition.findUnique({
      where: { id: prevPosId },
      include: { shelf: true },
    });
    if (prev && prev.productId === productId) {
      await tx.shelfPosition.update({
        where: { id: prev.id },
        data: { productId: null, quantity: 0 },
      });
      return {
        changed: true,
        shelfId: prev.shelfId,
        shelfCode: prev.shelf.shelfCode,
        positionId: prev.id,
        quantity: 0,
      };
    }
    return { changed: false };
  }

  let carriedQuantity = 0;

  // If moving from an existing column of this product to a different column, clear the previous slot.
  if (prevPosId && prevPosId !== rawPosId) {
    const prev = await tx.shelfPosition.findUnique({
      where: { id: prevPosId },
      select: { id: true, productId: true, quantity: true },
    });
    if (prev && prev.productId === productId) {
      carriedQuantity = prev.quantity;
      await tx.shelfPosition.update({
        where: { id: prev.id },
        data: { productId: null, quantity: 0 },
      });
    }
  }

  let updatedPos: {
    id: string;
    shelfId: string;
    positionCode: string;
    slotIndex: number;
    quantity: number;
    shelf: { shelfCode: string };
  };

  if (rawPosId === "__NEW_COLUMN__" || (!rawPosId && rawShelfId)) {
    if (!rawShelfId) {
      throw new ShelfPlacementError(
        "Select a shelf before adding a new column.",
        400,
      );
    }

    const shelf = await tx.shelf.findUnique({
      where: { id: rawShelfId },
      include: { positions: { orderBy: { slotIndex: "asc" } } },
    });
    if (!shelf) {
      throw new ShelfPlacementError("Selected shelf was not found.", 404);
    }
    if (shelf.positions.length >= MAX_COLUMNS_PER_SHELF) {
      throw new ShelfPlacementError(
        `${shelf.shelfCode} already has the maximum of ${MAX_COLUMNS_PER_SHELF} columns.`,
        400,
      );
    }

    const maxSlotIndex = shelf.positions.reduce(
      (max, p) => Math.max(max, p.slotIndex),
      -1,
    );
    const nextSlotIndex = maxSlotIndex + 1;
    const usedCodes = new Set(shelf.positions.map((p) => p.positionCode));
    let colNum = nextSlotIndex + 1;
    let positionCode = `COL-${String(colNum).padStart(2, "0")}`;
    while (usedCodes.has(positionCode)) {
      colNum += 1;
      positionCode = `COL-${String(colNum).padStart(2, "0")}`;
    }

    const defaultCap = 24;
    const initialQty =
      targetRow !== null
        ? unitsForTargetRows(targetRow, defaultCap, productQuantity)
        : carriedQuantity > 0
          ? Math.min(defaultCap, carriedQuantity)
          : Math.min(defaultCap, Math.max(0, productQuantity));

    updatedPos = await tx.shelfPosition.create({
      data: {
        shelfId: shelf.id,
        productId,
        positionCode,
        slotIndex: nextSlotIndex,
        quantity: initialQty,
        maximumCapacity: defaultCap,
        reorderLevel: 6,
      },
      include: { shelf: { select: { shelfCode: true } } },
    });
  } else {
    const existing = await tx.shelfPosition.findUnique({
      where: { id: rawPosId },
      include: {
        shelf: { select: { id: true, shelfCode: true } },
        product: { select: { id: true, name: true } },
      },
    });
    if (!existing) {
      throw new ShelfPlacementError("Selected shelf column was not found.", 404);
    }
    if (
      existing.productId !== null &&
      existing.productId !== productId &&
      existing.quantity > 0
    ) {
      throw new ShelfPlacementError(
        `Cannot place "${productName}" into ${existing.shelf.shelfCode}/${existing.positionCode} because ${existing.quantity} unit(s) of "${existing.product?.name ?? "another product"}" occupy this column. Choose an empty column or add a new column.`,
        409,
      );
    }

    let nextQty = existing.productId === productId ? existing.quantity : 0;
    if (targetRow !== null) {
      nextQty = unitsForTargetRows(
        targetRow,
        existing.maximumCapacity,
        productQuantity > 0 ? productQuantity : undefined,
      );
    } else if (nextQty === 0) {
      nextQty =
        carriedQuantity > 0
          ? Math.min(existing.maximumCapacity, carriedQuantity)
          : Math.min(existing.maximumCapacity, Math.max(0, productQuantity));
    }

    updatedPos = await tx.shelfPosition.update({
      where: { id: existing.id },
      data: {
        productId,
        quantity: nextQty,
      },
      include: { shelf: { select: { shelfCode: true } } },
    });
  }

  // Synchronize 3D object mapping for Digital Twin.
  const objName = `${updatedPos.shelf.shelfCode}_${updatedPos.positionCode}`;
  const assetEntry = resolveProductAsset(productName, categoryName);
  const asset = await tx.threeDAsset.findUnique({
    where: { assetKey: assetEntry.key },
    select: { id: true },
  });
  const fixture = findFixtureByCode(updatedPos.shelf.shelfCode);
  const coords = fixture
    ? shelfSlotWorldPosition(fixture, updatedPos.slotIndex)
    : ([0, 1, 0] as [number, number, number]);

  await tx.threeDObjectMapping.upsert({
    where: { objectName: objName },
    update: {
      linkedEntityType: "PRODUCT",
      linkedEntityId: productId.toString(),
      assetId: asset?.id ?? null,
      posX: coords[0],
      posY: coords[1],
      posZ: coords[2],
    },
    create: {
      objectName: objName,
      objectType: "PRODUCT_POSITION",
      linkedEntityType: "PRODUCT",
      linkedEntityId: productId.toString(),
      assetId: asset?.id ?? null,
      posX: coords[0],
      posY: coords[1],
      posZ: coords[2],
    },
  });

  return {
    changed: true,
    shelfId: updatedPos.shelfId,
    shelfCode: updatedPos.shelf.shelfCode,
    positionId: updatedPos.id,
    quantity: updatedPos.quantity,
  };
}
