// Verified 3D GLB asset manifest for Supermarket Zanzibar.
//
// Every entry maps strictly to an existing validated binary glTF 2.0 (.glb)
// asset generated under `public/models/`. Never add a path here without
// generating or placing the corresponding asset on disk.

export type AssetCategory = "supermarket" | "department" | "furniture" | "product";

export type ProductDepartmentCode =
  | "BEV"
  | "GRO"
  | "PRO"
  | "DAI"
  | "FRZ"
  | "BAK"
  | "MEA"
  | "COS"
  | "HSH"
  | "ELC";

export type ProductLabelWrapStyle =
  | "cylinder"
  | "tapered_cup"
  | "jug"
  | "box"
  | "pouch"
  | "band"
  | "tray"
  | "tray_sticker"
  | "produce_front"
  | "blister";

export interface ProductLabelWrapSpec {
  style: ProductLabelWrapStyle;
  /** Label height as a fraction of normalized Box3 height. */
  heightRatio: number;
  /** Vertical center of label as a fraction of normalized Box3 height (0=bottom, 1=top). */
  yRatio: number;
  /** Label width as a fraction of normalized Box3 width (for panels, bands, trays). */
  widthRatio?: number;
  /** Horizontal offset as a fraction of normalized Box3 width (clears side handles/spouts). */
  xOffsetRatio?: number;
  /** Top radius fraction of normalized Box3 half-width (for cylinder / tapered_cup / jug). */
  radiusTopRatio?: number;
  /** Bottom radius fraction of normalized Box3 half-width (for cylinder / tapered_cup / jug). */
  radiusBottomRatio?: number;
  /** Depth ratio relative to normalized Box3 half-depth (defaults to 1.0). */
  depthRatio?: number;
  /** Draw branded side spines on carton/box packages. */
  sideSpines?: boolean;
  /** Draw top lid label (circular on tapered cups/jars, rectangular on trays). */
  topLabel?: boolean;
}

export interface AssetManifestEntry {
  key: string;
  name: string;
  category: AssetCategory;
  path: string; // public URL path, e.g. /models/furniture/shelf.glb
  format: "glb";
  version: string;
  source: "procedural-glb" | "blender";
  requiredNodes?: string[];
  defaultScale: [number, number, number];
  /** Product-only department classification for grouped UI selectors. */
  departmentCode?: ProductDepartmentCode;
  departmentLabel?: string;
  /** Short human-readable silhouette description shown in product forms. */
  shapeSummary?: string;
  /** True for narrow/compact shapes that pack more facings per shelf column. */
  compactOnShelf?: boolean;
  /** Shape-aware front/back/top packaging label wrap metadata. */
  labelWrap?: ProductLabelWrapSpec;
}

