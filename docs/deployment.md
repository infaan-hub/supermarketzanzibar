# Deployment, Migration & Recovery Guide

This guide covers safe, non-destructive deployment of **Supermarket Zanzibar — 3D Digital Twin & Inventory Management System** to production (Vercel / Node.js + PostgreSQL / Neon).

## 1. Non-Destructive Database Migration

All Phase 6 schema additions are **strictly additive** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Existing `supermarketzanzibar_*` tables and rows are never dropped, truncated, or reset.

### Step 1: Take a Database Backup First

Before applying migrations on production, back up PostgreSQL using the included backup script or `pg_dump`:

```powershell
# Using included backup helper (requires DATABASE_URL in environment)
python scripts/backup_postgres.py
```

Or directly via PostgreSQL tools:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Step 2: Apply Pending Additive Migrations

Deploy builds (`npm run build`) automatically run `scripts/ensure_additive_schema.mjs` whenever a live `DATABASE_URL` is configured, and clicking **Initialize 3D Store & Sync Inventory** (`POST /api/digital-twin`) also idempotently bootstraps any missing additive tables/columns (`lib/digital-twin/ensure-schema.ts`).

You can also run the non-destructive applier manually at any time (works even on legacy Django-origin Neon databases without a baselined `_prisma_migrations` table):

```bash
npm run prisma:deploy:safe
npx prisma generate
```

Or on a Prisma-baselined database:

```bash
npx prisma migrate deploy
npx prisma generate
```

Never run `prisma migrate reset` or `prisma db push --force-reset` against a production database.

## 2. Environment Variables

Ensure the following variables are configured in your hosting environment (never commit `.env` files to Git):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon / RDS / self-hosted, with `sslmode=require` in production). |
| `JWT_SECRET` | Yes | Strong random secret (≥ 32 chars) for access & refresh JWT signing. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Optional | Enables digital email receipts on POS checkout. |

## 3. 3D GLB Asset Verification & Regeneration

All 31 `.glb` assets live under `public/models/` and are served statically by Next.js with zero external CDN dependencies.

- To regenerate the procedural glTF 2.0 baseline assets:
  ```bash
  node scripts/generate_glb_assets.mjs
  ```
- To upgrade any asset with artist-crafted Blender models, open `scripts/blender/build_supermarket_assets.py` in Blender 4.x, refine geometry/materials, and export to the exact paths listed in `lib/digital-twin/asset-manifest.ts` (preserving required node names such as `Frame`, `Top_Shelf`, `Bottom_Shelf`, `Shelf_Labels`, `Product_Position_01..06`, and `Level_01..03`).
- Validate every asset with:
  ```bash
  npm test -- tests/glb-assets.test.ts
  ```

## 4. Production Build & Startup

```bash
npm ci
npx prisma generate
npm run build
npm run start
```

### Diagnostics & Database Health Check

Verify database connectivity, timezone, and SMTP status as an authenticated administrator at:

```text
GET /api/settings
```

### First-Time 3D Digital Twin Initialization

1. Sign in as an `admin` or `manager`.
2. Navigate to `/digital-twin`.
3. Click **Initialize 3D Store & Sync Inventory** (`POST /api/digital-twin`). This idempotently populates the flagship `Store`, 10 `Department` records, 18 `Shelf` fixtures, `ShelfPosition` slots, `WarehouseLocation` racks (`Zone_A`–`Zone_D`), `ThreeDAsset` registry, and maps all active `Product` records using their exact on-hand PostgreSQL quantities.

## 5. Rollback & Recovery

- **Application rollback**: Redeploy the previous Git commit / release build. Because all new database columns are nullable and new tables are independent, older builds remain compatible.
- **Database recovery**: Restore from the pre-migration dump if required:
  ```bash
  pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup_YYYYMMDD_HHMMSS.dump
  ```
