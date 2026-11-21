# Inventory & Warehouse Workflow

This document explains the end-to-end operational inventory flows across **Supermarket Zanzibar**, PostgreSQL, and the **3D Digital Twin Supermarket & Warehouse**.

## 1. Real Stock Integrity Guarantees

- **Zero mock or random inventory**: Every unit displayed on a 3D retail shelf (`ShelfPosition`) or warehouse pallet rack (`Inventory` at a `WarehouseLocation`) maps to real PostgreSQL rows.
- **No negative stock**: All stock deductions use conditional atomic updates (`quantity: { gte: units }`) inside Prisma `$transaction` blocks.
- **Full audit trail**: Every adjustment, transfer, purchase order, goods receipt, and POS checkout writes a `StockMovement` row and an `AuditLog` entry with the acting user's ID.

## 2. Procurement to Shelf Lifecycle

```text
Supplier -> Purchase Order (/purchase-orders)
         -> Goods Received Note (/goods-received)
            ├─ Increments Product.quantity
            ├─ Increments Warehouse Inventory at selected Rack/Level/Position
            ├─ Creates InventoryBatch with batchNumber + expiryDate
            ├─ Records StockMovement (IN) & AuditLog
            └─ Emits SSE "goods_received" -> 3D Warehouse updates live
         -> Warehouse-to-Shelf Restock (/warehouse, /shelves, or 3D Inspector)
            ├─ Conditional decrement of Warehouse Inventory
            ├─ Increment of ShelfPosition.quantity (capped at maximumCapacity)
            ├─ Records StockMovement (TRANSFER) & AuditLog
            └─ Emits SSE "stock_transferred" -> GSAP post-commit restock animation in 3D
         -> POS Sale (/pos)
            ├─ Idempotent checkout check (idempotencyKey)
            ├─ Conditional decrement of Product.quantity
            ├─ Atomic ShelfPosition deduction (+ warehouse spillover if needed)
            ├─ Records StockMovement (OUT) & AuditLog
            └─ Emits SSE "sale_completed" -> 3D Shelf facings & Heatmap update live
```

## 3. Stock Adjustments, Physical Counts & Expiry Batches

Available on `/stock` (via `POST /api/stock/adjustments` and `/api/batches`):

| Operation | Behavior |
|---|---|
| `DAMAGED` / `LOST` / `EXPIRED` | Atomically deducts `Product.quantity` and synced shelf/warehouse slots, never below 0. |
| `COUNT` | Reconciles physical count against PostgreSQL, computing exact delta (`COUNT` movement). |
| `ADJUSTMENT_IN` / `ADJUSTMENT_OUT` | Controlled manual stock correction with mandatory audit reason. |
| **Expiry Batches** | Tracked in `InventoryBatch` (`expiryDate`, `batchNumber`, `status`). Batches expiring within 14 days appear on the Overview dashboard; expired active batches flag shelf slots red (`expired`) in the 3D Inventory State and Heatmap views. |

## 4. Visual Camera Counter & Barcode Terminal

All pre-existing `/stock` workflows remain preserved:
- Barcode-free visual item camera counting (`VisualItemCameraCounter`) to register new products with auto-generated Code 128 barcodes.
- High-speed Code 128 / EAN barcode scanning (`POST /api/stock/movements`) for package-multiplier `IN` / `OUT` movements, now synchronized with 3D Digital Twin state and SSE events.
