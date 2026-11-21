# API Documentation

All protected API routes require a valid JWT access token (`Authorization: Bearer <token>`), issued via `POST /api/auth/login` and rotated with HTTP-only refresh cookies (`POST /api/auth/refresh`).

## 1. Digital Twin & Real-Time Sync

| Method & Endpoint | Roles | Purpose |
|---|---|---|
| `GET /api/digital-twin` | `EXPLORE_ROLES` (`admin`, `manager`, `cashier`, `inventory_staff`, `supplier`, `viewer`) | Returns the live `DigitalTwinSnapshot` (Store, 10 Departments, 18 Shelves, ShelfPositions, WarehouseRacks, ThreeDObjectMappings, and summary KPIs). |
| `POST /api/digital-twin` | `MANAGER_ROLES` (`admin`, `manager`) | Idempotently initializes Store, Departments, Shelves, WarehouseLocations (`Zone_A`–`Zone_D`), all 31 GLB `ThreeDAsset` rows, `ThreeDObjectMapping` rows, and maps real `Product` stock. |
| `GET /api/digital-twin/locate?q=` | `EXPLORE_ROLES` | Global 3D search across product names, SKUs, barcodes, categories, shelf codes, and warehouse racks. Returns camera coordinates & selection targets. |
| `GET /api/digital-twin/mappings` | `EXPLORE_ROLES` | Lists persistent `ThreeDObjectMapping` records and registered `ThreeDAsset` files. |
| `POST /api/digital-twin/mappings` | `MANAGER_ROLES` | Zod-validated upsert of a `ThreeDObjectMapping` with audit logging & SSE refresh. |
| `POST /api/digital-twin/transfer` | `INVENTORY_ROLES` (`admin`, `manager`, `inventory_staff`, `supplier`) | Atomic Warehouse → Shelf transfer (`shelfPositionId`, optional `warehouseLocationId`, `quantity`, `notes`). Emits post-commit `stock_transferred` SSE event. |
| `GET /api/realtime/events` | `EXPLORE_ROLES` | Server-Sent Events (`text/event-stream`) feed authenticating via `Authorization` header or `?token=<accessToken>`. Emits `connected` and `inventory` events plus 20s heartbeats. |

## 2. Departments, Shelves & Warehouse

| Method & Endpoint | Roles | Purpose |
|---|---|---|
| `GET /api/departments` | `EXPLORE_ROLES` | Lists retail departments with real shelf, SKU, unit, low-stock, and out-of-stock totals. |
| `POST /api/departments` | `MANAGER_ROLES` | Creates a new store department (`code`, `name`, `description`). |
| `PATCH /api/departments/[id]` | `MANAGER_ROLES` | Updates department name, description, or status. |
| `GET /api/shelves` | `EXPLORE_ROLES` | Lists shelves and their `positions` (filterable via `?department=CODE`). |
| `POST /api/shelves` | `MANAGER_ROLES` | Creates a new shelf fixture with addressable `POS_01..N` slots. |
| `PATCH /api/shelves/positions/[id]` | `INVENTORY_ROLES` | Assigns/unassigns a product, updates `maximumCapacity` / `reorderLevel` / `reservedQuantity`, and updates `ThreeDObjectMapping`. |
| `GET /api/warehouse` | `EXPLORE_ROLES` | Lists warehouse zone rollups (`Zone_A`–`Zone_D`) and every rack/level/position cell (`?zone=`, `?rack=`). |
| `POST /api/warehouse` | `INVENTORY_ROLES` | Receives stock directly into a specific warehouse rack cell with optional `batchNumber` & `expiryDate`. |

## 3. Procurement, Goods Receiving, Batches & Adjustments

| Method & Endpoint | Roles | Purpose |
|---|---|---|
| `GET /api/purchase-orders` | `INVENTORY_ROLES` | Lists purchase orders with supplier info, progress per line item, and receipt counts. |
| `POST /api/purchase-orders` | `MANAGER_ROLES` | Creates a multi-line supplier PO with server-calculated `Decimal` totals. |
| `GET /api/purchase-orders/[id]` | `INVENTORY_ROLES` | Detailed single PO with items and linked goods receipts. |
| `PATCH /api/purchase-orders/[id]` | `MANAGER_ROLES` | Updates PO status (`draft`, `ordered`, `partially_received`, `received`, `cancelled`). |
| `GET /api/goods-received` | `INVENTORY_ROLES` | Lists Goods Receipt Notes (GRN) with warehouse rack & receiving actor. |
| `POST /api/goods-received` | `INVENTORY_ROLES` | Atomic goods receipt: updates PO items & PO status, increments `Product.quantity` & warehouse `Inventory`, creates `InventoryBatch`, logs `StockMovement` + `AuditLog`, broadcasts SSE. |
| `GET /api/batches` | `INVENTORY_ROLES` | Lists tracked `InventoryBatch` rows (`?filter=expiring` or `?filter=expired`). |
| `POST /api/batches` | `INVENTORY_ROLES` | Logs a new product batch with expiry date & optional warehouse location. |
| `POST /api/stock/adjustments` | `INVENTORY_ROLES` | Transactional `DAMAGED`, `LOST`, `EXPIRED`, `COUNT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT` with non-negative enforcement & 3D sync. |

## 4. Core Preserved Endpoints

All existing routes remain intact and operational:
- Auth: `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/register`, `/api/auth/me`, `/api/auth/change-password`
- Catalog & Barcodes: `/api/products`, `/api/products/[id]`, `/api/products/[id]/image`, `/api/products/[id]/barcodes`, `/api/barcodes/all`, `/api/barcodes/label`, `/api/barcodes/[code]`, `/api/categories`, `/api/categories/[id]`
- POS & Sales: `/api/checkout` (upgraded with `requirePos`, `idempotencyKey`, and atomic 3D shelf sync), `/api/sales`, `/api/sales/[id]`, `/api/payments`, `/api/payments/[id]`
- Stock & Operations: `/api/stock`, `/api/stock/movements`, `/api/customers`, `/api/customers/[id]`, `/api/suppliers`, `/api/suppliers/[id]`, `/api/users`, `/api/users/[id]`
- Analytics & Settings: `/api/dashboard/overview` (extended with `operations` rollups), `/api/dashboard/stats`, `/api/reports`, `/api/settings` (admin diagnostics & DB connectivity check)
