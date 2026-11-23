// Verified 3D GLB asset manifest for Supermarket Zanzibar.
//
// Every entry maps strictly to an existing validated binary glTF 2.0 (.glb)
// asset generated under `public/models/`. Never add a path here without
// generating or placing the corresponding asset on disk.

export type AssetCategory = "supermarket" | "department" | "furniture" | "product";

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

  // Products — Beverages
  { key: "products/beverages/soda-can", name: "Soda Can (330ml)", category: "product", path: "/models/products/beverages/soda-can.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.6, 1.6, 1.6] },
  { key: "products/beverages/soda-bottle", name: "Soft Drink Bottle (1L)", category: "product", path: "/models/products/beverages/soda-bottle.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.3, 1.3, 1.3] },
  { key: "products/beverages/water-bottle", name: "Mineral Water Bottle", category: "product", path: "/models/products/beverages/water-bottle.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.3, 1.3, 1.3] },
  { key: "products/beverages/juice-carton", name: "Fruit Juice Carton (1L)", category: "product", path: "/models/products/beverages/juice-carton.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.35, 1.35, 1.35] },

  // Products — Groceries
  { key: "products/groceries/rice-bag", name: "Rice Bag (5kg)", category: "product", path: "/models/products/groceries/rice-bag.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [0.96, 0.92, 0.96] },
  { key: "products/groceries/flour-bag", name: "Flour Bag (2kg)", category: "product", path: "/models/products/groceries/flour-bag.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.2, 1.2, 1.2] },
  { key: "products/groceries/oil-bottle", name: "Cooking Oil Bottle (2L)", category: "product", path: "/models/products/groceries/oil-bottle.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.2, 1.2, 1.2] },
  { key: "products/groceries/cereal-box", name: "Cereal Box", category: "product", path: "/models/products/groceries/cereal-box.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.15, 1.15, 1.15] },
  { key: "products/groceries/biscuits-pack", name: "Biscuits Pack", category: "product", path: "/models/products/groceries/biscuits-pack.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.5, 1.5, 1.5] },
  { key: "products/groceries/canned-food", name: "Canned Food Tin", category: "product", path: "/models/products/groceries/canned-food.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.6, 1.6, 1.6] },

  // Products — Dairy & Frozen
  { key: "products/dairy/milk-carton", name: "Fresh Milk Carton (1L)", category: "product", path: "/models/products/dairy/milk-carton.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.35, 1.35, 1.35] },
  { key: "products/dairy/frozen-pack", name: "Frozen Food Pack", category: "product", path: "/models/products/dairy/frozen-pack.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.3, 1.3, 1.3] },

  // Products — Cosmetics & Personal Care
  { key: "products/cosmetics/soap-box", name: "Soap Bar Box", category: "product", path: "/models/products/cosmetics/soap-box.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.7, 1.7, 1.7] },
  { key: "products/cosmetics/toothpaste-box", name: "Toothpaste Box", category: "product", path: "/models/products/cosmetics/toothpaste-box.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.5, 1.5, 1.5] },
  { key: "products/cosmetics/shampoo-bottle", name: "Shampoo Bottle", category: "product", path: "/models/products/cosmetics/shampoo-bottle.glb", format: "glb", version: "1.0.0", source: "procedural-glb", defaultScale: [1.4, 1.4, 1.4] },
];

const BY_KEY = new Map(ASSET_MANIFEST.map((entry) => [entry.key, entry]));

export function getAssetEntry(key: string): AssetManifestEntry | undefined {
  return BY_KEY.get(key);
}

/**
 * Deterministic reusable product 3D model selector based on product name &
 * category so every real PostgreSQL product renders a recognizable 3D shape.
 */
export function resolveProductAsset(
  productName: string,
  categoryName?: string | null,
): AssetManifestEntry {
  const haystack = `${productName} ${categoryName ?? ""}`.toLowerCase();

  if (/\b(cola|coke|soda|fanta|sprite|pepsi)\b/.test(haystack)) {
    return haystack.includes("can")
      ? BY_KEY.get("products/beverages/soda-can")!
      : BY_KEY.get("products/beverages/soda-bottle")!;
  }
  if (/\b(water|aqua|kilimanjaro|uhai)\b/.test(haystack)) {
    return BY_KEY.get("products/beverages/water-bottle")!;
  }
  if (/\b(juice|mango|orange|nectar)\b/.test(haystack)) {
    return BY_KEY.get("products/beverages/juice-carton")!;
  }
  if (/\b(milk|yogurt|dairy|cream)\b/.test(haystack)) {
    return BY_KEY.get("products/dairy/milk-carton")!;
  }
  if (/\b(frozen|ice|fish|chicken|meat)\b/.test(haystack)) {
    return BY_KEY.get("products/dairy/frozen-pack")!;
  }
  if (/\b(rice|mchele|grain|beans|sugar)\b/.test(haystack)) {
    return BY_KEY.get("products/groceries/rice-bag")!;
  }
  if (/\b(flour|unga|wheat|maize)\b/.test(haystack)) {
    return BY_KEY.get("products/groceries/flour-bag")!;
  }
  if (/\b(oil|mafuta|sunflower|olive)\b/.test(haystack)) {
    return BY_KEY.get("products/groceries/oil-bottle")!;
  }
  if (/\b(cereal|oats|cornflakes|pasta)\b/.test(haystack)) {
    return BY_KEY.get("products/groceries/cereal-box")!;
  }
  if (/\b(biscuit|cookie|snack|bread|bakery)\b/.test(haystack)) {
    return BY_KEY.get("products/groceries/biscuits-pack")!;
  }
  if (/\b(can|tin|tomato|beans|tuna)\b/.test(haystack)) {
    return BY_KEY.get("products/groceries/canned-food")!;
  }
  if (/\b(soap|detergent|sabuni)\b/.test(haystack)) {
    return BY_KEY.get("products/cosmetics/soap-box")!;
  }
  if (/\b(toothpaste|colgate|dental)\b/.test(haystack)) {
    return BY_KEY.get("products/cosmetics/toothpaste-box")!;
  }
  if (/\b(shampoo|lotion|cosmetic|perfume|cream)\b/.test(haystack)) {
    return BY_KEY.get("products/cosmetics/shampoo-bottle")!;
  }
  if (/\b(beverage|drink)\b/.test(haystack)) {
    return BY_KEY.get("products/beverages/soda-bottle")!;
  }

  return BY_KEY.get("products/groceries/cereal-box")!;
}
