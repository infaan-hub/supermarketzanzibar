// Spatial architectural specification for the Supermarket Zanzibar 3D Digital Twin.
//
// Coordinate system: Right-handed Y-up, 1 unit = 1 meter, floor at y = 0.
// Retail hall spans X: [-19, +19] (38m), Z: [-14, +14] (28m), height 5.2m.
// Back-of-house annex (Warehouse, Receiving, Staff) spans X: [-19, +19], Z: [-30, -14], height 6.4m.

export type Vec3 = [number, number, number];

export interface Bounds2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type AreaCategory = "retail" | "customer" | "checkout" | "warehouse" | "operations";

export interface PhysicalAreaSpec {
  id: string;
  code: string;
  name: string;
  category: AreaCategory;
  description: string;
  bounds: Bounds2D;
  accentColor: string;
  cameraPosition: Vec3;
  cameraTarget: Vec3;
  aisleNumber?: string;
}

export type FixtureKind =
  | "gondola"
  | "refrigerator"
  | "freezer"
  | "bakery_case"
  | "produce_island"
  | "cosmetics_shelf"
  | "electronics_case"
  | "meat_counter"
  | "checkout";

export interface ShelfFixtureSpec {
  code: string;
  name: string;
  departmentCode: string;
  kind: FixtureKind;
  position: Vec3;
  rotationY: number;
  size: Vec3; // [width, height, depth] in meters
  tiers: number;
  slotsPerTier: number;
  capacity: number;
  assetKey: string;
  cameraOffset: Vec3;
}

export interface WarehouseRackSpec {
  zoneCode: string;
  rackCode: string;
  label: string;
  position: Vec3;
  rotationY: number;
  size: Vec3;
  levels: number;
  positionsPerLevel: number;
  locationType: "ambient" | "chilled" | "bulk" | "receiving";
}

export interface CameraPresetSpec {
  id: string;
  label: string;
  position: Vec3;
  target: Vec3;
}

export const BUILDING_DIMENSIONS = {
  retail: {
    width: 38,
    depth: 28,
    height: 5.2,
    bounds: { minX: -19, maxX: 19, minZ: -14, maxZ: 14 } satisfies Bounds2D,
  },
  annex: {
    width: 38,
    depth: 16,
    height: 6.4,
    bounds: { minX: -19, maxX: 19, minZ: -30, maxZ: -14 } satisfies Bounds2D,
  },
  totalBounds: { minX: -19, maxX: 19, minZ: -30, maxZ: 14 } satisfies Bounds2D,
  cameraLimits: {
    minDistance: 2.2,
    maxDistance: 56,
    minPolarAngle: 0.12,
    maxPolarAngle: Math.PI / 2 - 0.04,
  },
} as const;