export const ASSET_MANIFEST: AssetManifestEntry[] = [
  // Building & Structure
  { key: "supermarket/building", name: "Supermarket Shell", category: "supermarket", path: "/models/supermarket/building.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "supermarket/floor", name: "Supermarket Floor Slab", category: "supermarket", path: "/models/supermarket/floor.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "supermarket/ceiling", name: "Supermarket Ceiling Trusses", category: "supermarket", path: "/models/supermarket/ceiling.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "supermarket/lighting", name: "Ceiling LED Luminaire", category: "supermarket", path: "/models/supermarket/lighting.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },

  // Departments
  { key: "departments/beverages", name: "Beverages Header", category: "department", path: "/models/departments/beverages.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "departments/groceries", name: "Groceries Header", category: "department", path: "/models/departments/groceries.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "departments/bakery", name: "Bakery Display Case", category: "department", path: "/models/departments/bakery.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "departments/cosmetics", name: "Cosmetics Boutique Unit", category: "department", path: "/models/departments/cosmetics.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "departments/electronics", name: "Electronics Glass Showcase", category: "department", path: "/models/departments/electronics.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "departments/frozen-food", name: "Frozen Food Island", category: "department", path: "/models/departments/frozen-food.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },

  // Furniture & Equipment
  {
    key: "furniture/shelf",
    name: "Standard Supermarket Gondola",
    category: "furniture",
    path: "/models/furniture/shelf.glb",
    format: "glb",
    version: "1.0.0",
    source: "procedural-glb",
    requiredNodes: ["Frame", "Top_Shelf", "Bottom_Shelf", "Shelf_Labels", "Product_Position_01"],
    defaultScale: [1, 1, 1],
  },
  { key: "furniture/refrigerator", name: "Double-Door Chiller Refrigerator", category: "furniture", path: "/models/furniture/refrigerator.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "furniture/checkout", name: "POS Checkout Counter", category: "furniture", path: "/models/furniture/checkout.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "furniture/shopping-cart", name: "Shopping Cart", category: "furniture", path: "/models/furniture/shopping-cart.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  { key: "furniture/basket", name: "Hand Shopping Basket", category: "furniture", path: "/models/furniture/basket.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1, 1, 1] },
  {
    key: "furniture/warehouse-rack",
    name: "Industrial Pallet Warehouse Rack",
    category: "furniture",
    path: "/models/furniture/warehouse-rack.glb",
    format: "glb",
    version: "1.0.0",
    source: "procedural-glb",
    requiredNodes: ["Upright_Left", "Upright_Right", "Level_01", "Level_02", "Level_03"],
    defaultScale: [1, 1, 1],
  },

  // =========================================================================
  // PRODUCTS — 1. BEVERAGES (BEV)
  // =========================================================================
  {
    key: "products/beverages/soda-can",
    name: "Soda Can (330ml)",
    category: "product",
    departmentCode: "BEV",
    departmentLabel: "Beverages",
    shapeSummary: "Contoured aluminum beverage can with silver rim & pull-tab",
    compactOnShelf: true,
    path: "/models/products/beverages/soda-can.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.6, 1.6, 1.6],
    labelWrap: { style: "cylinder", heightRatio: 0.78, yRatio: 0.48, radiusTopRatio: 1.0, radiusBottomRatio: 1.0 },
  },
  {
    key: "products/beverages/energy-can",
    name: "Energy Drink Slim Can (250ml)",
    category: "product",
    departmentCode: "BEV",
    departmentLabel: "Beverages",
    shapeSummary: "Tall sleek slimline aluminum energy drink can with pull-tab",
    compactOnShelf: true,
    path: "/models/products/beverages/energy-can.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.55, 1.55, 1.55],
    labelWrap: { style: "cylinder", heightRatio: 0.8, yRatio: 0.48, radiusTopRatio: 1.0, radiusBottomRatio: 1.0 },
  },
  {
    key: "products/beverages/soda-bottle",
    name: "Soft Drink PET Bottle (1L)",
    category: "product",
    departmentCode: "BEV",
    departmentLabel: "Beverages",
    shapeSummary: "Contoured-waist PET soda bottle with neck collar & cap",
    compactOnShelf: true,
    path: "/models/products/beverages/soda-bottle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.28, 1.28, 1.28],
    labelWrap: { style: "cylinder", heightRatio: 0.42, yRatio: 0.39, radiusTopRatio: 1.0, radiusBottomRatio: 1.0 },
  },
  {
    key: "products/beverages/water-bottle",
    name: "Mineral Water Bottle",
    category: "product",
    departmentCode: "BEV",
    departmentLabel: "Beverages",
    shapeSummary: "Translucent aqua ribbed PET water bottle with blue cap",
    compactOnShelf: true,
    path: "/models/products/beverages/water-bottle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.3, 1.3, 1.3],
    labelWrap: { style: "cylinder", heightRatio: 0.34, yRatio: 0.47, radiusTopRatio: 1.0, radiusBottomRatio: 1.0 },
  },
  {
    key: "products/beverages/juice-carton",
    name: "Fruit Juice Carton (1L)",
    category: "product",
    departmentCode: "BEV",
    departmentLabel: "Beverages",
    shapeSummary: "Sloped-top Tetra-Pak juice carton with angled pour cap",
    compactOnShelf: true,
    path: "/models/products/beverages/juice-carton.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.35, 1.35, 1.35],
    labelWrap: { style: "box", heightRatio: 0.78, yRatio: 0.42, widthRatio: 0.94, sideSpines: true },
  },
  {
    key: "products/beverages/glass-bottle",
    name: "Glass Beverage Bottle",
    category: "product",
    departmentCode: "BEV",
    departmentLabel: "Beverages",
    shapeSummary: "Long-neck tinted glass bottle with gold neck foil & crown cap",
    compactOnShelf: true,
    path: "/models/products/beverages/glass-bottle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.3, 1.3, 1.3],
    labelWrap: { style: "cylinder", heightRatio: 0.38, yRatio: 0.28, radiusTopRatio: 1.0, radiusBottomRatio: 1.0 },
  },

  // =========================================================================
  // PRODUCTS — 2. GROCERIES (GRO)
  // =========================================================================
  {
    key: "products/groceries/rice-bag",
    name: "Rice / Grain Sack (5kg)",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Sculpted bulging pillow sack with stitched top seam",
    compactOnShelf: false,
    path: "/models/products/groceries/rice-bag.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [0.96, 0.92, 0.96],
    labelWrap: { style: "pouch", heightRatio: 0.66, yRatio: 0.46, widthRatio: 0.78, depthRatio: 1.02 },
  },
  {
    key: "products/groceries/flour-bag",
    name: "Flour / Sugar Kraft Bag (2kg)",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Tapered kraft paper sack with pinched folded top seal",
    compactOnShelf: false,
    path: "/models/products/groceries/flour-bag.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.2, 1.2, 1.2],
    labelWrap: { style: "box", heightRatio: 0.74, yRatio: 0.42, widthRatio: 0.88, depthRatio: 0.95 },
  },
  {
    key: "products/groceries/oil-bottle",
    name: "Cooking Oil Jug (2L)",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Translucent golden oil jug with curved ergonomic D-handle & cap",
    compactOnShelf: false,
    path: "/models/products/groceries/oil-bottle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.18, 1.18, 1.18],
    labelWrap: { style: "jug", heightRatio: 0.42, yRatio: 0.36, xOffsetRatio: -0.126, radiusTopRatio: 0.76, radiusBottomRatio: 0.76, depthRatio: 1.0 },
  },
  {
    key: "products/groceries/cereal-box",
    name: "Cereal / Pasta Retail Box",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Tall slim retail carton box with sealed top tuck-flap",
    compactOnShelf: false,
    path: "/models/products/groceries/cereal-box.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.12, 1.12, 1.12],
    labelWrap: { style: "box", heightRatio: 0.9, yRatio: 0.49, widthRatio: 0.94, sideSpines: true },
  },
  {
    key: "products/groceries/biscuits-pack",
    name: "Biscuits / Cookies Roll Pack",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Rounded horizontal biscuit roll flow-wrap with crimped ends",
    compactOnShelf: false,
    path: "/models/products/groceries/biscuits-pack.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.35, 1.35, 1.35],
    labelWrap: { style: "band", heightRatio: 0.86, yRatio: 0.5, widthRatio: 0.76, depthRatio: 1.02 },
  },
  {
    key: "products/groceries/canned-food",
    name: "Canned Food Tin",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Ribbed metallic tin can with rolled rim & ring-pull opener",
    compactOnShelf: true,
    path: "/models/products/groceries/canned-food.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.6, 1.6, 1.6],
    labelWrap: { style: "cylinder", heightRatio: 0.76, yRatio: 0.49, radiusTopRatio: 1.0, radiusBottomRatio: 1.0 },
  },
  {
    key: "products/groceries/glass-jar",
    name: "Glass Jar (Jam / Sauce / Honey)",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Rounded-shoulder clear glass jar with gold twist-off lug lid",
    compactOnShelf: true,
    path: "/models/products/groceries/glass-jar.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.45, 1.45, 1.45],
    labelWrap: { style: "cylinder", heightRatio: 0.52, yRatio: 0.38, radiusTopRatio: 1.0, radiusBottomRatio: 1.0 },
  },
  {
    key: "products/groceries/snack-pouch",
    name: "Stand-Up Snack / Coffee / Spice Pouch",
    category: "product",
    departmentCode: "GRO",
    departmentLabel: "Groceries",
    shapeSummary: "Gusseted Doypack stand-up pouch tapering to a zip-lock top",
    compactOnShelf: false,
    path: "/models/products/groceries/snack-pouch.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.18, 1.18, 1.18],
    labelWrap: { style: "pouch", heightRatio: 0.68, yRatio: 0.44, widthRatio: 0.82, depthRatio: 0.94 },
  },

  // =========================================================================
  // PRODUCTS — 3. FRUITS & VEGETABLES (PRO)
  // =========================================================================
  {
    key: "products/produce/fruit-basket",
    name: "Fresh Fruit Basket (Apples / Mangoes / Oranges)",
    category: "product",
    departmentCode: "PRO",
    departmentLabel: "Fruits & Vegetables",
    shapeSummary: "Timber market basket overflowing with sculpted 3D glossy fruits & leaf",
    compactOnShelf: false,
    path: "/models/products/produce/fruit-basket.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.15, 1.15, 1.15],
    labelWrap: { style: "produce_front", heightRatio: 0.42, yRatio: 0.25, widthRatio: 0.9 },
  },
  {
    key: "products/produce/vegetable-crate",
    name: "Fresh Vegetable Crate (Tomatoes / Peppers / Onions)",
    category: "product",
    departmentCode: "PRO",
    departmentLabel: "Fruits & Vegetables",
    shapeSummary: "Green produce crate filled with 3D tomatoes, peppers, onions & greens",
    compactOnShelf: false,
    path: "/models/products/produce/vegetable-crate.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.15, 1.15, 1.15],
    labelWrap: { style: "produce_front", heightRatio: 0.45, yRatio: 0.27, widthRatio: 0.9 },
  },
  {
    key: "products/produce/banana-bunch",
    name: "Fresh Banana Bunch",
    category: "product",
    departmentCode: "PRO",
    departmentLabel: "Fruits & Vegetables",
    shapeSummary: "Curved hand of 5 sculpted yellow bananas resting on a produce tray",
    compactOnShelf: false,
    path: "/models/products/produce/banana-bunch.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.18, 1.18, 1.18],
    labelWrap: { style: "produce_front", heightRatio: 0.3, yRatio: 0.16, widthRatio: 0.88 },
  },

  // =========================================================================
  // PRODUCTS — 4. DAIRY PRODUCTS (DAI)
  // =========================================================================
  {
    key: "products/dairy/milk-carton",
    name: "Gable-Top Milk Carton (1L)",
    category: "product",
    departmentCode: "DAI",
    departmentLabel: "Dairy Products",
    shapeSummary: "Classic pitched gable-top milk carton with angled screw-cap",
    compactOnShelf: true,
    path: "/models/products/dairy/milk-carton.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.35, 1.35, 1.35],
    labelWrap: { style: "box", heightRatio: 0.72, yRatio: 0.39, widthRatio: 0.94, sideSpines: true },
  },
  {
    key: "products/dairy/yogurt-cup",
    name: "Yogurt Cup / Tub",
    category: "product",
    departmentCode: "DAI",
    departmentLabel: "Dairy Products",
    shapeSummary: "Tapered conical yogurt cup with foil peel-lid & pull-tab",
    compactOnShelf: true,
    path: "/models/products/dairy/yogurt-cup.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.5, 1.5, 1.5],
    labelWrap: { style: "tapered_cup", heightRatio: 0.74, yRatio: 0.46, xOffsetRatio: -0.038, radiusTopRatio: 0.86, radiusBottomRatio: 0.68, depthRatio: 0.96, topLabel: true },
  },
  {
    key: "products/dairy/butter-tub",
    name: "Butter / Margarine Spread Tub",
    category: "product",
    departmentCode: "DAI",
    departmentLabel: "Dairy Products",
    shapeSummary: "Rounded stadium butter tub with beveled snap-fit lid",
    compactOnShelf: false,
    path: "/models/products/dairy/butter-tub.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.35, 1.35, 1.35],
    labelWrap: { style: "tray", heightRatio: 0.74, yRatio: 0.46, widthRatio: 0.74, topLabel: true },
  },
  {
    key: "products/dairy/cheese-wedge",
    name: "Cheese Wedge Pack",
    category: "product",
    departmentCode: "DAI",
    departmentLabel: "Dairy Products",
    shapeSummary: "Triangular sculpted cheddar cheese wedge with curved red wax rind",
    compactOnShelf: false,
    path: "/models/products/dairy/cheese-wedge.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.28, 1.28, 1.28],
    labelWrap: { style: "produce_front", heightRatio: 0.54, yRatio: 0.46, widthRatio: 0.62, depthRatio: 0.95 },
  },
  {
    key: "products/dairy/egg-carton",
    name: "Egg Carton (Molded Pulp Tray)",
    category: "product",
    departmentCode: "DAI",
    departmentLabel: "Dairy Products",
    shapeSummary: "Molded pulp egg tray with 6 visible brown oval eggs nestled inside",
    compactOnShelf: false,
    path: "/models/products/dairy/egg-carton.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.18, 1.18, 1.18],
    labelWrap: { style: "tray", heightRatio: 0.36, yRatio: 0.25, widthRatio: 0.84, topLabel: true },
  },

  // =========================================================================
  // PRODUCTS — 5. FROZEN FOODS (FRZ)
  // =========================================================================
  {
    key: "products/frozen/ice-cream-tub",
    name: "Ice Cream Tub (500ml / 1L)",
    category: "product",
    departmentCode: "FRZ",
    departmentLabel: "Frozen Foods",
    shapeSummary: "Tapered round ice cream tub with snap-on chilled dome lid",
    compactOnShelf: true,
    path: "/models/products/frozen/ice-cream-tub.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.4, 1.4, 1.4],
    labelWrap: { style: "tapered_cup", heightRatio: 0.72, yRatio: 0.44, radiusTopRatio: 0.92, radiusBottomRatio: 0.76, depthRatio: 0.94, topLabel: true },
  },
  {
    key: "products/dairy/frozen-pack",
    name: "Frozen Meal / Poultry Tray",
    category: "product",
    departmentCode: "FRZ",
    departmentLabel: "Frozen Foods",
    shapeSummary: "Rounded frosted freezer tray with sealed film window lid",
    compactOnShelf: false,
    path: "/models/products/dairy/frozen-pack.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.16, 1.16, 1.16],
    labelWrap: { style: "tray", heightRatio: 0.68, yRatio: 0.46, widthRatio: 0.82, topLabel: true },
  },

  // =========================================================================
  // PRODUCTS — 6. BAKERY (BAK)
  // =========================================================================
  {
    key: "products/bakery/bread-loaf",
    name: "Fresh Bread Loaf",
    category: "product",
    departmentCode: "BAK",
    departmentLabel: "Bakery",
    shapeSummary: "Domed golden artisanal bread loaf with top crust scores & bakery band",
    compactOnShelf: false,
    path: "/models/products/bakery/bread-loaf.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.1, 1.1, 1.1],
    labelWrap: { style: "band", heightRatio: 0.76, yRatio: 0.48, widthRatio: 0.5, depthRatio: 1.02 },
  },
  {
    key: "products/bakery/pastry-box",
    name: "Pastry / Croissant Clamshell",
    category: "product",
    departmentCode: "BAK",
    departmentLabel: "Bakery",
    shapeSummary: "Clear hinged clamshell bakery box with 3 curved golden croissants inside",
    compactOnShelf: false,
    path: "/models/products/bakery/pastry-box.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.15, 1.15, 1.15],
    labelWrap: { style: "tray_sticker", heightRatio: 0.42, yRatio: 0.25, widthRatio: 0.46, depthRatio: 0.54 },
  },
  {
    key: "products/bakery/cake-dome",
    name: "Round Cake in Clear Dome",
    category: "product",
    departmentCode: "BAK",
    departmentLabel: "Bakery",
    shapeSummary: "Layered frosted chocolate-and-berry cake on gold board under clear dome",
    compactOnShelf: false,
    path: "/models/products/bakery/cake-dome.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.05, 1.05, 1.05],
    labelWrap: { style: "produce_front", heightRatio: 0.42, yRatio: 0.28, widthRatio: 0.56, depthRatio: 0.98 },
  },

  // =========================================================================
  // PRODUCTS — 7. MEAT & FISH (MEA)
  // =========================================================================
  {
    key: "products/meat/meat-tray",
    name: "Butcher Meat Tray (Beef / Chicken / Mutton)",
    category: "product",
    departmentCode: "MEA",
    departmentLabel: "Meat & Fish",
    shapeSummary: "Black butcher tray with marbled steaks, herbs, stretch wrap & label",
    compactOnShelf: false,
    path: "/models/products/meat/meat-tray.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.15, 1.15, 1.15],
    labelWrap: { style: "tray_sticker", heightRatio: 0.48, yRatio: 0.3, widthRatio: 0.48, depthRatio: 0.6 },
  },
  {
    key: "products/meat/fish-tray",
    name: "Fresh Fish & Seafood Tray",
    category: "product",
    departmentCode: "MEA",
    departmentLabel: "Meat & Fish",
    shapeSummary: "Ice-blue seafood tray with sculpted fish, lemon slice & clear wrap",
    compactOnShelf: false,
    path: "/models/products/meat/fish-tray.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.15, 1.15, 1.15],
    labelWrap: { style: "tray_sticker", heightRatio: 0.48, yRatio: 0.3, widthRatio: 0.48, depthRatio: 0.6 },
  },

  // =========================================================================
  // PRODUCTS — 8. COSMETICS & PERSONAL CARE (COS)
  // =========================================================================
  {
    key: "products/cosmetics/soap-box",
    name: "Beauty Soap Bar Box",
    category: "product",
    departmentCode: "COS",
    departmentLabel: "Cosmetics & Personal Care",
    shapeSummary: "Beveled pillow-edge beauty soap bar carton",
    compactOnShelf: true,
    path: "/models/products/cosmetics/soap-box.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.65, 1.65, 1.65],
    labelWrap: { style: "tray", heightRatio: 0.82, yRatio: 0.5, widthRatio: 0.84, topLabel: true },
  },
  {
    key: "products/cosmetics/toothpaste-box",
    name: "Toothpaste Tube & Carton",
    category: "product",
    departmentCode: "COS",
    departmentLabel: "Cosmetics & Personal Care",
    shapeSummary: "Slim horizontal oral-care carton with tube cap detail",
    compactOnShelf: false,
    path: "/models/products/cosmetics/toothpaste-box.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.4, 1.4, 1.4],
    labelWrap: { style: "box", heightRatio: 0.88, yRatio: 0.5, widthRatio: 0.84, xOffsetRatio: -0.04, sideSpines: false },
  },
  {
    key: "products/cosmetics/shampoo-bottle",
    name: "Shampoo Contoured Bottle",
    category: "product",
    departmentCode: "COS",
    departmentLabel: "Cosmetics & Personal Care",
    shapeSummary: "Sculpted oval teardrop shampoo bottle with flip-top cap",
    compactOnShelf: true,
    path: "/models/products/cosmetics/shampoo-bottle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.38, 1.38, 1.38],
    labelWrap: { style: "cylinder", heightRatio: 0.6, yRatio: 0.42, radiusTopRatio: 1.0, radiusBottomRatio: 0.96 },
  },
  {
    key: "products/cosmetics/lotion-pump",
    name: "Lotion Pump Dispenser Bottle",
    category: "product",
    departmentCode: "COS",
    departmentLabel: "Cosmetics & Personal Care",
    shapeSummary: "Contoured skincare bottle with metallic collar & curved pump spout",
    compactOnShelf: true,
    path: "/models/products/cosmetics/lotion-pump.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.35, 1.35, 1.35],
    labelWrap: { style: "cylinder", heightRatio: 0.54, yRatio: 0.35, xOffsetRatio: -0.025, radiusTopRatio: 0.95, radiusBottomRatio: 0.92 },
  },
  {
    key: "products/cosmetics/cream-jar",
    name: "Face / Body Cream Jar",
    category: "product",
    departmentCode: "COS",
    departmentLabel: "Cosmetics & Personal Care",
    shapeSummary: "Wide luxury cosmetic cream jar with gold trim & pearl screw lid",
    compactOnShelf: true,
    path: "/models/products/cosmetics/cream-jar.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.5, 1.5, 1.5],
    labelWrap: { style: "cylinder", heightRatio: 0.56, yRatio: 0.34, radiusTopRatio: 1.0, radiusBottomRatio: 0.96, topLabel: true },
  },
  {
    key: "products/cosmetics/perfume-bottle",
    name: "Perfume Glass Flacon",
    category: "product",
    departmentCode: "COS",
    departmentLabel: "Cosmetics & Personal Care",
    shapeSummary: "Faceted crystal glass flacon with inner essence, gold collar & cap",
    compactOnShelf: true,
    path: "/models/products/cosmetics/perfume-bottle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.45, 1.45, 1.45],
    labelWrap: { style: "box", heightRatio: 0.46, yRatio: 0.36, widthRatio: 0.66, sideSpines: false },
  },

  // =========================================================================
  // PRODUCTS — 9. HOUSEHOLD PRODUCTS (HSH)
  // =========================================================================
  {
    key: "products/household/detergent-jug",
    name: "Laundry Detergent Jug (2L / 3L)",
    category: "product",
    departmentCode: "HSH",
    departmentLabel: "Household Products",
    shapeSummary: "Ergonomic heavy detergent bottle with side D-handle & measuring cap",
    compactOnShelf: false,
    path: "/models/products/household/detergent-jug.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.05, 1.05, 1.05],
    labelWrap: { style: "box", heightRatio: 0.56, yRatio: 0.38, widthRatio: 0.62, xOffsetRatio: -0.13, depthRatio: 1.02, sideSpines: false },
  },
  {
    key: "products/household/spray-bottle",
    name: "Trigger Spray Cleaner Bottle",
    category: "product",
    departmentCode: "HSH",
    departmentLabel: "Household Products",
    shapeSummary: "Contoured spray cleaner bottle with trigger lever & red nozzle tip",
    compactOnShelf: true,
    path: "/models/products/household/spray-bottle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.28, 1.28, 1.28],
    labelWrap: { style: "jug", heightRatio: 0.42, yRatio: 0.28, xOffsetRatio: -0.096, radiusTopRatio: 0.78, radiusBottomRatio: 0.81, depthRatio: 1.0 },
  },
  {
    key: "products/household/tissue-pack",
    name: "Toilet Tissue / Paper Roll Pack",
    category: "product",
    departmentCode: "HSH",
    departmentLabel: "Household Products",
    shapeSummary: "Multi-roll bundle of cylindrical embossed tissue rolls in clear wrap",
    compactOnShelf: false,
    path: "/models/products/household/tissue-pack.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.05, 1.05, 1.05],
    labelWrap: { style: "box", heightRatio: 0.86, yRatio: 0.48, widthRatio: 0.9, sideSpines: false },
  },

  // =========================================================================
  // PRODUCTS — 10. ELECTRONICS (ELC)
  // =========================================================================
  {
    key: "products/electronics/electric-kettle",
    name: "Electric Kettle / Small Appliance",
    category: "product",
    departmentCode: "ELC",
    departmentLabel: "Electronics",
    shapeSummary: "Brushed-steel cordless kettle with pouring spout, handle & power base",
    compactOnShelf: false,
    path: "/models/products/electronics/electric-kettle.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.1, 1.1, 1.1],
    labelWrap: { style: "jug", heightRatio: 0.56, yRatio: 0.5, xOffsetRatio: -0.06, radiusTopRatio: 0.58, radiusBottomRatio: 0.64, depthRatio: 0.93 },
  },
  {
    key: "products/electronics/electronics-box",
    name: "Tech Accessory / LED Bulb Box",
    category: "product",
    departmentCode: "ELC",
    departmentLabel: "Electronics",
    shapeSummary: "Matte-slate retail electronics carton with top euro-slot hang tab",
    compactOnShelf: false,
    path: "/models/products/electronics/electronics-box.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.22, 1.22, 1.22],
    labelWrap: { style: "box", heightRatio: 0.78, yRatio: 0.43, widthRatio: 0.92, sideSpines: true },
  },
  {
    key: "products/electronics/battery-pack",
    name: "Battery Blister Pack (4× AA)",
    category: "product",
    departmentCode: "ELC",
    departmentLabel: "Electronics",
    shapeSummary: "Hanging blister card displaying 4 copper-top metallic AA batteries",
    compactOnShelf: true,
    path: "/models/products/electronics/battery-pack.glb",
    format: "glb",
    version: "2.0.0",
    source: "procedural-glb",
    defaultScale: [1.28, 1.28, 1.28],
    labelWrap: { style: "blister", heightRatio: 0.42, yRatio: 0.24, widthRatio: 0.92, depthRatio: 0.46 },
  },
];

