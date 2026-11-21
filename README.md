# Supermarket Zanzibar — POS & Inventory System

Full-stack **Point of Sale (POS)**, **Code 128 Barcode**, **Visual Stock Counting**, and **Retail Analytics** platform built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, and Prisma ORM on Neon PostgreSQL.

## Quick Start

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
2. Install dependencies & generate Prisma Client:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

3. Start the dev server:

```bash
npm run dev
```

4. If the database has zero admin accounts yet, open `/register` to create the initial **Administrator** account (first-admin bootstrap). Thereafter, admins manage staff accounts from `/users`.

## Authentication & RBAC

- **JWT Access Tokens** (30m) sent via `Authorization: Bearer <token>`.
- **Rotating Refresh Tokens** (7d) stored in an `HttpOnly`, `SameSite=Lax` cookie (`refresh_token`) with single-flight automatic refresh in `lib/api.ts`.
- **Roles:**
  - `admin` — full system control (`/users`, `/settings`, product archive, plus all manager & staff capabilities).
  - `manager` — reports & Z-Reports (`/reports`), product/category/supplier/customer editing, pack barcodes, payment confirmation, sale cancellation & restock.
  - `cashier` / `supplier` — POS terminal, checkout, receipts, stock counting & movements, product/customer/supplier lookup.
  - Any signed-in user — `/profile`.

## Pages

- `/` — Executive Analytics Dashboard (`Africa/Dar_es_Salaam` timezone)
- `/pos` — Unified Split-Screen Point of Sale (continuous USB/Bluetooth/camera barcode scanning + live cart & checkout)
- `/shopping-cart` — Dedicated full-page basket review
- `/sales` & `/sales/[id]` — Order directory, line items, and Cancel & Restock
- `/receipt` & `/receipt/[id]` — Database-backed printable thermal receipt (`58mm`/`80mm`), PNG download, and WhatsApp share
- `/payments` — Payment reconciliation & pending approval workflow
- `/products` & `/products/[id]` — Product catalogue, editing, margin analytics, and Code 128 pack/carton barcodes
- `/categories` — Category management
- `/stock` & `/stock/movements` — Visual item camera counter, barcode `IN`/`OUT` stock adjustments, and CSV-exportable audit ledger
- `/barcodes` — Bulk Code 128 shelf & sticker print studio
- `/reports` — End-of-Day Z-Report & Gross Profit Analytics
- `/customers` & `/customers/[id]` — Customer directory & loyalty points
- `/suppliers` & `/suppliers/[id]` — Vendor directory & low-stock reorder queues
- `/users` — Admin user & role management
- `/profile` — User profile & password management
- `/settings` — Store & POS settings + system diagnostics

## Verification Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