/** All 18 required physical areas of the Supermarket Zanzibar complex. */
export const PHYSICAL_AREAS: PhysicalAreaSpec[] = [
  {
    id: "area-entrance",
    code: "ENT",
    name: "Main Entrance",
    category: "customer",
    description: "Automated glass vestibule and welcome mat.",
    bounds: { minX: -4, maxX: 4, minZ: 11.2, maxZ: 14 },
    accentColor: "#0f766e",
    cameraPosition: [0, 4.2, 20],
    cameraTarget: [0, 1.5, 11],
  },
  {
    id: "area-reception",
    code: "REC",
    name: "Customer Reception",
    category: "customer",
    description: "Store directory kiosk and seasonal promotions display.",
    bounds: { minX: -10, maxX: -4.4, minZ: 10.6, maxZ: 13.6 },
    accentColor: "#0d9488",
    cameraPosition: [-7.2, 4.5, 16.5],
    cameraTarget: [-7.2, 1.2, 11.8],
  },
  {
    id: "area-carts",
    code: "CRT",
    name: "Shopping Cart Collection",
    category: "customer",
    description: "Nested shopping cart corral and hand-basket stacks.",
    bounds: { minX: 4.4, maxX: 11.5, minZ: 10.6, maxZ: 13.6 },
    accentColor: "#0284c7",
    cameraPosition: [8.5, 4.4, 16.5],
    cameraTarget: [8, 1.0, 11.8],
  },
  {
    id: "area-grocery",
    code: "GRO",
    name: "Grocery Department",
    category: "retail",
    aisleNumber: "Aisles 1–3",
    description: "Staples, rice, flour, cooking oils, pasta, cereals, and canned foods.",
    bounds: { minX: -12, maxX: -2.2, minZ: -4.2, maxZ: 4.8 },
    accentColor: "#15803d",
    cameraPosition: [-7.2, 6.2, 9.8],
    cameraTarget: [-7.2, 1.1, 0.3],
  },
  {
    id: "area-beverages",
    code: "BEV",
    name: "Beverage Department",
    category: "retail",
    aisleNumber: "Aisles 4–5",
    description: "Soft drinks, mineral water, juices, energy drinks, and chilled coolers.",
    bounds: { minX: -1.4, maxX: 8.2, minZ: -4.2, maxZ: 4.8 },
    accentColor: "#0e7490",
    cameraPosition: [3.4, 6.2, 9.8],
    cameraTarget: [3.4, 1.1, 0.3],
  },
  {
    id: "area-produce",
    code: "PRO",
    name: "Fruits & Vegetables",
    category: "retail",
    aisleNumber: "Fresh East",
    description: "Fresh Zanzibar produce islands with digital weighing scales.",
    bounds: { minX: 9.8, maxX: 18.2, minZ: 0.4, maxZ: 9.2 },
    accentColor: "#16a34a",
    cameraPosition: [13.5, 6.0, 12.8],
    cameraTarget: [14.0, 1.0, 4.8],
  },
  {
    id: "area-dairy",
    code: "DAI",
    name: "Dairy Products",
    category: "retail",
    aisleNumber: "Chilled East",
    description: "Refrigerated milk, yogurt, butter, cheese, and fresh eggs.",
    bounds: { minX: 9.8, maxX: 18.2, minZ: -9.4, maxZ: -0.6 },
    accentColor: "#0284c7",
    cameraPosition: [8.0, 5.2, -5.0],
    cameraTarget: [15.5, 1.3, -5.0],
  },
  {
    id: "area-frozen",
    code: "FRZ",
    name: "Frozen Foods",
    category: "retail",
    aisleNumber: "Aisle 6",
    description: "Glass-top freezers and upright frozen meals, poultry, and ice cream.",
    bounds: { minX: -1.4, maxX: 8.4, minZ: -9.8, maxZ: -5.2 },
    accentColor: "#0369a1",
    cameraPosition: [3.5, 5.5, -1.5],
    cameraTarget: [3.5, 1.0, -7.5],
  },
  {
    id: "area-bakery",
    code: "BAK",
    name: "Bakery",
    category: "retail",
    aisleNumber: "Fresh West",
    description: "Daily fresh loaves, pastries, cakes, and warm display cases.",
    bounds: { minX: -18.2, maxX: -13.2, minZ: 0.4, maxZ: 8.6 },
    accentColor: "#d97706",
    cameraPosition: [-10.0, 5.0, 4.5],
    cameraTarget: [-16.0, 1.2, 4.5],
  },
  {
    id: "area-meat",
    code: "MEA",
    name: "Meat & Fish",
    category: "retail",
    aisleNumber: "Butcher West",
    description: "Chilled halal butcher and fresh Indian Ocean seafood counter.",
    bounds: { minX: -18.2, maxX: -13.2, minZ: -9.4, maxZ: -0.8 },
    accentColor: "#dc2626",
    cameraPosition: [-10.0, 5.0, -5.0],
    cameraTarget: [-16.0, 1.2, -5.0],
  },
  {
    id: "area-cosmetics",
    code: "COS",
    name: "Cosmetics & Personal Care",
    category: "retail",
    aisleNumber: "Aisle 7",
    description: "Soaps, shampoos, oral care, lotions, and grooming essentials.",
    bounds: { minX: -12, maxX: -2.2, minZ: -9.8, maxZ: -5.2 },
    accentColor: "#db2777",
    cameraPosition: [-7.2, 5.5, -1.5],
    cameraTarget: [-7.2, 1.1, -7.5],
  },
  {
    id: "area-household",
    code: "HSH",
    name: "Household Products",
    category: "retail",
    aisleNumber: "North West",
    description: "Detergents, cleaning supplies, paper goods, and kitchenware.",
    bounds: { minX: -14.5, maxX: -4.2, minZ: -13.4, maxZ: -10.4 },
    accentColor: "#4f46e5",
    cameraPosition: [-9.2, 4.8, -7.2],
    cameraTarget: [-9.2, 1.2, -12.0],
  },
  {
    id: "area-electronics",
    code: "ELC",
    name: "Electronics & Accessories",
    category: "retail",
    aisleNumber: "North East",
    description: "Small appliances, chargers, batteries, and secured display cases.",
    bounds: { minX: -3.2, maxX: 7.5, minZ: -13.4, maxZ: -10.4 },
    accentColor: "#0f766e",
    cameraPosition: [2.2, 4.8, -7.2],
    cameraTarget: [2.2, 1.2, -12.0],
  },
  {
    id: "area-checkout",
    code: "CHK",
    name: "Checkout Counters",
    category: "checkout",
    description: "4 POS checkout lanes with barcode scanners and belt conveyors.",
    bounds: { minX: -10.2, maxX: 8.6, minZ: 6.2, maxZ: 9.8 },
    accentColor: "#14b8a6",
    cameraPosition: [-0.8, 5.8, 13.8],
    cameraTarget: [-0.8, 1.0, 8.0],
  },
  {
    id: "area-service",
    code: "SVC",
    name: "Customer Service Desk",
    category: "customer",
    description: "Returns, loyalty enrollment, receipts, and store assistance.",
    bounds: { minX: -18.2, maxX: -11.2, minZ: 9.8, maxZ: 13.4 },
    accentColor: "#0891b2",
    cameraPosition: [-14.5, 4.6, 16.5],
    cameraTarget: [-14.8, 1.2, 11.4],
  },
  {
    id: "area-warehouse",
    code: "WH",
    name: "Storage Warehouse",
    category: "warehouse",
    description: "High-bay industrial storage racks (Zones A–D) linked to stock inventory.",
    bounds: { minX: -9.8, maxX: 9.8, minZ: -29.2, maxZ: -14.6 },
    accentColor: "#ea580c",
    cameraPosition: [0, 10.5, -9.5],
    cameraTarget: [0, 1.8, -22],
  },
  {
    id: "area-receiving",
    code: "RCV",
    name: "Receiving & Delivery Area",
    category: "warehouse",
    description: "Loading bay, goods-received inspection dock, and pallet staging.",
    bounds: { minX: 10.4, maxX: 18.4, minZ: -29.2, maxZ: -14.6 },
    accentColor: "#b45309",
    cameraPosition: [14.5, 8.0, -11.0],
    cameraTarget: [14.5, 1.4, -22.5],
  },
  {
    id: "area-staff",
    code: "STF",
    name: "Staff-Only Areas",
    category: "operations",
    description: "Store manager office, POS server cabinet, break room, and emergency exit.",
    bounds: { minX: -18.4, maxX: -10.4, minZ: -29.2, maxZ: -14.6 },
    accentColor: "#475569",
    cameraPosition: [-14.5, 7.5, -11.0],
    cameraTarget: [-14.5, 1.4, -22.0],
  },
];

