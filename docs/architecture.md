# System Architecture — Supermarket Zanzibar 3D Digital Twin & Inventory System

## 1. Phase 1 Repository Audit Summary

### Existing Stack Verified (`E:\supermarketzanzibar`)
- **Framework:** Next.js `15.5.27` (App Router), React `19.2.0`, TypeScript `5.9.0` (`strict: true`), Tailwind CSS `4.3.3`.
- **Database:** Neon PostgreSQL via Prisma ORM `6.19.3` preserving existing Django table names (`supermarketzanzibar_*`) plus `supermarketzanzibar_productbarcode` and `refresh_token`.
- **Existing Pages (25):** `/`, `/pos`, `/shopping-cart`, `/sales`, `/sales/[id]`, `/receipt`, `/receipt/[id]`, `/payments`, `/products`, `/products/[id]`, `/categories`, `/stock`, `/stock/movements`, `/barcodes`, `/reports`, `/customers`, `/customers/[id]`, `/suppliers`, `/suppliers/[id]`, `/users`, `/profile`, `/settings`, `/login`, `/register`, `/unauthorized`.
- **Existing API Routes (32):** Full REST surface with JWT Bearer access tokens (30m) + rotating `HttpOnly` refresh cookies (7d), single-flight client auto-refresh (`lib/api.ts`), and server-side RBAC guards (`lib/auth/request.ts`, `lib/auth/roles.ts`).
- **Existing Capabilities Preserved:** Code 128 barcode scanning/printing (`bwip-js`, `@zxing/browser`), visual camera item counter (`lib/visual-item-detection.ts`), transactional checkout with server-side DB pricing and conditional stock deduction, East Africa timezone (`Africa/Dar_es_Salaam`) analytics & Z-Reports.

### Identified Three.js / Next.js Integration Considerations
1. **React 19 Compatibility:** `@react-three/fiber@9.x`, `@react-three/drei@10.x`, and `@react-three/postprocessing@3.x` are required for React 19 (older v8/v9 versions fail peer dependency resolution).
2. **SSR Isolation:** All WebGL/Three.js components (`Canvas`, `OrbitControls`, `useGLTF`, `EffectComposer`) must be client-only (`"use client"`) and loaded via `next/dynamic(..., { ssr: false })` inside a React Error Boundary + WebGL availability guard with a 2D floor-plan fallback.
3. **ESM Transpilation:** `transpilePackages: ["three"]` configured in `next.config.ts`.
4. **Prisma Non-Destructive Evolution:** Production PostgreSQL tables (`supermarketzanzibar_*`) are strictly preserved; all new Digital Twin, Warehouse, Procurement, Batch/Expiry, and Audit tables are **purely additive** with `IF NOT EXISTS` SQL migrations.

---

## 2. Target High-Level Architecture

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         Next.js 15 App Router UI                         │
│  ┌────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐ │
│  │ Management Pages   │  │ 3D Digital Twin     │  │ POS Terminal       │ │
│  │ Dashboard, Reports,│  │ Store & Warehouse   │  │ Scanner, Live Cart,│ │
│  │ POs, GRN, Shelves  │  │ (R3F + Drei + GSAP) │  │ Checkout, Receipts │ │
│  └─────────┬──────────┘  └──────────┬──────────┘  └─────────┬──────────┘ │
│            │                        │                       │            │
│            └────────────┬───────────┴───────────┬───────────┘            │
│                         ▼                       ▼                        │
│               Typed API Client          SSE Realtime Client              │
│          (lib/api.ts + auto-refresh)   (useDigitalTwinRealtime)          │
└─────────────────────────┬───────────────────────┬────────────────────────┘
                          │ HTTP/JSON (Bearer)    │ EventSource (SSE)
┌─────────────────────────▼───────────────────────▼────────────────────────┐
│                       Next.js Route Handlers                             │
│  • RBAC Guards (admin, manager, cashier, inventory_staff, viewer, ...)   │
│  • Zod Validation + Idempotency Keys + Atomic Prisma Transactions        │
│  • In-process Realtime Event Bus (emits post-commit inventory deltas)    │
│  • Audit Logging on sensitive mutations                                  │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL (Neon) via Prisma ORM                     │
│  Existing Core: User, Category, Supplier, Customer, Product,             │
│    ProductBarcode, Sale, SaleItem, StockMovement, Payment, RefreshToken  │
│  Digital Twin & Operations (Additive):                                   │
│    Store, Department, Shelf, ShelfPosition, WarehouseLocation,           │
│    Inventory, InventoryBatch, PurchaseOrder, PurchaseOrderItem,          │
│    GoodsReceipt, ThreeDAsset, ThreeDObjectMapping, AuditLog              │
└──────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ GLB / PBR Textures
┌─────────────────────────────────────┴────────────────────────────────────┐
│  public/models/ (Validated glTF 2.0 .glb assets) + public/textures/      │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. Core Design Invariants
1. **Database Single Source of Truth:** No random or hardcoded inventory counts. Every 3D shelf slot and warehouse rack cell renders real PostgreSQL state.
2. **Explicit Persistent Identity:** Every interactive 3D mesh maps via `ThreeDObjectMapping` (`objectName` -> `linkedEntityType` + `linkedEntityId`), never by display label alone.
3. **Post-Commit Animation Only:** GSAP restock/transfer animations trigger only after the backing database transaction commits and emits a verified change event.
4. **Enterprise Design Direction:** Clean white & light aqua surfaces with crisp teal/emerald actions for dashboard UI, paired with physically based lighting and realistic supermarket materials inside the 3D WebGL viewport.
