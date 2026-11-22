// Strictly additive, idempotent PostgreSQL schema bootstrap for the 3D Digital
// Twin, Warehouse, Procurement, Expiry Batch, and Audit models.
//
// Fast path: 1 lightweight `information_schema` check (~20ms) verifies whether
// all additive tables and columns are already present.
// Bootstrap path: runs 4 dependency-ordered parallel waves of strictly additive
// `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` DDL (~200ms).
//
// Safety guarantee: Never drops, truncates, resets, or mutates existing rows.

import { prisma } from "@/lib/db";

const WAVE_1_ROOT_TABLES: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_threedasset" (
    "id" TEXT NOT NULL,
    "asset_key" VARCHAR(120) NOT NULL,
    "asset_name" VARCHAR(160) NOT NULL,
    "asset_type" VARCHAR(40) NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "format" VARCHAR(16) NOT NULL DEFAULT 'glb',
    "version" VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_threedasset_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_store" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "location" VARCHAR(200) NOT NULL DEFAULT '',
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_store_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_auditlog" (
    "id" TEXT NOT NULL,
    "actor_id" BIGINT,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(80) NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_auditlog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_auditlog_actor_fkey"
      FOREIGN KEY ("actor_id") REFERENCES "supermarketzanzibar_customuser"("id") ON DELETE SET NULL ON UPDATE NO ACTION
  )`,
  `ALTER TABLE "supermarketzanzibar_product" ADD COLUMN IF NOT EXISTS "sku" VARCHAR(80)`,
  `ALTER TABLE "supermarketzanzibar_product" ADD COLUMN IF NOT EXISTS "brand" VARCHAR(120)`,
  `ALTER TABLE "supermarketzanzibar_product" ADD COLUMN IF NOT EXISTS "unit_of_measure" VARCHAR(32) DEFAULT 'each'`,
  `ALTER TABLE "supermarketzanzibar_product" ADD COLUMN IF NOT EXISTS "model_asset_id" TEXT`,
  `ALTER TABLE "supermarketzanzibar_sale" ADD COLUMN IF NOT EXISTS "store_id" TEXT`,
  `ALTER TABLE "supermarketzanzibar_sale" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100)`,
  `DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'supermarketzanzibar_stockmovement'
        AND column_name = 'movement_type'
        AND character_maximum_length IS NOT NULL
        AND character_maximum_length < 24
    ) THEN
      ALTER TABLE "supermarketzanzibar_stockmovement"
        ALTER COLUMN "movement_type" TYPE VARCHAR(24);
    END IF;
  END
  $$`,
  `ALTER TABLE "supermarketzanzibar_stockmovement" ADD COLUMN IF NOT EXISTS "source_location_id" TEXT`,
  `ALTER TABLE "supermarketzanzibar_stockmovement" ADD COLUMN IF NOT EXISTS "destination_location_id" TEXT`,
  `ALTER TABLE "supermarketzanzibar_stockmovement" ADD COLUMN IF NOT EXISTS "performed_by_id" BIGINT`,
  `ALTER TABLE "supermarketzanzibar_stockmovement" ADD COLUMN IF NOT EXISTS "reference" VARCHAR(120)`,
  `ALTER TABLE "supermarketzanzibar_stockmovement" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
];