/** Physical shelf, chiller, freezer, and counter fixtures with deterministic IDs. */
export const SHELF_FIXTURES: ShelfFixtureSpec[] = [
  // Grocery (3 parallel gondolas, 3.0m center-to-center => 2.1m clear aisle)
  {
    code: "SH-GRO-01",
    name: "Grocery Aisle 1 (Staples & Grains)",
    departmentCode: "GRO",
    kind: "gondola",
    position: [-10.2, 0, 0.3],
    rotationY: 0,
    size: [1.0, 2.1, 7.2],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 120,
    assetKey: "furniture/shelf",
    cameraOffset: [4.2, 2.4, 3.2],
  },
  {
    code: "SH-GRO-02",
    name: "Grocery Aisle 2 (Oils & Sauces)",
    departmentCode: "GRO",
    kind: "gondola",
    position: [-6.8, 0, 0.3],
    rotationY: 0,
    size: [1.0, 2.1, 7.2],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 120,
    assetKey: "furniture/shelf",
    cameraOffset: [4.2, 2.4, 3.2],
  },
  {
    code: "SH-GRO-03",
    name: "Grocery Aisle 3 (Cereals & Canned)",
    departmentCode: "GRO",
    kind: "gondola",
    position: [-3.4, 0, 0.3],
    rotationY: 0,
    size: [1.0, 2.1, 7.2],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 120,
    assetKey: "furniture/shelf",
    cameraOffset: [4.2, 2.4, 3.2],
  },

  // Beverages (2 gondolas + 1 chilled cooler)
  {
    code: "SH-BEV-01",
    name: "Beverages Aisle 4 (Soft Drinks & Juices)",
    departmentCode: "BEV",
    kind: "gondola",
    position: [0.4, 0, 0.3],
    rotationY: 0,
    size: [1.0, 2.1, 7.2],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 140,
    assetKey: "furniture/shelf",
    cameraOffset: [4.2, 2.4, 3.2],
  },
  {
    code: "SH-BEV-02",
    name: "Beverages Aisle 5 (Water & Multipacks)",
    departmentCode: "BEV",
    kind: "gondola",
    position: [3.8, 0, 0.3],
    rotationY: 0,
    size: [1.0, 2.1, 7.2],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 140,
    assetKey: "furniture/shelf",
    cameraOffset: [4.2, 2.4, 3.2],
  },
  {
    code: "FR-BEV-01",
    name: "Beverage Chiller Cooler",
    departmentCode: "BEV",
    kind: "refrigerator",
    position: [7.0, 0, 0.3],
    rotationY: 0,
    size: [1.1, 2.2, 6.4],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 96,
    assetKey: "furniture/refrigerator",
    cameraOffset: [-4.4, 2.2, 2.8],
  },

  // Produce Islands
  {
    code: "SH-PRO-01",
    name: "Fresh Fruits Island",
    departmentCode: "PRO",
    kind: "produce_island",
    position: [13.5, 0, 6.4],
    rotationY: 0,
    size: [4.4, 1.15, 2.0],
    tiers: 2,
    slotsPerTier: 3,
    capacity: 80,
    assetKey: "furniture/shelf",
    cameraOffset: [0, 3.4, 4.6],
  },
  {
    code: "SH-PRO-02",
    name: "Fresh Vegetables Island",
    departmentCode: "PRO",
    kind: "produce_island",
    position: [13.5, 0, 2.6],
    rotationY: 0,
    size: [4.4, 1.15, 2.0],
    tiers: 2,
    slotsPerTier: 3,
    capacity: 80,
    assetKey: "furniture/shelf",
    cameraOffset: [0, 3.4, 4.6],
  },

  // Dairy Multi-Deck Chillers (East wall)
  {
    code: "FR-DAI-01",
    name: "Dairy Chiller 1 (Milk & Yogurt)",
    departmentCode: "DAI",
    kind: "refrigerator",
    position: [17.4, 0, -2.8],
    rotationY: -Math.PI / 2,
    size: [3.6, 2.2, 1.0],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 96,
    assetKey: "furniture/refrigerator",
    cameraOffset: [-4.8, 2.2, 0.8],
  },
  {
    code: "FR-DAI-02",
    name: "Dairy Chiller 2 (Butter, Cheese & Eggs)",
    departmentCode: "DAI",
    kind: "refrigerator",
    position: [17.4, 0, -7.2],
    rotationY: -Math.PI / 2,
    size: [3.6, 2.2, 1.0],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 96,
    assetKey: "furniture/refrigerator",
    cameraOffset: [-4.8, 2.2, 0.8],
  },

  // Frozen Foods
  {
    code: "FR-FRZ-01",
    name: "Frozen Island A (Meals & Vegetables)",
    departmentCode: "FRZ",
    kind: "freezer",
    position: [1.2, 0, -7.5],
    rotationY: 0,
    size: [4.2, 1.1, 1.8],
    tiers: 2,
    slotsPerTier: 3,
    capacity: 90,
    assetKey: "furniture/refrigerator",
    cameraOffset: [0, 3.6, 4.6],
  },
  {
    code: "FR-FRZ-02",
    name: "Frozen Island B (Ice Cream & Poultry)",
    departmentCode: "FRZ",
    kind: "freezer",
    position: [6.2, 0, -7.5],
    rotationY: 0,
    size: [3.8, 1.1, 1.8],
    tiers: 2,
    slotsPerTier: 3,
    capacity: 90,
    assetKey: "furniture/refrigerator",
    cameraOffset: [0, 3.6, 4.6],
  },

  // Bakery (West wall front)
  {
    code: "SH-BAK-01",
    name: "Bakery Counter (Bread & Pastries)",
    departmentCode: "BAK",
    kind: "bakery_case",
    position: [-17.2, 0, 4.4],
    rotationY: Math.PI / 2,
    size: [5.2, 1.75, 1.2],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 96,
    assetKey: "departments/bakery",
    cameraOffset: [5.0, 2.5, 1.0],
  },

  // Meat & Fish (West wall back)
  {
    code: "FR-MEA-01",
    name: "Meat & Seafood Chilled Counter",
    departmentCode: "MEA",
    kind: "meat_counter",
    position: [-17.2, 0, -5.0],
    rotationY: Math.PI / 2,
    size: [6.0, 1.4, 1.3],
    tiers: 2,
    slotsPerTier: 3,
    capacity: 70,
    assetKey: "furniture/refrigerator",
    cameraOffset: [5.0, 2.5, 1.0],
  },

  // Cosmetics & Personal Care
  {
    code: "SH-COS-01",
    name: "Personal Care Gondola A",
    departmentCode: "COS",
    kind: "cosmetics_shelf",
    position: [-9.2, 0, -7.5],
    rotationY: 0,
    size: [4.2, 1.95, 1.0],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 110,
    assetKey: "departments/cosmetics",
    cameraOffset: [0, 2.6, 4.6],
  },
  {
    code: "SH-COS-02",
    name: "Cosmetics & Grooming Gondola B",
    departmentCode: "COS",
    kind: "cosmetics_shelf",
    position: [-4.4, 0, -7.5],
    rotationY: 0,
    size: [3.8, 1.95, 1.0],
    tiers: 4,
    slotsPerTier: 3,
    capacity: 110,
    assetKey: "departments/cosmetics",
    cameraOffset: [0, 2.6, 4.6],
  },

  // Household & Electronics along North Partition Wall
  {
    code: "SH-HSH-01",
    name: "Household Cleaning & Paper Wall",
    departmentCode: "HSH",
    kind: "gondola",
    position: [-9.4, 0, -12.6],
    rotationY: 0,
    size: [8.4, 2.2, 0.9],
    tiers: 4,
    slotsPerTier: 4,
    capacity: 140,
    assetKey: "furniture/shelf",
    cameraOffset: [0, 2.6, 5.2],
  },
  {
    code: "SH-ELC-01",
    name: "Electronics & Accessories Showcase",
    departmentCode: "ELC",
    kind: "electronics_case",
    position: [2.2, 0, -12.6],
    rotationY: 0,
    size: [7.6, 2.0, 0.9],
    tiers: 4,
    slotsPerTier: 4,
    capacity: 96,
    assetKey: "departments/electronics",
    cameraOffset: [0, 2.6, 5.2],
  },
];