const BY_KEY = new Map(ASSET_MANIFEST.map((entry) => [entry.key, entry]));

export const PRODUCT_ASSET_MANIFEST: AssetManifestEntry[] = ASSET_MANIFEST.filter(
  (entry) => entry.category === "product",
);

export interface ProductAssetDepartmentGroup {
  departmentCode: ProductDepartmentCode;
  departmentLabel: string;
  assets: AssetManifestEntry[];
}

const DEPARTMENT_ORDER: ProductDepartmentCode[] = [
  "BEV",
  "GRO",
  "PRO",
  "DAI",
  "FRZ",
  "BAK",
  "MEA",
  "COS",
  "HSH",
  "ELC",
];

export const PRODUCT_ASSET_GROUPS: ProductAssetDepartmentGroup[] =
  DEPARTMENT_ORDER.map((code) => {
    const assets = PRODUCT_ASSET_MANIFEST.filter(
      (a) => a.departmentCode === code,
    );
    return {
      departmentCode: code,
      departmentLabel: assets[0]?.departmentLabel ?? code,
      assets,
    };
  }).filter((g) => g.assets.length > 0);

export function getAssetEntry(key: string): AssetManifestEntry | undefined {
  return BY_KEY.get(key);
}

export function isValidProductAssetKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const entry = BY_KEY.get(key);
  return Boolean(entry && entry.category === "product");
}

