# Development Plan — 3D Digital Twin Supermarket & Inventory Management System

This document tracks execution, verification evidence, and honest limitations across all 20 phases in strict sequential order.

## Phase Status Tracker

| Phase | Scope | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| 1 | Project audit & architecture | Completed | Audited Next.js 15 / React 19 / Prisma stack; installed compatible Three.js/R3F/Drei/GSAP packages; configured `next.config.ts`; authored `docs/architecture.md`. |
| 2 | Spatial supermarket design | Completed | `lib/digital-twin/spatial-plan.ts` (18 areas, `38m×28m` retail + `38m×16m` annex, 18 shelves, 4 checkouts, 8 warehouse racks); `docs/digital-twin.md`; `tests/digital-twin-spatial.test.ts` (6/6 passed). |
| 3 | Blender modelling & GLB assets | Completed (Baseline GLBs + Blender Script) | Generated 31 spec-valid glTF 2.0 `.glb` files under `public/models/` (`scripts/generate_glb_assets.mjs`) + Blender 4.x artist script (`scripts/blender/build_supermarket_assets.py`); validated by `tests/glb-assets.test.ts`. |
| 4 | 3D rendering engine | Completed | Modular R3F engine under `components/digital-twin/{scene,building,controls,interface}/` with PBR lighting, procedural `<Environment>`, `ContactShadows`, GSAP `CameraControls`, and instanced ceiling LEDs. |
| 5 | Interactive departments & shelves | Completed | Interactive `Department`, `DepartmentNavigation`, `Shelf`, `ShelfProducts`, `ShelfInteraction`, `ProductModel`, `ProductInspection`, and `ProductHighlight` with click focus and right-hand context inspector. |
| 6 | PostgreSQL architecture | Completed | Additive Prisma models (`Store`, `Department`, `Shelf`, `ShelfPosition`, `WarehouseLocation`, `Inventory`, `InventoryBatch`, `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `ThreeDAsset`, `ThreeDObjectMapping`, `AuditLog`) + idempotent migration `prisma/migrations/20261122000000_add_digital_twin_models/migration.sql`; `npx prisma validate` passed. |
| 7 | 3D / database mapping | Completed | `services/digital-twin.service.ts` + `/api/digital-twin`, `/api/digital-twin/mappings` connecting every 3D object via `ThreeDObjectMapping` to real PostgreSQL quantities (zero mock/random stock). |
| 8 | Inventory management (POs, GRN, transfers, batches) | Completed | APIs & pages for `/departments`, `/shelves`, `/purchase-orders`, `/goods-received`, `/api/batches`, `/api/stock/adjustments` (`DAMAGED`/`LOST`/`EXPIRED`/`COUNT`), and `/api/digital-twin/transfer`. |
| 9 | POS integration & shelf synchronization | Completed | `app/api/checkout/route.ts` and `app/api/sales/[id]/route.ts` atomically sync `ShelfPosition` + warehouse `Inventory` inside Prisma `$transaction` and broadcast post-commit SSE events. |
| 10 | 3D warehouse digital twin | Completed | `WarehouseScene` + `WarehouseRack` (`Zone_A`–`Zone_D`, `Rack_A01`–`Rack_D02`), `/api/warehouse`, and `/warehouse` page with embedded 3D warehouse, rack stock intake, and Warehouse → Shelf transfers. |
| 11 | Management dashboard & full-screen twin UI | Completed | Full-screen `/digital-twin` workspace (`DigitalTwinWorkspace.tsx`), updated light aqua/teal enterprise UI, enhanced Overview dashboard (`DigitalTwinOperations`), and role-filtered 17+ item sidebar navigation. |
| 12 | Real-time synchronization (SSE) | Completed | `lib/realtime/event-bus.ts`, `app/api/realtime/events/route.ts` (authenticated SSE with heartbeats), and `hooks/useDigitalTwinRealtime.ts` refreshing scene state without remounting `<Canvas>`. |
| 13 | GSAP restocking animations | Completed | Post-commit GSAP restocking pulse/lift animation in `ProductModel.tsx` triggered exclusively after committed `stock_transferred` transfers. |
| 14 | 3D inventory heatmap | Completed | `classifyInventoryState` + `heatmapColorForState` (Green/Amber/Red/Grey) with department, stock-status, and warehouse-zone filters plus accessible legend in `InventoryOverlay.tsx`. |
| 15 | Global product search & 3D locator | Completed | `GET /api/digital-twin/locate?q=` + `SceneToolbar` search box resolving product name, SKU, barcode, category, shelf code, and warehouse rack with instant GSAP camera focus. |
| 16 | Authentication & permissions (RBAC + Audit) | Completed | Added `inventory_staff` & `viewer` roles in `lib/auth/roles.ts`, server guards (`requireExplorer`, `requirePos`, `requireInventory`, `requireManager`, `requireAdmin`) in `lib/auth/request.ts`, and `AuditLog` tracking (`lib/audit.ts`). |
| 17 | Data reliability & concurrency | Completed | Per-checkout `idempotencyKey` replay protection (`hooks/usePosCart.ts` + `/api/checkout`), conditional atomic stock decrements (`quantity: { gte }`), Prisma transactions, `WebGLErrorBoundary`, and SSE auto-reconnect. |
| 18 | Performance optimization & 2D fallback | Completed | Dynamic `ssr: false` import of `SupermarketScene`, `InstancedMesh` ceiling fixtures, `Low` / `Balanced` / `High` DPR & shadow controls, and full `FloorPlan2DFallback` interactive SVG view. |
| 19 | Functional & automated testing | Completed | 6 Vitest suites (39/39 tests passing), `npx prisma validate`, `npm run typecheck` (0 errors), `npm run lint` (0 errors, 0 warnings), and production `npm run build` verified. |
| 20 | Production delivery & documentation | Completed | Delivered all 11 documentation files under `docs/` and updated `README.md` with migration, backup, asset, and verification instructions. |

## Honest Limitations & Next Operational Steps

1. **Blender CLI Availability:** Blender was not installed on this development machine. All 31 `.glb` assets under `public/models/` are valid, proportionally scaled glTF 2.0 procedural baseline models generated by `scripts/generate_glb_assets.mjs`, paired with `scripts/blender/build_supermarket_assets.py` so a 3D artist can export drop-in photorealistic replacements without code changes.
2. **Live Database Migration & E2E Tests:** No live `.env` / PostgreSQL connection string is stored in the local sandbox. Before first production launch:
   - Run a PostgreSQL backup (`python scripts/backup_postgres.py` or `pg_dump`).
   - Run `npx prisma migrate deploy` against the target PostgreSQL database.
   - Sign in as `admin` or `manager`, open `/digital-twin`, and click **Initialize 3D Store & Sync Inventory**.
3. **Browser GPU Profiling:** WebGL rendering and frame-rate profiling across `Low`/`Balanced`/`High` modes should be visually verified in a live desktop/mobile browser after starting `npm run dev` or deploying.