/** 4 POS checkout lanes along the south retail frontage. */
export const CHECKOUT_LANES: Array<{
  code: string;
  label: string;
  position: Vec3;
  size: Vec3;
}> = [
  { code: "CHK-01", label: "Lane 1", position: [-7.2, 0, 8.0], size: [1.5, 1.05, 2.8] },
  { code: "CHK-02", label: "Lane 2", position: [-2.8, 0, 8.0], size: [1.5, 1.05, 2.8] },
  { code: "CHK-03", label: "Lane 3", position: [1.6, 0, 8.0], size: [1.5, 1.05, 2.8] },
  { code: "CHK-04", label: "Lane 4 (Express)", position: [6.0, 0, 8.0], size: [1.5, 1.05, 2.8] },
];

/** Back-of-house industrial warehouse racks (Zones A–D). */
export const WAREHOUSE_RACKS: WarehouseRackSpec[] = [
  {
    zoneCode: "Zone_A",
    rackCode: "Rack_A01",
    label: "Zone A · Rack A01 (Dry Grocery Bulk)",
    position: [-6.8, 0, -18.2],
    rotationY: 0,
    size: [4.6, 4.2, 1.2],
    levels: 3,
    positionsPerLevel: 3,
    locationType: "ambient",
  },
  {
    zoneCode: "Zone_A",
    rackCode: "Rack_A02",
    label: "Zone A · Rack A02 (Staples & Grains)",
    position: [-6.8, 0, -24.0],
    rotationY: 0,
    size: [4.6, 4.2, 1.2],
    levels: 3,
    positionsPerLevel: 3,
    locationType: "ambient",
  },
  {
    zoneCode: "Zone_B",
    rackCode: "Rack_B01",
    label: "Zone B · Rack B01 (Beverage Pallets)",
    position: [0.0, 0, -18.2],
    rotationY: 0,
    size: [4.6, 4.2, 1.2],
    levels: 3,
    positionsPerLevel: 3,
    locationType: "bulk",
  },
  {
    zoneCode: "Zone_B",
    rackCode: "Rack_B02",
    label: "Zone B · Rack B02 (Household & Paper)",
    position: [0.0, 0, -24.0],
    rotationY: 0,
    size: [4.6, 4.2, 1.2],
    levels: 3,
    positionsPerLevel: 3,
    locationType: "bulk",
  },
  {
    zoneCode: "Zone_C",
    rackCode: "Rack_C01",
    label: "Zone C · Rack C01 (Chilled & Cold Storage)",
    position: [6.8, 0, -18.2],
    rotationY: 0,
    size: [4.6, 4.2, 1.2],
    levels: 3,
    positionsPerLevel: 3,
    locationType: "chilled",
  },
  {
    zoneCode: "Zone_C",
    rackCode: "Rack_C02",
    label: "Zone C · Rack C02 (Personal Care & High-Value)",
    position: [6.8, 0, -24.0],
    rotationY: 0,
    size: [4.6, 4.2, 1.2],
    levels: 3,
    positionsPerLevel: 3,
    locationType: "ambient",
  },
  {
    zoneCode: "Zone_D",
    rackCode: "Rack_D01",
    label: "Zone D · Receiving Staging Bay",
    position: [14.2, 0, -18.5],
    rotationY: 0,
    size: [4.2, 3.6, 1.2],
    levels: 2,
    positionsPerLevel: 3,
    locationType: "receiving",
  },
  {
    zoneCode: "Zone_D",
    rackCode: "Rack_D02",
    label: "Zone D · Dispatch & Returns Rack",
    position: [14.2, 0, -24.5],
    rotationY: 0,
    size: [4.2, 3.6, 1.2],
    levels: 2,
    positionsPerLevel: 3,
    locationType: "receiving",
  },
];

