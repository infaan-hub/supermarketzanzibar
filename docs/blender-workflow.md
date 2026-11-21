# Blender 3D Modelling & Optimization Workflow

## Current Asset Status (Honest Disclosure)
Blender CLI is not installed on the CI/development host where this repository was generated. To keep the 3D Digital Twin immediately runnable with **real, spec-valid glTF 2.0 binary `.glb` assets** (and zero broken model references), Phase 3 provides two coordinated pipelines:

1. **Active Runtime Assets (`scripts/generate_glb_assets.mjs`):** Deterministically builds all 31 binary `.glb` assets under `public/models/` with PBR materials, vertex normals, UVs, accurate bounding boxes, and required named nodes. These serve as clean, proportionally accurate baseline/development models.
2. **Artist Refinement Pipeline (`scripts/blender/build_supermarket_assets.py`):** Blender 4.x headless Python template exporting drop-in `.glb` replacements into the exact same `public/models/` paths so artists can upgrade any mesh with sculpted silhouettes, Substance 3D Painter textures, or Poly Haven / ambientCG PBR maps without modifying React/Three.js code.

## Mandatory Blender Export Standards
1. **Units & Scale:** Metric (`1.0 unit = 1.0 meter`), apply transforms (`Ctrl+A -> Rotation & Scale`) before export.
2. **Origin Placement:** Object origin at floor-contact center `(0, 0, 0)` so every shelf, rack, and product lands cleanly without floating.
3. **Node Naming Contract:**
   - Shelves must retain `Frame`, `Top_Shelf`, `Middle_Shelf_Upper`, `Middle_Shelf_Lower`, `Bottom_Shelf`, `Shelf_Labels`, and `Product_Position_XX`.
   - Warehouse racks must retain `Upright_Left`, `Upright_Right`, `Level_01..03`, and `Position_001..003`.
4. **Polygon Budgets:**
   - Individual product SKUs: `<= 600` triangles (rendered with instancing/cloning across shelves).
   - Gondolas / refrigerators / checkout lanes: `<= 4,500` triangles.
   - Structural building shell: `<= 8,000` triangles.
5. **Post-Export Validation & Compression:**
   - Run `npx @gltf-transform/cli optimize input.glb output.glb --compress meshopt --texture-compress webp` for artist-textured models.
   - Validate with Khronos glTF Validator and `npm test` (`tests/glb-assets.test.ts`).