/**
 * Smart deterministic 3D product shape selector based on product name &
 * category across all 10 supermarket departments (41 sculpted shapes).
 *
 * Matches specific product names first so shared department titles like
 * "Fruits & Vegetables" or "Meat & Fish" never misclassify apples as
 * vegetables or beef as fish, then falls back cleanly to category defaults.
 */
export function resolveProductAsset(
  productName: string,
  categoryName?: string | null,
): AssetManifestEntry {
  const nameLower = productName.toLowerCase();
  const catLower = (categoryName ?? "").toLowerCase();

  // 1. Electronics (specific item names first)
  if (/\b(kettle|blender|toaster|iron|appliance|cooker|mixer)\b/.test(nameLower)) {
    return BY_KEY.get("products/electronics/electric-kettle")!;
  }
  if (/\b(battery|batteries|duracell|energizer|alkaline|\baa\b|\baaa\b)\b/.test(nameLower)) {
    return BY_KEY.get("products/electronics/battery-pack")!;
  }
  if (/\b(charger|cable|adapter|earphone|headphone|bulb|led|socket|extension|electronic|usb|power\s?bank)\b/.test(nameLower)) {
    return BY_KEY.get("products/electronics/electronics-box")!;
  }

  // 2. Household Cleaning & Paper Goods
  if (/\b(spray|windex|glass\s?clean|surface\s?clean|disinfectant\s?spray|air\s?freshener|trigger)\b/.test(nameLower)) {
    return BY_KEY.get("products/household/spray-bottle")!;
  }
  if (/\b(tissue|toilet\s?paper|kitchen\s?roll|paper\s?towel|serviette|napkin)\b/.test(nameLower)) {
    return BY_KEY.get("products/household/tissue-pack")!;
  }
  if (/\b(detergent|bleach|fabric\s?softener|jik|omo|ariel|persil|dishwash|laundry|floor\s?clean|liquid\s?soap|cleaner)\b/.test(nameLower)) {
    return BY_KEY.get("products/household/detergent-jug")!;
  }

  // 3. Cosmetics & Personal Care
  if (/\b(perfume|cologne|fragrance|eau\s?de|parfum|body\s?mist)\b/.test(nameLower)) {
    return BY_KEY.get("products/cosmetics/perfume-bottle")!;
  }
  if (/\b(lotion|moisturizer|hand\s?wash|body\s?wash|pump|sunscreen)\b/.test(nameLower)) {
    return BY_KEY.get("products/cosmetics/lotion-pump")!;
  }
  if (/\b(face\s?cream|body\s?cream|night\s?cream|day\s?cream|pomade|petroleum\s?jelly|balm|jar\s?cream|nivea|vaseline)\b/.test(nameLower) || (/\bcream\b/.test(nameLower) && /\b(cosmetic|beauty|skin|personal)\b/.test(catLower))) {
    return BY_KEY.get("products/cosmetics/cream-jar")!;
  }
  if (/\b(toothpaste|colgate|sensodyne|dental|oral|pepsodent)\b/.test(nameLower)) {
    return BY_KEY.get("products/cosmetics/toothpaste-box")!;
  }
  if (/\b(shampoo|conditioner|hair\s?oil|serum|deodorant)\b/.test(nameLower)) {
    return BY_KEY.get("products/cosmetics/shampoo-bottle")!;
  }
  if (/\b(soap|sabuni|lux|dettol|geisha|protex)\b/.test(nameLower)) {
    return BY_KEY.get("products/cosmetics/soap-box")!;
  }

  // 4. Bakery
  if (/\b(cake|gateau|torte|cheesecake|birthday)\b/.test(nameLower)) {
    return BY_KEY.get("products/bakery/cake-dome")!;
  }
  if (/\b(croissant|pastry|danish|muffin|donut|doughnut|bun|scone|cupcake|tart|pie)\b/.test(nameLower)) {
    return BY_KEY.get("products/bakery/pastry-box")!;
  }
  if (/\b(bread|loaf|baguette|toast|mkate|sourdough)\b/.test(nameLower)) {
    return BY_KEY.get("products/bakery/bread-loaf")!;
  }

  // 5. Frozen Foods (check ice cream before dairy cream, frozen meals before raw meat)
  if (/\b(ice\s?cream|gelato|sorbet|frozen\s?yogurt)\b/.test(nameLower)) {
    return BY_KEY.get("products/frozen/ice-cream-tub")!;
  }
  if (/\b(frozen|nugget|nuggets|fries|pizza)\b/.test(nameLower)) {
    return BY_KEY.get("products/dairy/frozen-pack")!;
  }

  // 6. Meat & Fresh Seafood (name-based so "Meat & Fish" category never overrides beef!)
  if (/\b(fish|salmon|tilapia|tuna|prawn|prawns|shrimp|octopus|calamari|squid|crab|seafood|samaki)\b/.test(nameLower) && !/\b(can|tin|canned)\b/.test(nameLower)) {
    return BY_KEY.get("products/meat/fish-tray")!;
  }
  if (/\b(beef|chicken|mutton|lamb|goat|steak|mince|sausage|meat|nyama|poultry|butcher|fillet|wing|drumstick)\b/.test(nameLower)) {
    return BY_KEY.get("products/meat/meat-tray")!;
  }

  // 7. Dairy Products
  if (/\b(yogurt|yoghurt|mtindi|lassi|mousse)\b/.test(nameLower)) {
    return BY_KEY.get("products/dairy/yogurt-cup")!;
  }
  if (/\b(butter|margarine|blue\s?band|prestige|spread|ghee)\b/.test(nameLower)) {
    return BY_KEY.get("products/dairy/butter-tub")!;
  }
  if (/\b(cheese|cheddar|mozzarella|parmesan|gouda|feta|brie)\b/.test(nameLower)) {
    return BY_KEY.get("products/dairy/cheese-wedge")!;
  }
  if (/\b(egg|eggs|mayai)\b/.test(nameLower)) {
    return BY_KEY.get("products/dairy/egg-carton")!;
  }
  if (/\b(milk|maziwa|uht|cream)\b/.test(nameLower)) {
    return BY_KEY.get("products/dairy/milk-carton")!;
  }

  // 8. Beverages (check juice/drinks before raw fruits)
  if (/\b(energy\s?drink|red\s?bull|monster|azania\s?energy|mo\s?energy|power\s?play|predator)\b/.test(nameLower)) {
    return BY_KEY.get("products/beverages/energy-can")!;
  }
  if (/\b(juice|nectar|smoothie|ceres|del\s?monte|squash)\b/.test(nameLower)) {
    return BY_KEY.get("products/beverages/juice-carton")!;
  }
  if (/\b(water|aqua|kilimanjaro|uhai|dasani|afya|sparkling\s?water|mineral)\b/.test(nameLower)) {
    return BY_KEY.get("products/beverages/water-bottle")!;
  }
  if (/\b(glass\s?bottle|wine|cider|ginger\s?beer|stoney|malt|sparkling\s?grape)\b/.test(nameLower)) {
    return BY_KEY.get("products/beverages/glass-bottle")!;
  }
  if (/\b(cola|coke|soda|fanta|sprite|pepsi|mirinda|novida|tonic|drink)\b/.test(nameLower)) {
    return /\b(can|330\s?ml|355\s?ml)\b/.test(nameLower)
      ? BY_KEY.get("products/beverages/soda-can")!
      : BY_KEY.get("products/beverages/soda-bottle")!;
  }

  // 9. Fresh Fruits & Vegetables (name-based so "Fruits & Vegetables" category never overrides apples!)
  if (/\b(banana|bananas|ndizi|plantain)\b/.test(nameLower)) {
    return BY_KEY.get("products/produce/banana-bunch")!;
  }
  if (/\b(apple|apples|orange|oranges|mango|mangoes|pineapple|avocado|pawpaw|papaya|grape|grapes|watermelon|passion|lemon|lime|fruit|fruits|matunda)\b/.test(nameLower)) {
    return /\b(beverage|drink)\b/.test(catLower)
      ? BY_KEY.get("products/beverages/juice-carton")!
      : BY_KEY.get("products/produce/fruit-basket")!;
  }
  if (/\b(tomato|tomatoes|onion|onions|potato|potatoes|carrot|carrots|cabbage|pepper|peppers|spinach|lettuce|garlic|ginger|cucumber|broccoli|eggplant|okra|vegetable|vegetables|mboga)\b/.test(nameLower) && !/\b(paste|sauce|can|tin|ketchup|puree)\b/.test(nameLower)) {
    return BY_KEY.get("products/produce/vegetable-crate")!;
  }

  // 10. Groceries (Pantry Staples)
  if (/\b(oil|mafuta|sunflower|olive|canola|cooking\s?oil|korie|elianto)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/oil-bottle")!;
  }
  if (/\b(jam|honey|peanut\s?butter|mayonnaise|ketchup|sauce|chutney|pickle|nutella|jar|marmalade|mustard)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/glass-jar")!;
  }
  if (/\b(can|tin|canned|baked\s?beans|tomato\s?paste|sardine|sardines|tuna|corned\s?beef)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/canned-food")!;
  }
  if (/\b(rice|mchele|basmati|grain|lentil|beans|maharage|dengu|peas|5\s?kg|10\s?kg)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/rice-bag")!;
  }
  if (/\b(flour|unga|wheat|maize|sembe|dona|sugar|sukari|salt|baking)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/flour-bag")!;
  }
  if (/\b(chips|crisps|coffee|tea|majani|spice|pilau|masala|clove|cinnamon|nuts|cashew|almond|popcorn|pouch|sachet|snack)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/snack-pouch")!;
  }
  if (/\b(biscuit|biscuits|cookie|cookies|wafer|cracker|oreo|marie|digestive)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/biscuits-pack")!;
  }
  if (/\b(cereal|oats|cornflakes|weetabix|granola|pasta|spaghetti|macaroni|noodle|noodles)\b/.test(nameLower)) {
    return BY_KEY.get("products/groceries/cereal-box")!;
  }

  // Category-level fallback when product name doesn't match a specific keyword
  if (/\b(beverage|drink)\b/.test(catLower)) {
    return BY_KEY.get("products/beverages/soda-bottle")!;
  }
  if (/\b(vegetable|veggie)\b/.test(catLower) && !/\bfruit\b/.test(catLower)) {
    return BY_KEY.get("products/produce/vegetable-crate")!;
  }
  if (/\b(produce|fruit|veg)\b/.test(catLower)) {
    return BY_KEY.get("products/produce/fruit-basket")!;
  }
  if (/\b(dairy)\b/.test(catLower)) {
    return BY_KEY.get("products/dairy/milk-carton")!;
  }
  if (/\b(frozen)\b/.test(catLower)) {
    return BY_KEY.get("products/dairy/frozen-pack")!;
  }
  if (/\b(bakery|bread)\b/.test(catLower)) {
    return BY_KEY.get("products/bakery/bread-loaf")!;
  }
  if (/\b(fish|seafood)\b/.test(catLower) && !/\bmeat\b/.test(catLower)) {
    return BY_KEY.get("products/meat/fish-tray")!;
  }
  if (/\b(meat|butcher|fish|seafood)\b/.test(catLower)) {
    return BY_KEY.get("products/meat/meat-tray")!;
  }
  if (/\b(cosmetic|beauty|personal|care)\b/.test(catLower)) {
    return BY_KEY.get("products/cosmetics/shampoo-bottle")!;
  }
  if (/\b(household|clean)\b/.test(catLower)) {
    return BY_KEY.get("products/household/detergent-jug")!;
  }
  if (/\b(electronic|tech|appliance)\b/.test(catLower)) {
    return BY_KEY.get("products/electronics/electronics-box")!;
  }

  return BY_KEY.get("products/groceries/cereal-box")!;
}