export const CAMERA_PRESETS: Record<string, CameraPresetSpec> = {
  overview: {
    id: "overview",
    label: "Store Overview",
    position: [22, 18, 24],
    target: [0, 0.8, 0],
  },
  topdown: {
    id: "topdown",
    label: "Top-Down Floorplan",
    position: [0, 38, 0.01],
    target: [0, 0, -3],
  },
  entrance: {
    id: "entrance",
    label: "Main Entrance",
    position: [0, 3.6, 19.5],
    target: [0, 1.4, 4],
  },
  checkout: {
    id: "checkout",
    label: "Checkout Lanes",
    position: [-1.0, 5.2, 14.0],
    target: [-1.0, 1.0, 7.5],
  },
  warehouse: {
    id: "warehouse",
    label: "Warehouse Overview",
    position: [16, 13.5, -10.0],
    target: [2, 1.8, -21.5],
  },
};

export function findAreaByCode(code: string): PhysicalAreaSpec | undefined {
  return PHYSICAL_AREAS.find(
    (area) => area.code.toLowerCase() === code.trim().toLowerCase(),
  );
}

export function findFixtureByCode(code: string): ShelfFixtureSpec | undefined {
  return SHELF_FIXTURES.find(
    (fixture) => fixture.code.toLowerCase() === code.trim().toLowerCase(),
  );
}

export function findRackByCode(code: string): WarehouseRackSpec | undefined {
  return WAREHOUSE_RACKS.find(
    (rack) => rack.rackCode.toLowerCase() === code.trim().toLowerCase(),
  );
}

/** Standard vertical rows per single-product shelf column (4 rows = 1 product). */
export const ROWS_PER_COLUMN = 4;

export interface ShelfSlotLocalLayout {
  /** Column index on this shelf (1 column = 1 product across 4 vertical rows). */
  columnIndex: number;
  /** Column index along this specific aisle face (0..columnsOnSide - 1). */
  sideColumnIndex: number;
  /** Total columns laid out along this aisle face (expands dynamically when columns are added). */
  columnsOnSide: number;
  /** Allocated physical width of this vertical column in meters. */
  columnWidth: number;
  /** Number of rows in this column (always 4 rows for 1 product). */
  rowCount: number;
  /** Local positions [x, y, z] for all 4 rows (Row 1 bottom -> Row 4 top) in this column. */
  rowLocalPositions: Vec3[];
  /** Local position [x, y, z] of the Product Name Header Sign mounted ON TOP of this column. */
  headerLocalPosition: Vec3;
  /** Eye-level anchor [x, y, z] of the column (used for camera framing & slot focus). */
  localPosition: Vec3;
  /** Local Y rotation so the product column & top header face outward into the aisle. */
  localRotationY: number;
  /** Forward presentation tilt in radians (e.g. 18° = 0.314 rad on tilted produce timber crates). */
  tiltX: number;
  /** Unit outward normal [nx, 0, nz] in shelf-local coordinates pointing into the shopper aisle. */
  localNormal: Vec3;
  /** Primary eye-level ESL position mounted on the front lip of this column. */
  eslLocalPosition: Vec3;
  /** ESL positions across each physical shelf tier inside this column. */
  eslLocalPositions: Vec3[];
  /** Which side of a double-sided gondola this column belongs to (+1 = +X/+Z front, -1 = -X back). */
  sideSign: 1 | -1;
  tier: number;
  slotInTier: number;
  isDoubleSided: boolean;
}

/** Realistic number of individual hinged glass doors for a chiller/refrigerator span. */
export function chillerDoorCountForFixture(
  fixture: Pick<ShelfFixtureSpec, "size">,
): number {
  const [w, , d] = fixture.size;
  const span = Math.max(w, d) - 0.16;
  return Math.max(2, Math.min(8, Math.round(span / 0.88)));
}

/** Map a column slot index on a chiller to the specific hinged door index covering it. */
export function shelfSlotDoorIndex(
  fixture: Pick<ShelfFixtureSpec, "size" | "slotsPerTier" | "tiers" | "kind">,
  slotIndex: number,
  totalColumnsOnShelf?: number,
): number {
  const doorCount = chillerDoorCountForFixture(fixture);
  const [w, , d] = fixture.size;
  const isZLong = d >= w;
  const span = (isZLong ? d : w) - 0.16;
  const layout = shelfSlotLocalLayout(fixture, slotIndex, totalColumnsOnShelf);
  const alongDoorAxis = isZLong ? layout.localPosition[2] : layout.localPosition[0];
  const normalized = (alongDoorAxis + span / 2) / Math.max(0.01, span);
  return Math.max(0, Math.min(doorCount - 1, Math.floor(normalized * doorCount)));
}

/**
 * Deterministic vertical-column layout for a shelf fixture:
 * - Each `slotIndex` owns ONE vertical column spanning 4 rows for 1 single product
 *   (no mixing different products vertically in the same column).
 * - Double-sided Z-long gondolas alternate columns across `+X` (even) and `-X` (odd)
 *   aisle faces; single-sided wall/island fixtures place columns side-by-side along `+Z`.
 * - Passing `totalColumnsOnShelf` dynamically scales column spacing when overflow
 *   columns are added to a shelf.
 */