const WAVE_2_STORE_CHILDREN: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_department" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_department_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_department_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "supermarketzanzibar_store"("id") ON DELETE CASCADE ON UPDATE NO ACTION
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_warehouselocation" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_code" VARCHAR(40) NOT NULL DEFAULT 'WH-MAIN',
    "zone_code" VARCHAR(30) NOT NULL,
    "rack_code" VARCHAR(30) NOT NULL,
    "level_code" VARCHAR(30) NOT NULL,
    "position_code" VARCHAR(30) NOT NULL,
    "location_type" VARCHAR(30) NOT NULL DEFAULT 'ambient',
    "capacity" INTEGER NOT NULL DEFAULT 200,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_warehouselocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_warehouselocation_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "supermarketzanzibar_store"("id") ON DELETE CASCADE ON UPDATE NO ACTION
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_purchaseorder" (
    "id" TEXT NOT NULL,
    "order_number" VARCHAR(60) NOT NULL,
    "store_id" TEXT NOT NULL,
    "supplier_id" BIGINT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ordered',
    "expected_date" TIMESTAMPTZ(6),
    "notes" TEXT NOT NULL DEFAULT '',
    "total_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "created_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_purchaseorder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_purchaseorder_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "supermarketzanzibar_store"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_purchaseorder_supplier_id_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "supermarketzanzibar_supplier"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_purchaseorder_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "supermarketzanzibar_customuser"("id") ON DELETE SET NULL ON UPDATE NO ACTION
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_threedobjectmapping" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT,
    "object_name" VARCHAR(160) NOT NULL,
    "object_type" VARCHAR(40) NOT NULL,
    "linked_entity_type" VARCHAR(40) NOT NULL,
    "linked_entity_id" VARCHAR(80) NOT NULL,
    "pos_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pos_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pos_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rot_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rot_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rot_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scale_x" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scale_y" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scale_z" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_threedobjectmapping_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_threedobjectmapping_asset_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "supermarketzanzibar_threedasset"("id") ON DELETE SET NULL ON UPDATE NO ACTION
  )`,
];

const WAVE_3_DEPENDENT_TABLES: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_shelf" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "shelf_code" VARCHAR(40) NOT NULL,
    "shelf_name" VARCHAR(160) NOT NULL,
    "fixture_kind" VARCHAR(40) NOT NULL DEFAULT 'gondola',
    "capacity" INTEGER NOT NULL DEFAULT 120,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_shelf_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_shelf_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "supermarketzanzibar_store"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_shelf_department_id_fkey"
      FOREIGN KEY ("department_id") REFERENCES "supermarketzanzibar_department"("id") ON DELETE CASCADE ON UPDATE NO ACTION
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_inventory" (
    "id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_location_id" TEXT,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_inventory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_inventory_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "supermarketzanzibar_product"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_inventory_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "supermarketzanzibar_store"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_inventory_warehouse_location_id_fkey"
      FOREIGN KEY ("warehouse_location_id") REFERENCES "supermarketzanzibar_warehouselocation"("id") ON DELETE SET NULL ON UPDATE NO ACTION
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_inventorybatch" (
    "id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "store_id" TEXT NOT NULL,
    "warehouse_location_id" TEXT,
    "batch_number" VARCHAR(80) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "cost_price" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "expiry_date" TIMESTAMPTZ(6),
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_inventorybatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_inventorybatch_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "supermarketzanzibar_product"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_inventorybatch_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "supermarketzanzibar_store"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_inventorybatch_wh_fkey"
      FOREIGN KEY ("warehouse_location_id") REFERENCES "supermarketzanzibar_warehouselocation"("id") ON DELETE SET NULL ON UPDATE NO ACTION
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_purchaseorderitem" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "ordered_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(10, 2) NOT NULL,
    "line_total" DECIMAL(12, 2) NOT NULL,
    CONSTRAINT "supermarketzanzibar_purchaseorderitem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_purchaseorderitem_po_fkey"
      FOREIGN KEY ("purchase_order_id") REFERENCES "supermarketzanzibar_purchaseorder"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_purchaseorderitem_product_fkey"
      FOREIGN KEY ("product_id") REFERENCES "supermarketzanzibar_product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
  )`,
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_goodsreceipt" (
    "id" TEXT NOT NULL,
    "receipt_number" VARCHAR(60) NOT NULL,
    "purchase_order_id" TEXT,
    "store_id" TEXT NOT NULL,
    "supplier_id" BIGINT,
    "warehouse_location_id" TEXT,
    "received_by_id" BIGINT,
    "total_units" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_goodsreceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_goodsreceipt_po_fkey"
      FOREIGN KEY ("purchase_order_id") REFERENCES "supermarketzanzibar_purchaseorder"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_goodsreceipt_store_fkey"
      FOREIGN KEY ("store_id") REFERENCES "supermarketzanzibar_store"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_goodsreceipt_supplier_fkey"
      FOREIGN KEY ("supplier_id") REFERENCES "supermarketzanzibar_supplier"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_goodsreceipt_wh_fkey"
      FOREIGN KEY ("warehouse_location_id") REFERENCES "supermarketzanzibar_warehouselocation"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_goodsreceipt_actor_fkey"
      FOREIGN KEY ("received_by_id") REFERENCES "supermarketzanzibar_customuser"("id") ON DELETE SET NULL ON UPDATE NO ACTION
  )`,
];

const WAVE_4_LEAF_AND_INDEXES: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "supermarketzanzibar_shelfposition" (
    "id" TEXT NOT NULL,
    "shelf_id" TEXT NOT NULL,
    "product_id" BIGINT,
    "position_code" VARCHAR(40) NOT NULL,
    "slot_index" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "maximum_capacity" INTEGER NOT NULL DEFAULT 24,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 6,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supermarketzanzibar_shelfposition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_shelfposition_shelf_id_fkey"
      FOREIGN KEY ("shelf_id") REFERENCES "supermarketzanzibar_shelf"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "supermarketzanzibar_shelfposition_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "supermarketzanzibar_product"("id") ON DELETE SET NULL ON UPDATE NO ACTION
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_threedasset_asset_key_key" ON "supermarketzanzibar_threedasset" ("asset_key")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_store_code_key" ON "supermarketzanzibar_store" ("code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_department_store_id_code_key" ON "supermarketzanzibar_department" ("store_id", "code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_shelf_store_id_shelf_code_key" ON "supermarketzanzibar_shelf" ("store_id", "shelf_code")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_shelf_department_id_idx" ON "supermarketzanzibar_shelf" ("department_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_product_sku_key" ON "supermarketzanzibar_product" ("sku")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_sale_idempotency_key_key" ON "supermarketzanzibar_sale" ("idempotency_key")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_stockmovement_product_date_idx" ON "supermarketzanzibar_stockmovement" ("product_id", "date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_warehouselocation_unique_slot_key" ON "supermarketzanzibar_warehouselocation" ("store_id", "warehouse_code", "rack_code", "level_code", "position_code")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_warehouselocation_zone_rack_idx" ON "supermarketzanzibar_warehouselocation" ("store_id", "zone_code", "rack_code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_inventory_product_store_wh_key" ON "supermarketzanzibar_inventory" ("product_id", "store_id", "warehouse_location_id")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_inventory_store_product_idx" ON "supermarketzanzibar_inventory" ("store_id", "product_id")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_inventorybatch_product_expiry_idx" ON "supermarketzanzibar_inventorybatch" ("product_id", "expiry_date")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_inventorybatch_status_expiry_idx" ON "supermarketzanzibar_inventorybatch" ("status", "expiry_date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_purchaseorder_order_number_key" ON "supermarketzanzibar_purchaseorder" ("order_number")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_purchaseorder_store_status_idx" ON "supermarketzanzibar_purchaseorder" ("store_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_purchaseorderitem_po_idx" ON "supermarketzanzibar_purchaseorderitem" ("purchase_order_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_goodsreceipt_receipt_number_key" ON "supermarketzanzibar_goodsreceipt" ("receipt_number")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_goodsreceipt_store_received_idx" ON "supermarketzanzibar_goodsreceipt" ("store_id", "received_at")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_threedobjectmapping_object_name_key" ON "supermarketzanzibar_threedobjectmapping" ("object_name")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_threedobjectmapping_entity_idx" ON "supermarketzanzibar_threedobjectmapping" ("linked_entity_type", "linked_entity_id")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_auditlog_entity_idx" ON "supermarketzanzibar_auditlog" ("entity_type", "entity_id")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_auditlog_created_idx" ON "supermarketzanzibar_auditlog" ("created_at")`,
];

