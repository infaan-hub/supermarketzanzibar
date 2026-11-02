-- Code 128 product barcodes: primary labels plus pack/unit labels.
-- Existing products keep their Product.barcode value; this table adds
-- additional packaging codes and lets the POS resolve a scanned unit.

CREATE TABLE IF NOT EXISTS "supermarketzanzibar_productbarcode" (
    "id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "barcode" VARCHAR(100) NOT NULL,
    "barcode_type" VARCHAR(20) NOT NULL DEFAULT 'code128',
    "unit_id" VARCHAR(50),
    "quantity_multiplier" DECIMAL(10, 3) NOT NULL DEFAULT 1,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supermarketzanzibar_productbarcode_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supermarketzanzibar_productbarcode_quantity_multiplier_check"
        CHECK ("quantity_multiplier" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "supermarketzanzibar_productbarcode_barcode_key"
    ON "supermarketzanzibar_productbarcode" ("barcode");

CREATE INDEX IF NOT EXISTS "supermarketzanzibar_productbarcode_product_id_idx"
    ON "supermarketzanzibar_productbarcode" ("product_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'supermarketzanzibar_productbarcode_product_id_fkey'
    ) THEN
        ALTER TABLE "supermarketzanzibar_productbarcode"
            ADD CONSTRAINT "supermarketzanzibar_productbarcode_product_id_fkey"
            FOREIGN KEY ("product_id")
            REFERENCES "supermarketzanzibar_product" ("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
    END IF;
END
$$;

-- Backfill every existing product barcode as its primary Code 128 label so
-- scanners keep working immediately after the migration.
INSERT INTO "supermarketzanzibar_productbarcode" (
    "id",
    "product_id",
    "barcode",
    "barcode_type",
    "unit_id",
    "quantity_multiplier",
    "is_primary",
    "created_at"
)
SELECT
    'bc_' || p."id"::text,
    p."id",
    p."barcode",
    'code128',
    NULL,
    1,
    true,
    p."created_at"
FROM "supermarketzanzibar_product" p
WHERE p."barcode" IS NOT NULL
  AND p."barcode" <> ''
ON CONFLICT DO NOTHING;