const LEGACY_V1_FALLBACK_KEYS = new Set([
  "products/groceries/cereal-box",
  "products/dairy/frozen-pack",
  "products/groceries/biscuits-pack",
  "products/cosmetics/soap-box",
  "products/cosmetics/shampoo-bottle",
]);

/**
 * Resolve the effective 3D product asset for rendering & forms:
 * - Respects any explicit user-chosen shape stored on `Product.modelAsset`.
 * - Seamlessly upgrades untouched legacy v1.0.0 auto-seeded fallback rows
 *   (e.g. a fruit/bread/meat/detergent product that previously had no dedicated
 *   shape and fell back to `cereal-box` or `frozen-pack`) to its real sculpted
 *   v2.0.0 shape automatically.
 */
export function resolveEffectiveProductAsset(input: {
  name: string;
  categoryName?: string | null;
  storedAssetKey?: string | null;
  storedAssetVersion?: string | null;
}): {
  entry: AssetManifestEntry;
  isExplicit: boolean;
} {
  const autoEntry = resolveProductAsset(input.name, input.categoryName);
  const storedEntry = input.storedAssetKey
    ? BY_KEY.get(input.storedAssetKey)
    : undefined;

  if (!storedEntry || storedEntry.category !== "product") {
    return { entry: autoEntry, isExplicit: false };
  }

  const isLegacyAutoFallback =
    input.storedAssetVersion === "1.0.0" &&
    LEGACY_V1_FALLBACK_KEYS.has(storedEntry.key) &&
    autoEntry.key !== storedEntry.key;

  if (isLegacyAutoFallback) {
    return { entry: autoEntry, isExplicit: false };
  }

  return { entry: storedEntry, isExplicit: true };
}