const WAVE_5_SHELFPOSITION_INDEXES: readonly string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_shelfposition_shelf_id_position_code_key" ON "supermarketzanzibar_shelfposition" ("shelf_id", "position_code")`,
  `CREATE INDEX IF NOT EXISTS "supermarketzanzibar_shelfposition_product_id_idx" ON "supermarketzanzibar_shelfposition" ("product_id")`,
];

const globalForSchema = globalThis as unknown as {
  __szDigitalTwinSchemaReady?: boolean;
  __szDigitalTwinSchemaPromise?: Promise<void> | null;
};

async function isSchemaAlreadyComplete(): Promise<boolean> {
  const rows = await prisma.$queryRaw<
    Array<{ tables_ready: number; cols_ready: number }>
  >`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'supermarketzanzibar_threedasset',
            'supermarketzanzibar_store',
            'supermarketzanzibar_department',
            'supermarketzanzibar_shelf',
            'supermarketzanzibar_shelfposition',
            'supermarketzanzibar_warehouselocation',
            'supermarketzanzibar_inventory',
            'supermarketzanzibar_inventorybatch',
            'supermarketzanzibar_purchaseorder',
            'supermarketzanzibar_purchaseorderitem',
            'supermarketzanzibar_goodsreceipt',
            'supermarketzanzibar_threedobjectmapping',
            'supermarketzanzibar_auditlog'
          )
      ) AS tables_ready,
      (
        SELECT COUNT(*)::int
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'supermarketzanzibar_product' AND column_name IN ('sku', 'model_asset_id'))
            OR (table_name = 'supermarketzanzibar_sale' AND column_name = 'idempotency_key')
            OR (table_name = 'supermarketzanzibar_stockmovement' AND column_name = 'notes')
          )
      ) AS cols_ready
  `;
  const row = rows[0];
  return Boolean(row && row.tables_ready === 13 && row.cols_ready === 4);
}

/**
 * Idempotently ensures all additive Digital Twin PostgreSQL tables and columns
 * exist. Safe to call on every cold start or initialization; skips DDL in a
 * single fast query when already deployed.
 */
export async function ensureDigitalTwinSchema(force = false): Promise<void> {
  if (!force && globalForSchema.__szDigitalTwinSchemaReady) return;

  if (!force && globalForSchema.__szDigitalTwinSchemaPromise) {
    return globalForSchema.__szDigitalTwinSchemaPromise;
  }

  const run = (async () => {
    if (!force && (await isSchemaAlreadyComplete())) {
      globalForSchema.__szDigitalTwinSchemaReady = true;
      return;
    }

    for (const wave of [
      WAVE_1_ROOT_TABLES,
      WAVE_2_STORE_CHILDREN,
      WAVE_3_DEPENDENT_TABLES,
      WAVE_4_LEAF_AND_INDEXES,
      WAVE_5_SHELFPOSITION_INDEXES,
    ]) {
      for (const sql of wave) {
        await prisma.$executeRawUnsafe(sql);
      }
    }

    globalForSchema.__szDigitalTwinSchemaReady = true;
  })();

  globalForSchema.__szDigitalTwinSchemaPromise = run;
  try {
    await run;
  } catch (error) {
    globalForSchema.__szDigitalTwinSchemaReady = false;
    throw error;
  } finally {
    globalForSchema.__szDigitalTwinSchemaPromise = null;
  }
}
