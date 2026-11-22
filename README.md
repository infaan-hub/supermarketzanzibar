# Supermarket Zanzibar — 3D Digital Twin Supermarket & Inventory Management System

Full-stack **3D Digital Twin Supermarket**, **3D Warehouse**, **Point of Sale (POS)**, **Code 128 Barcode**, **Visual Stock Counting**, **Procurement (POs / GRN)**, and **Retail Analytics** platform built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Three.js, React Three Fiber, Drei, GSAP, and Prisma ORM on PostgreSQL.

## Quick Start

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
2. Install dependencies, generate Prisma Client, and apply additive migrations:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

3. (Optional) Regenerate the 31 validated glTF 2.0 binary `.glb` store/shelf/product/warehouse models under `public/models/`:

```bash
node scripts/generate_glb_assets.mjs
```

4. Start the development server:

```bash
npm run dev
```

5. If the database has zero admin accounts yet, open `/register` to create the initial **Administrator** account (first-admin bootstrap). Thereafter, admins manage staff accounts from `/users`.
6. Open `/digital-twin` as an `admin` or `manager` and click **Initialize 3D Store & Sync Inventory** to map the 10 retail departments, 18 shelves, 8 warehouse racks (`Zone_A`–`Zone_D`), and all active products using their real PostgreSQL stock quantities.

## Authentication & RBAC

- **JWT Access Tokens** (30m) sent via `Authorization: Bearer <token>`.
- **Rotating Refresh Tokens** (7d) stored in an `HttpOnly`, `SameSite=Lax` cookie (`refresh_token`) with single-flight automatic refresh in `lib/api.ts`.
- **Roles & Multi-Portal Routing:**
  - **Guest (no login)** — Public Supermarket Storefront (`/`) with live catalog & basket, plus read-only 3D Store Tour (`/store-3d`).
  - `admin` — **All Admin pages start with `/admin/`** (`/admin`, `/admin/digital-twin`, `/admin/pos`, `/admin/products`, `/admin/users`, `/admin/settings`, etc.).
  - `marketmaster` / `manager` — Root operational workspace (`/dashboard`, `/digital-twin`, `/pos`, `/products`, `/departments`, `/shelves`, `/warehouse`, `/purchase-orders`, `/goods-received`, `/reports`, `/suppliers`, etc.).
  - `inventory_staff` — Root workspace for 3D Digital Twin & Warehouse inspection, shelf slot assignment (`/shelves`), warehouse-to-shelf restock transfers, goods received (`/goods-received`), expiry batches, and stock counts/adjustments.
  - `cashier` — Root workspace for POS terminal (`/pos`), idempotent checkout synced atomically with 3D shelves, receipts, and store exploration.
  - `supplier` — Dedicated **Supplier Portal (`/supplier/*`)**: `/supplier` (overview), `/supplier/products`, `/supplier/orders`, `/supplier/deliveries`, `/supplier/profile`.
  - `viewer` — read-only exploration of Dashboard (`/dashboard`), 3D Digital Twin (`/digital-twin`), 3D Warehouse (`/warehouse`), Departments, Products, and Categories.
  - `customer` / `driver` — Public storefront (`/`, `/store-3d`) & `/profile`.

## Pages

- `/` — Overview Analytics Dashboard (`Africa/Dar_es_Salaam`) + Expiring Batches, Pending POs, Warehouse Reserve & Department Performance
- `/digital-twin` — Full-screen interactive 3D Digital Twin Supermarket (18 architectural zones, Realistic / Inventory / 3D Heatmap modes, Global 3D Product & Location Finder, live SSE sync, GSAP camera focus & restock animations, Low/Balanced/High quality, and 2D Floorplan fallback)
- `/warehouse` — 3D Warehouse Digital Twin (`Zone_A`–`Zone_D`, `Rack_A01`–`Rack_D02`), direct rack stock intake, and Warehouse → Shelf transfers
- `/departments` — Store department directory with live stock rollups & 3D deep-links
- `/shelves` — Planogram & shelf-slot manager (assign SKUs, manage capacities, restock slots)
- `/purchase-orders` — Multi-line supplier Purchase Orders
- `/goods-received` — Goods Receipt Notes (GRN) with warehouse rack allocation & expiry batch logging
- `/pos` — Unified Split-Screen Point of Sale (barcode scanning + idempotent atomic checkout synced to 3D shelves)
- `/shopping-cart` — Dedicated basket review
- `/sales` & `/sales/[id]` — Order directory, line items, and Cancel & Restock
- `/receipt` & `/receipt/[id]` — Thermal receipt (`58mm`/`80mm`), PNG download, and WhatsApp share
- `/payments` — Payment reconciliation & approval workflow
- `/products` & `/products/[id]` — Product catalogue, editing, margin analytics, and Code 128 pack/carton barcodes
- `/categories` — Category management
- `/stock` & `/stock/movements` — Visual item camera counter, barcode `IN`/`OUT`, Damaged/Lost/Count adjustments, expiry batch tracking, and CSV-exportable movement ledger
- `/barcodes` — Bulk Code 128 shelf & sticker print studio
- `/reports` — End-of-Day Z-Report & Gross Profit Analytics
- `/customers` & `/customers/[id]` — Customer directory & loyalty points
- `/suppliers` & `/suppliers/[id]` — Vendor directory & low-stock reorder queues
- `/users` — Admin user & RBAC management
- `/profile` — User profile & password management
- `/settings` — Store & POS settings + system diagnostics

## Documentation (`docs/`)

- `docs/architecture.md` — Full-stack & 3D engine architecture
- `docs/development-plan.md` — 20-phase execution tracker & verification log
- `docs/database-schema.md` — Additive PostgreSQL / Prisma data model
- `docs/digital-twin.md` — 18-area metric supermarket & warehouse floor plan
- `docs/blender-workflow.md` — Blender 4.x artist asset authoring & replacement workflow
- `docs/3d-assets.md` — Registry of all 31 validated `.glb` models
- `docs/inventory-workflow.md` — Procurement, receiving, rack storage, transfers & expiry batches
- `docs/pos-integration.md` — Atomic idempotent POS checkout & 3D shelf synchronization
- `docs/api-documentation.md` — Complete REST & SSE endpoint reference
- `docs/testing.md` — Automated Vitest suites & live E2E verification checklist
- `docs/deployment.md` — Backup, non-destructive migration, production build & rollback guide

## Verification Commands

```bash
npx prisma validate
npm run typecheck
npm run lint
npm test
npm run build
```