export function shelfSlotLocalLayout(
  fixture: Pick<ShelfFixtureSpec, "size" | "tiers" | "slotsPerTier" | "kind">,
  slotIndex: number,
  totalColumnsOnShelf?: number,
): ShelfSlotLocalLayout {
  const [w, h, d] = fixture.size;
  const physicalTiers = Math.max(1, fixture.tiers);
  const baseColsPerSide = Math.max(1, fixture.slotsPerTier);
  const isZLong = d >= w;
  const isDoubleSided =
    isZLong && fixture.kind !== "refrigerator" && fixture.kind !== "meat_counter";
  const isProduce = fixture.kind === "produce_island";
  // Authentic 18-degree tilted timber produce crate slant (0.314 rad)
  const tiltX = isProduce ? 0.314 : 0;

  const sideSign: 1 | -1 = isZLong
    ? isDoubleSided
      ? slotIndex % 2 === 0
        ? 1
        : -1
      : -1
    : 1;

  const sideColumnIndex = isDoubleSided
    ? Math.floor(slotIndex / 2)
    : slotIndex;

  const totalCols = Math.max(
    isDoubleSided ? baseColsPerSide * 2 : baseColsPerSide,
    totalColumnsOnShelf ?? slotIndex + 1,
  );
  const columnsOnSide = isDoubleSided
    ? Math.max(baseColsPerSide, Math.ceil(totalCols / 2), sideColumnIndex + 1)
    : Math.max(baseColsPerSide, totalCols, sideColumnIndex + 1);

  const usableSpan = (isZLong ? d : w) * 0.86;
  const columnWidth = usableSpan / Math.max(1, columnsOnSide);
  const along =
    columnsOnSide > 1
      ? -usableSpan / 2 + (sideColumnIndex + 0.5) * columnWidth
      : 0;

  const deckCenterYForTier = (t: number) =>
    0.26 + t * ((h - 0.48) / physicalTiers);
  const deckTopYForTier = (t: number) => deckCenterYForTier(t) + 0.024;

  // Build exactly 4 row positions per column (Row 1 bottom -> Row 4 top):
  // - On 4-tier fixtures (all gondolas, chillers, cosmetics, bakery, electronics): 1 row per tier.
  // - On 2-tier low counters (produce islands, freezers, meat counter): 2 stepped rows per tier = 4 rows.
  const rowLocalPositions: Vec3[] = [];
  const eslLocalPositions: Vec3[] = [];

  if (isZLong) {
    const frontFace = sideSign * (w * 0.34);
    const eslX = sideSign * (w * 0.488);

    for (let r = 0; r < ROWS_PER_COLUMN; r += 1) {
      const tierIdx = Math.min(physicalTiers - 1, r);
      rowLocalPositions.push([frontFace, deckTopYForTier(tierIdx), along]);
    }
    for (let t = 0; t < physicalTiers; t += 1) {
      eslLocalPositions.push([eslX, deckCenterYForTier(t) - 0.005, along]);
    }

    const eyeTier = Math.min(physicalTiers - 1, 2);
    const headerLocalPosition: Vec3 = [
      sideSign * (w * 0.46),
      h + 0.09,
      along,
    ];

    return {
      columnIndex: slotIndex,
      sideColumnIndex,
      columnsOnSide,
      columnWidth,
      rowCount: ROWS_PER_COLUMN,
      rowLocalPositions,
      headerLocalPosition,
      localPosition: [frontFace, deckTopYForTier(Math.min(physicalTiers - 1, 1)), along],
      localRotationY: sideSign > 0 ? Math.PI / 2 : -Math.PI / 2,
      tiltX: 0,
      localNormal: [sideSign, 0, 0],
      eslLocalPosition: eslLocalPositions[eyeTier] ?? eslLocalPositions[0],
      eslLocalPositions,
      sideSign,
      tier: eyeTier,
      slotInTier: sideColumnIndex,
      isDoubleSided,
    };
  }

  const eslZ = d * 0.488;
  const produceLipDrop = isProduce ? Math.sin(tiltX) * (d * 0.46) : 0;

  if (physicalTiers >= ROWS_PER_COLUMN) {
    const frontFace = isProduce ? d * 0.18 : d * 0.32;
    for (let r = 0; r < ROWS_PER_COLUMN; r += 1) {
      const restY = isProduce
        ? deckTopYForTier(r) - Math.sin(tiltX) * (frontFace * 0.85) + 0.025
        : deckTopYForTier(r);
      rowLocalPositions.push([along, restY, frontFace]);
    }
  } else {
    // Low 2-tier islands/freezers/counters: 2 stepped front/rear rows on each tier = 4 rows for 1 product
    for (let r = 0; r < ROWS_PER_COLUMN; r += 1) {
      const tierIdx = Math.min(physicalTiers - 1, Math.floor(r / 2));
      const isUpperBackSubRow = r % 2 === 1;
      const zPos = isUpperBackSubRow ? -d * 0.12 : d * 0.24;
      const restY = isProduce
        ? deckTopYForTier(tierIdx) - Math.sin(tiltX) * (zPos * 0.85) + 0.025
        : deckTopYForTier(tierIdx);
      rowLocalPositions.push([along, restY, zPos]);
    }
  }

  for (let t = 0; t < physicalTiers; t += 1) {
    eslLocalPositions.push([
      along,
      deckCenterYForTier(t) - produceLipDrop - 0.004,
      eslZ,
    ]);
  }

  const eyeTier = Math.min(physicalTiers - 1, physicalTiers >= 3 ? 2 : physicalTiers - 1);
  const headerLocalPosition: Vec3 = [
    along,
    isProduce ? h + 0.24 : h + 0.09,
    d * 0.46,
  ];

  return {
    columnIndex: slotIndex,
    sideColumnIndex,
    columnsOnSide,
    columnWidth,
    rowCount: ROWS_PER_COLUMN,
    rowLocalPositions,
    headerLocalPosition,
    localPosition:
      rowLocalPositions[Math.min(rowLocalPositions.length - 1, 1)] ??
      rowLocalPositions[0],
    localRotationY: 0,
    tiltX,
    localNormal: [0, 0, 1],
    eslLocalPosition: eslLocalPositions[eyeTier] ?? eslLocalPositions[0],
    eslLocalPositions,
    sideSign: 1,
    tier: eyeTier,
    slotInTier: sideColumnIndex,
    isDoubleSided: false,
  };
}

