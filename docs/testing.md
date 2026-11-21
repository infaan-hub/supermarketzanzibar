# Testing & Verification Strategy

This document records the automated test suites, verification commands, and honest testing boundaries for the 3D Digital Twin Supermarket & Inventory Management System.

## 1. Verification Commands

Run all checks from the project root (`E:\supermarketzanzibar`):

```powershell
# 1. Validate Prisma schema (pass DATABASE_URL if running offline without .env)
$env:DATABASE_URL = "postgresql://placeholder:placeholder@localhost:5432/supermarketzanzibar"
npx prisma validate

# 2. Strict TypeScript check
npm run typecheck

# 3. ESLint static analysis
npm run lint

# 4. Vitest automated test suites
npm test

# 5. Production Next.js build (verifies App Router pages, dynamic imports, and Route Handlers)
npm run build
```

## 2. Automated Test Suites (`tests/`)

| Test File | Coverage |
|---|---|
| `tests/digital-twin-spatial.test.ts` | Verifies all 18 physical store areas exist, non-overlapping floor footprint bounds, realistic human-scale aisle clearances, 18 retail fixtures, 8 warehouse racks (`Zone_A`–`Zone_D`), and deterministic shelf/warehouse slot world coordinates. |
| `tests/glb-assets.test.ts` | Validates every `.glb` entry in `ASSET_MANIFEST` exists on disk under `public/models/`, parses binary glTF 2.0 headers (`magic === 0x46546C67`, `version === 2`), checks JSON & BIN chunks, meshes, PBR materials, and verifies required structural node names (`Frame`, `Top_Shelf`, `Bottom_Shelf`, `Shelf_Labels`, `Product_Position_01..06`, `Level_01..03`). |
| `tests/digital-twin-logic.test.ts` | Tests all 6 inventory state classifications (`normal`, `low`, `out`, `expired`, `reserved`, `restocking`), accessible heatmap hex colors, product-to-GLB asset resolution across all categories, and real-time SSE pub/sub delivery & cleanup. |
| `tests/rbac-and-settings.test.ts` | Verifies role normalization and route access rules across `admin`, `manager`, `cashier`, `inventory_staff`, `viewer`, `supplier`, `driver`, and `customer`, including `/digital-twin`, `/warehouse`, `/departments`, `/shelves`, `/purchase-orders`, `/goods-received`, `/pos`, `/reports`, `/users`, plus store settings sanitization and TZS receipt formatting. |
| `tests/dashboard-timezone.test.ts` | Verifies Africa/Dar_es_Salaam business timezone bucketing for `today`, `week`, `month`, and `year` periods. |
| `tests/visual-item-detection.test.ts` | Verifies camera visual item counter motion-stability and debounce detection logic. |

## 3. Manual End-to-End Verification Checklist (With Live PostgreSQL)

Once `DATABASE_URL` points to your PostgreSQL instance and `npx prisma migrate deploy` has run:

1. **Initialize Store Twin**: Sign in as `admin` or `manager`, open `/digital-twin`, and click **Initialize 3D Store & Sync Inventory**. Confirm 10 departments, 18 shelves, and 8 warehouse racks appear with real `Product.quantity` totals.
2. **3D Navigation & Inspection**: Click department signs, shelves, individual product models, and warehouse racks. Verify smooth GSAP camera focus and accurate PostgreSQL counts in the right-hand inspector.
3. **POS ↔ 3D Live Sync**: Open `/digital-twin` in Tab A and `/pos` in Tab B. Complete a checkout in Tab B. Confirm Tab A receives the `sale_completed` SSE event, updates the shelf count without reloading the 3D scene, and updates Heatmap colors if stock crosses `reorderLevel`.
4. **Warehouse → Shelf Restock Animation**: Transfer units from a warehouse rack to a shelf position via `/warehouse` or the 3D inspector. Confirm warehouse stock decreases, shelf stock increases, `StockMovement` (`TRANSFER`) is logged, and the GSAP restock pulse plays post-commit.
5. **Procurement Flow**: Create a PO on `/purchase-orders`, receive it on `/goods-received` into `Rack_A01` with a batch number and expiry date, and verify the rack count and `/stock` expiry ledger update immediately.
6. **WebGL Fallback & Quality**: Toggle **Low / Balanced / High** graphics quality and **2D Floorplan** mode to confirm responsive operation on low-power devices.

## 4. Honest Limitations

- Live PostgreSQL transaction/concurrency integration tests are not executed in the offline sandbox because no live `.env` / `DATABASE_URL` is configured locally. All transaction guards, conditional stock decrements, and idempotency paths are statically type-checked against Prisma Client and verified by schema validation + build.
- Browser WebGL rendering and GPU frame-rate profiling should be verified visually in Chrome/Edge DevTools after running `npm run dev` or deploying.
