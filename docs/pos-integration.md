# POS Integration & 3D Synchronization

This document specifies how the Point of Sale (`/pos`) stays atomically synchronized with PostgreSQL inventory and the live 3D Digital Twin (`/digital-twin`).

## 1. Atomic Checkout Pipeline (`POST /api/checkout`)

1. **RBAC Guard**: Only `admin`, `manager`, and `cashier` roles (`requirePos`) can complete POS sales.
2. **Idempotency Protection (Phase 17)**:
   - `hooks/usePosCart.ts` attaches a unique `idempotencyKey` (`pos-<uuid>`) per checkout attempt.
   - Before mutating stock, `POST /api/checkout` checks `Sale.idempotencyKey`. If already processed, it replays the stored receipt (`idempotentReplay: true`) without double-charging or deducting stock twice.
3. **Authoritative Server Pricing**: Line prices, discounts, and taxes are calculated from PostgreSQL `Product.price` using `Prisma.Decimal`. Client-supplied totals are ignored.
4. **Transactional Stock & 3D Shelf Sync**:
   - Inside a single `prisma.$transaction`:
     - Conditional `product.updateMany({ where: { id, isActive: true, quantity: { gte: qty } }, data: { quantity: { decrement: qty } } })` prevents overselling under concurrent cashier traffic.
     - `syncTwinDeductionInTx(tx, productId, qty)` deducts sold units from mapped retail `ShelfPosition` slots first (highest-stocked slot first), spilling over to warehouse `Inventory` if shelf facings were lower than total stock.
     - Records `Sale`, `SaleItem[]`, `Payment`, `Customer.loyaltyPoints` (if linked), and `StockMovement` (`OUT`, `performedById`, `reference: SALE-<id>`).
5. **Post-Commit Broadcast**:
   - Strictly **after** PostgreSQL commits, `recordAuditLog` writes `POS_SALE_COMPLETED` and `publishInventoryEvent({ type: "sale_completed", ... })` notifies all connected 3D Digital Twin sessions over Server-Sent Events (`/api/realtime/events`).

## 2. Sale Cancellation & Restock (`PATCH /api/sales/[id]`)

When a Manager or Administrator cancels a non-cancelled sale:
- `Product.quantity` is incremented back atomically.
- Mapped `ShelfPosition` slots (up to `maximumCapacity`) and warehouse `Inventory` spillover are restored inside the same transaction.
- Payment status is updated to `refunded`, a `StockMovement` (`IN`) and `AuditLog` (`SALE_CANCELLED_RESTOCKED`) are written, and `sale_cancelled` is published over SSE so the 3D scene refreshes live.

## 3. Live Visual Impact in 3D

When a sale completes on `/pos`:
- Any open `/digital-twin` or `/warehouse` tab receives the SSE `sale_completed` event and refreshes its snapshot **without reloading or remounting the WebGL `<Canvas>`**.
- Visible product facings on the affected shelf immediately drop to match the new `ShelfPosition.quantity`.
- Shelves crossing `reorderLevel` or reaching `0` automatically transition to Amber (`low`) or Red/Grey (`out`) in Inventory and Heatmap modes.