/** Transform a local point on a fixture into world coordinates. */
export function fixtureLocalToWorld(
  fixture: Pick<ShelfFixtureSpec, "position" | "rotationY">,
  local: Vec3,
): Vec3 {
  const [fx, fy, fz] = fixture.position;
  const [lx, ly, lz] = local;
  const cos = Math.cos(fixture.rotationY);
  const sin = Math.sin(fixture.rotationY);
  return [
    fx + lx * cos + lz * sin,
    fy + ly,
    fz - lx * sin + lz * cos,
  ];
}

/** Transform a local horizontal normal into a unit world normal. */
export function fixtureLocalNormalToWorld(
  rotationY: number,
  localNormal: Vec3,
): Vec3 {
  const [nx, , nz] = localNormal;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [nx * cos + nz * sin, 0, -nx * sin + nz * cos];
}

/** Deterministic world coordinate of a column on a shelf fixture. */
export function shelfSlotWorldPosition(
  fixture: ShelfFixtureSpec,
  positionIndex: number,
  totalColumnsOnShelf?: number,
): Vec3 {
  const layout = shelfSlotLocalLayout(fixture, positionIndex, totalColumnsOnShelf);
  return fixtureLocalToWorld(fixture, layout.localPosition);
}

/**
 * Aisle-side aware camera framing for a specific 4-row vertical product column.
 * Frames all 4 rows and the top-of-column product name sign cleanly from the
 * column's outward aisle normal without clipping into an opposite shelf.
 */
export function shelfSlotWorldCamera(
  fixture: ShelfFixtureSpec,
  positionIndex: number,
  distance = 2.25,
  totalColumnsOnShelf?: number,
): { position: Vec3; target: Vec3; worldNormal: Vec3 } {
  const layout = shelfSlotLocalLayout(fixture, positionIndex, totalColumnsOnShelf);
  const colMidPos = fixtureLocalToWorld(fixture, layout.localPosition);
  const worldNormal = fixtureLocalNormalToWorld(
    fixture.rotationY,
    layout.localNormal,
  );
  const targetY = Math.min(fixture.size[1] * 0.62, Math.max(0.85, colMidPos[1] + 0.32));
  const target: Vec3 = [colMidPos[0], targetY, colMidPos[2]];
  const camY = Math.min(2.1, Math.max(1.38, targetY + 0.28));

  // Ensure camera lands cleanly in the open aisle without clipping into an opposite shelf.
  let safeDist = distance;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cx = target[0] + worldNormal[0] * safeDist;
    const cz = target[2] + worldNormal[2] * safeDist;
    if (!isPointInsideObstacle(cx, cz, 0.32)) {
      return { position: [cx, camY, cz], target, worldNormal };
    }
    safeDist = Math.max(1.35, safeDist - 0.22);
  }

  const position: Vec3 = [
    target[0] + worldNormal[0] * safeDist,
    camY,
    target[2] + worldNormal[2] * safeDist,
  ];
  return { position, target, worldNormal };
}

/** Aisle-side aware camera framing for inspecting a whole shelf fixture. */
export function shelfFixtureWorldCamera(
  fixture: ShelfFixtureSpec,
  preferredSide: 1 | -1 = 1,
): { position: Vec3; target: Vec3 } {
  const [w, h, d] = fixture.size;
  const isZLong = d >= w;
  const localNormal: Vec3 = isZLong
    ? [fixture.kind === "refrigerator" ? -1 : preferredSide, 0, 0]
    : [0, 0, 1];
  const worldNormal = fixtureLocalNormalToWorld(fixture.rotationY, localNormal);
  const dist = Math.max(3.4, Math.max(w, d) * 0.52);
  const target: Vec3 = [
    fixture.position[0],
    fixture.position[1] + h * 0.52,
    fixture.position[2],
  ];
  const position: Vec3 = [
    target[0] + worldNormal[0] * dist,
    Math.min(2.6, Math.max(1.65, h * 0.88)),
    target[2] + worldNormal[2] * dist,
  ];
  return { position, target };
}

