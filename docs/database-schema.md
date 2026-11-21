# PostgreSQL Database Architecture (Phase 6)

All tables live in the existing Neon PostgreSQL `public` schema using the `supermarketzanzibar_*` prefix. Every migration in `prisma/migrations/20261122000000_add_digital_twin_models/migration.sql` is **strictly additive** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) so production data is never deleted, reset, or truncated.

## Core Existing Tables (Preserved)
- `supermarketzanzibar_customuser` (`User`)
- `supermarketzanzibar_category` (`Category`)
- `supermarketzanzibar_supplier` (`Supplier`)
- `supermarketzanzibar_customer` (`Customer`)
- `supermarketzanzibar_product` (`Product`) — extended with nullable `sku`, `brand`, `unit_of_measure`, `model_asset_id`
- `supermarketzanzibar_productbarcode` (`ProductBarcode`)
- `supermarketzanzibar_sale` (`Sale`) — extended with nullable `store_id`, `idempotency_key` (unique partial index preventing duplicate checkouts)
- `supermarketzanzibar_saleitem` (`SaleItem`)
- `supermarketzanzibar_stockmovement` (`StockMovement`) — extended with nullable `source_location_id`, `destination_location_id`, `performed_by_id`, `reference`, `notes`
- `supermarketzanzibar_payment` (`Payment`)
- `refresh_token` (`RefreshToken`)

## Additive Digital Twin, Warehouse & Operations Tables
| Prisma Model | Physical Table | Purpose |
| :--- | :--- | :--- |
| `Store` | `supermarketzanzibar_store` | Multi-store root entity |
| `Department` | `supermarketzanzibar_department` | Store departments (`GRO`, `BEV`, `PRO`, `DAI`, `FRZ`, `BAK`, `MEA`, `COS`, `HSH`, `ELC`) |
| `Shelf` | `supermarketzanzibar_shelf` | Retail shelves, chillers, freezers, counters (`SH-GRO-01`, `FR-DAI-01`, etc.) |
| `ShelfPosition` | `supermarketzanzibar_shelfposition` | Individual shelf slots tracking `quantity`, `maximumCapacity`, `reservedQuantity`, `reorderLevel` |
| `WarehouseLocation` | `supermarketzanzibar_warehouselocation` | Back-of-house zones (`Zone_A`–`Zone_D`), racks (`Rack_A01`–`Rack_D02`), levels, positions |
| `Inventory` | `supermarketzanzibar_inventory` | Warehouse stock holdings per `(product, store, warehouseLocation)` |
| `InventoryBatch` | `supermarketzanzibar_inventorybatch` | Lot numbers, unit cost, and `expiryDate` tracking |
| `PurchaseOrder` & `PurchaseOrderItem` | `supermarketzanzibar_purchaseorder*` | Supplier replenishment orders with `Decimal(12,2)` financials |
| `GoodsReceipt` | `supermarketzanzibar_goodsreceipt` | Receiving dock records updating warehouse stock & PO received quantities |
| `ThreeDAsset` | `supermarketzanzibar_threedasset` | Registry of validated `.glb` models under `public/models/` |
| `ThreeDObjectMapping` | `supermarketzanzibar_threedobjectmapping` | Persistent 1:1 identity binding `objectName` -> `(linkedEntityType, linkedEntityId, transform)` |
| `AuditLog` | `supermarketzanzibar_auditlog` | Immutable actor/entity audit trail for transfers, POs, adjustments, and cancellations |

## Applying the Migration
```bash
npx prisma migrate deploy
npx prisma generate
```
