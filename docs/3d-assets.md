# 3D Assets Catalog (`public/models/`)

All 31 `.glb` assets are indexed in [lib/digital-twin/asset-manifest.ts](../lib/digital-twin/asset-manifest.ts) and verified automatically by `tests/glb-assets.test.ts`.

## Directory Layout
- `public/models/supermarket/`: `building.glb`, `floor.glb`, `ceiling.glb`, `lighting.glb`
- `public/models/departments/`: `beverages.glb`, `groceries.glb`, `bakery.glb`, `cosmetics.glb`, `electronics.glb`, `frozen-food.glb`
- `public/models/furniture/`: `shelf.glb`, `refrigerator.glb`, `checkout.glb`, `shopping-cart.glb`, `basket.glb`, `warehouse-rack.glb`
- `public/models/products/beverages/`: `soda-can.glb`, `soda-bottle.glb`, `water-bottle.glb`, `juice-carton.glb`
- `public/models/products/groceries/`: `rice-bag.glb`, `flour-bag.glb`, `oil-bottle.glb`, `cereal-box.glb`, `biscuits-pack.glb`, `canned-food.glb`
- `public/models/products/dairy/`: `milk-carton.glb`, `frozen-pack.glb`
- `public/models/products/cosmetics/`: `soap-box.glb`, `toothpaste-box.glb`, `shampoo-bottle.glb`

## Regenerating Baseline GLBs
```bash
node scripts/generate_glb_assets.mjs
npm test
```

## Replacing with Artist-Painted Blender Models
Export your `.glb` from Blender (Y-up, metric meters, origin at base center) over the target file path in `public/models/`, keeping the required node names listed in `lib/digital-twin/asset-manifest.ts`, then run `npm test` to confirm structural glTF 2.0 compliance.
