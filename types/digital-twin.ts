// Shared domain types for the 3D Digital Twin Supermarket, Warehouse,
// Procurement, Batch/Expiry, Realtime Events, and Object Mapping layers.

import type { FixtureKind, Vec3 } from "@/lib/digital-twin/spatial-plan";

export type InventoryVisualState =
  | "normal"
  | "low"
  | "out"
  | "expired"
  | "reserved"
  | "restocking";

export type TwinViewMode = "realistic" | "inventory" | "heatmap";
export type TwinSceneScope = "supermarket" | "warehouse" | "combined";
export type GraphicsQuality = "low" | "balanced" | "high";

export interface TwinStoreSummary {
  id: string;
  name: string;
  address: string;
  location: string;
  status: string;
}

export interface TwinDepartmentNode {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  shelvesCount: number;
  productCount: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiredCount: number;
}

export interface TwinShelfPositionNode {
  id: string;
  shelfId: string;
  shelfCode: string;
  positionCode: string;
  objectName: string; // e.g. "SH-GRO-01_POS_01"
  slotIndex: number;
  quantity: number;
  maximumCapacity: number;
  reservedQuantity: number;
  warehouseQuantity: number;
  reorderLevel: number;
  visualState: InventoryVisualState;
  nearestExpiryDate: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string;
    categoryId: string | null;
    categoryName: string | null;
    price: number;
    costPrice: number;
    totalStock: number;
    assetKey: string;
    assetPath: string;
  } | null;
}

export interface TwinShelfNode {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  kind: FixtureKind;
  capacity: number;
  status: string;
  objectName: string;
  position: Vec3;
  rotationY: number;
  size: Vec3;
  tiers: number;
  slotsPerTier: number;
  totalUnits: number;
  productCount: number;
  lowStockCount: number;
  emptyPositions: number;
  restockNeeded: boolean;
  visualState: InventoryVisualState;
  positions: TwinShelfPositionNode[];
}

export interface TwinWarehousePositionNode {
  id: string;
  warehouseCode: string;
  zoneCode: string;
  rackCode: string;
  levelCode: string;
  positionCode: string;
  locationType: string;
  objectName: string;
  capacity: number;
  quantityOnHand: number;
  reservedQuantity: number;
  reorderLevel: number;
  visualState: InventoryVisualState;
  product: {
    id: string;
    name: string;
    barcode: string;
    categoryName: string | null;
    price: number;
  } | null;
}

export interface TwinWarehouseRackNode {
  zoneCode: string;
  rackCode: string;
  label: string;
  locationType: string;
  position: Vec3;
  size: Vec3;
  levels: number;
  positionsPerLevel: number;
  totalUnits: number;
  capacity: number;
  visualState: InventoryVisualState;
  positions: TwinWarehousePositionNode[];
}

export interface TwinObjectMappingDTO {
  id: string;
  objectName: string;
  objectType: string;
  linkedEntityType: string;
  linkedEntityId: string;
  assetPath: string | null;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface DigitalTwinSnapshot {
  initialized: boolean;
  generatedAt: string;
  store: TwinStoreSummary | null;
  departments: TwinDepartmentNode[];
  shelves: TwinShelfNode[];
  warehouseRacks: TwinWarehouseRackNode[];
  mappings: TwinObjectMappingDTO[];
  summary: {
    totalProducts: number;
    totalShelfUnits: number;
    totalWarehouseUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringSoonCount: number;
    expiredCount: number;
  };
}

export type TwinSelection =
  | { type: "department"; departmentCode: string }
  | { type: "shelf"; shelfId: string; shelfCode: string }
  | {
      type: "product";
      productId: string;
      positionId: string;
      shelfCode: string;
      objectName: string;
    }
  | {
      type: "warehouse_position";
      locationId: string;
      rackCode: string;
      objectName: string;
    }
  | null;

export interface TwinLocateResult {
  query: string;
  matches: Array<{
    productId: string;
    productName: string;
    barcode: string;
    categoryName: string | null;
    price: number;
    totalStock: number;
    locations: Array<{
      kind: "shelf" | "warehouse";
      id: string;
      code: string;
      label: string;
      departmentOrZone: string;
      quantity: number;
      cameraPosition: Vec3;
      cameraTarget: Vec3;
      selection: NonNullable<TwinSelection>;
    }>;
  }>;
}

export interface RealtimeInventoryEvent {
  type:
    | "connected"
    | "sale_completed"
    | "sale_cancelled"
    | "stock_adjusted"
    | "stock_transferred"
    | "goods_received"
    | "shelf_updated"
    | "twin_initialized";
  timestamp: string;
  productId?: string;
  shelfId?: string;
  shelfCode?: string;
  positionId?: string;
  warehouseLocationId?: string;
  delta?: number;
  summary?: string;
}