export interface ObstacleBox2D {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** World-space 2D AABB obstacles for retail shelves, checkouts, and service desks. */
export const RETAIL_COLLISION_BOXES: ObstacleBox2D[] = [
  ...SHELF_FIXTURES.map((f) => {
    const [w, , d] = f.size;
    const cos = Math.abs(Math.cos(f.rotationY));
    const sin = Math.abs(Math.sin(f.rotationY));
    const halfX = (w * cos + d * sin) / 2;
    const halfZ = (w * sin + d * cos) / 2;
    return {
      id: f.code,
      minX: f.position[0] - halfX,
      maxX: f.position[0] + halfX,
      minZ: f.position[2] - halfZ,
      maxZ: f.position[2] + halfZ,
    };
  }),
  ...CHECKOUT_LANES.map((lane) => ({
    id: lane.code,
    minX: lane.position[0] - lane.size[0] / 2,
    maxX: lane.position[0] + lane.size[0] / 2,
    minZ: lane.position[2] - lane.size[2] / 2,
    maxZ: lane.position[2] + lane.size[2] / 2,
  })),
  // Customer reception kiosk & service desk
  { id: "REC-DESK", minX: -8.65, maxX: -5.75, minZ: 11.5, maxZ: 12.5 },
  { id: "SVC-DESK", minX: -17.05, maxX: -12.55, minZ: 10.8, maxZ: 12.0 },
];

export function isPointInsideObstacle(
  x: number,
  z: number,
  radius: number,
  obstacles: readonly ObstacleBox2D[] = RETAIL_COLLISION_BOXES,
): boolean {
  for (const box of obstacles) {
    if (
      x > box.minX - radius &&
      x < box.maxX + radius &&
      z > box.minZ - radius &&
      z < box.maxZ + radius
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Axis-separated AABB collision resolver with smooth aisle wall sliding.
 * Prevents the shopper camera from clipping into shelves or counters while
 * letting diagonal walking glide smoothly along aisle edges.
 */
export function resolveWalkCollision(
  prevX: number,
  prevZ: number,
  desiredX: number,
  desiredZ: number,
  radius = 0.48,
  bounds: Bounds2D = {
    minX: BUILDING_DIMENSIONS.retail.bounds.minX + 1.0,
    maxX: BUILDING_DIMENSIONS.retail.bounds.maxX - 1.0,
    minZ: BUILDING_DIMENSIONS.retail.bounds.minZ + 1.0,
    maxZ: BUILDING_DIMENSIONS.retail.bounds.maxZ + 2.0,
  },
  obstacles: readonly ObstacleBox2D[] = RETAIL_COLLISION_BOXES,
): [number, number] {
  const clampedX = Math.min(bounds.maxX, Math.max(bounds.minX, desiredX));
  const clampedZ = Math.min(bounds.maxZ, Math.max(bounds.minZ, desiredZ));

  // If moving inside free space (or moving out of an obstacle), accept directly.
  if (!isPointInsideObstacle(clampedX, clampedZ, radius, obstacles)) {
    return [clampedX, clampedZ];
  }

  // Try sliding along X only.
  const canSlideX = !isPointInsideObstacle(clampedX, prevZ, radius, obstacles);
  // Try sliding along Z only.
  const canSlideZ = !isPointInsideObstacle(prevX, clampedZ, radius, obstacles);

  if (canSlideX && !canSlideZ) return [clampedX, prevZ];
  if (canSlideZ && !canSlideX) return [prevX, clampedZ];
  if (canSlideX && canSlideZ) {
    const dx = Math.abs(clampedX - prevX);
    const dz = Math.abs(clampedZ - prevZ);
    return dx >= dz ? [clampedX, prevZ] : [prevX, clampedZ];
  }

  // If the camera started overlapping (e.g. after a zoom-out), allow escape away from center.
  if (isPointInsideObstacle(prevX, prevZ, radius, obstacles)) {
    return [clampedX, clampedZ];
  }

  return [prevX, prevZ];
}

/**
 * Build an ordered aisle-friendly shopping path (Entrance -> shelf stops -> Checkout)
 * for all unique shelf codes containing items in the customer's basket.
 */
export function buildShoppingPathPoints(
  shelfStops: Array<{ shelfCode: string; slotIndex?: number }>,
): Vec3[] {
  if (shelfStops.length === 0) return [];

  const uniqueMap = new Map<string, Vec3>();
  for (const stop of shelfStops) {
    if (uniqueMap.has(stop.shelfCode)) continue;
    const fixture = findFixtureByCode(stop.shelfCode);
    if (!fixture) continue;
    const cam = shelfSlotWorldCamera(fixture, stop.slotIndex ?? 0, 1.35);
    const [safeX, safeZ] = resolveWalkCollision(
      cam.position[0],
      cam.position[2],
      cam.position[0],
      cam.position[2],
      0.32,
    );
    uniqueMap.set(stop.shelfCode, [safeX, 0.045, safeZ]);
  }

  const remaining = Array.from(uniqueMap.values());
  if (remaining.length === 0) return [];

  const entrance: Vec3 = [0, 0.045, 11.4];
  const checkout: Vec3 = [-0.6, 0.045, 7.6];
  const ordered: Vec3[] = [entrance];

  let cur = entrance;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i][0] - cur[0];
      const dz = remaining[i][2] - cur[2];
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    // Insert a corridor hinge waypoint at Z = 5.4 or Z = -4.9 when crossing aisles.
    if (Math.abs(next[0] - cur[0]) > 2.4 && cur[2] < 5.2 && next[2] < 5.2) {
      const corridorZ = cur[2] + next[2] > -2 ? 5.25 : -4.85;
      ordered.push([cur[0], 0.045, corridorZ]);
      ordered.push([next[0], 0.045, corridorZ]);
    }
    ordered.push(next);
    cur = next;
  }

  ordered.push([cur[0], 0.045, 5.4]);
  ordered.push(checkout);
  return ordered;
}

/** Deterministic world coordinate of a pallet slot inside a warehouse rack. */
export function warehouseSlotWorldPosition(
  rack: WarehouseRackSpec,
  levelIndex: number,
  positionIndex: number,
): Vec3 {
  const [rx, ry, rz] = rack.position;
  const [w, h] = rack.size;
  const frac =
    rack.positionsPerLevel > 1
      ? positionIndex / (rack.positionsPerLevel - 1) - 0.5
      : 0;
  const localX = frac * (w * 0.74);
  const levelY = ry + 0.45 + levelIndex * ((h - 0.9) / Math.max(1, rack.levels));
  return [rx + localX, levelY, rz];
}
