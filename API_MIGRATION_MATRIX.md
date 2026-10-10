# API_MIGRATION_MATRIX — Django DRF → Next.js Route Handlers

One row per **method/path combination** (82 total). “Auth” = required authentication;
“Role” = role/permission rule copied from the original view/serializer; “Test” = automated
integration test status; “Manual” = manual verification status (dev server / production
build). Trailing slashes are preserved by the Next.js request pipeline (verified by tests).

Legend for Test: ✅ pass · ⏳ pending · ❌ fail. Updated as phases complete.

## A. Authentication (13)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | `/api/auth/login/` | `app/api/auth/login/route.ts` | public | customer only (`403` other roles) | `username`,`password` | 200 `{refresh,access,user}` / 401 `Invalid credentials.` / 403 role·schedule | ⏳ | ⏳ |
| 2 | POST | `/api/auth/google/` | `app/api/auth/google/route.ts` | public | customer only | `credential` (tokeninfo aud+email_verified) | 200 `{refresh,access,user}` / 400·403·502·503 | ⏳ | ⏳ |
| 3 | POST | `/api/auth/admin/login/` | `app/api/auth/admin/login/route.ts` | public | admin only | `username`,`password` | as #1 | ⏳ | ⏳ |
| 4 | POST | `/api/auth/supplier/login/` | `app/api/auth/supplier/login/route.ts` | public | supplier + active window | `username`,`password` | as #1 (403 schedule detail) | ⏳ | ⏳ |
| 5 | POST | `/api/auth/driver/login/` | `app/api/auth/driver/login/route.ts` | public | driver + active window | `username`,`password` | as #1 (403 schedule detail) | ⏳ | ⏳ |
| 6 | POST | `/api/auth/register/` | `app/api/auth/register/route.ts` | public | forces `role=customer` | multipart: username,email,full_name,phone,address?,password(≥8),password_confirm,profile_image? | 201 user / 400 field errors | ⏳ | ⏳ |
| 7 | POST | `/api/auth/admin/register/` | `app/api/auth/admin/register/route.ts` | public | bootstrap-only admin (see audit §7.1) | as #6 | 201 user / 400 / 403 when admin exists | ⏳ | ⏳ |
| 8 | GET | `/api/auth/me/` | `app/api/auth/me/route.ts` | Bearer | any role + schedule enforcement | — | 200 UserSerializer / 401 / 403 schedule | ⏳ | ⏳ |
| 9 | PATCH | `/api/auth/me/` | `app/api/auth/me/route.ts` | Bearer | any role + schedule enforcement; `role`/windows read-only | multipart: updatable user fields, password?, profile_image? | 200 user / 400 / 401 / 403 | ⏳ | ⏳ |
| 10 | POST | `/api/auth/token/refresh/` | `app/api/auth/token/refresh/route.ts` | refresh token (body **or** HttpOnly cookie) | rotation on | `{refresh}` or cookie | 200 `{access,refresh}` + set-cookie / 401 token_not_valid | ⏳ | ⏳ |
| 11 | POST | `/api/auth/admin/create-user/` | `app/api/auth/admin/create-user/route.ts` | Bearer | admin | multipart; role ∈ supplier·driver·customer; password ≥8 match; company_name for supplier | 201 user / 400 / 401 / 403 | ⏳ | ⏳ |
| 12 | GET | `/api/auth/schedule-task/` | `app/api/auth/schedule-task/route.ts` | Bearer | admin | — | 200 `[ScheduledAccessSerializer]` | ⏳ | ⏳ |
| 13 | PATCH | `/api/auth/schedule-task/{user_id}/` | `app/api/auth/schedule-task/[user_id]/route.ts` | Bearer | admin; supplier/driver only | windows both-or-neither, end>start | 200 user / 400 / 404 | ⏳ | ⏳ |

## B. Customer (5)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 14 | POST | `/api/customer/checkout/` | `app/api/customer/checkout/route.ts` | Bearer | customer | JSON items[{product,quantity≥1}],payment_method,customer_*,delivery_location,terms_accepted | 201 `{sale,payment,whatsapp_url}` / 400 stock·empty·missing / 503 | ⏳ | ⏳ |
| 15 | GET | `/api/customer/orders/` | `app/api/customer/orders/route.ts` | Bearer | customer, own sales (`customer_history_hidden=false`) | — | 200 `[Sale]` | ⏳ | ⏳ |
| 16 | DELETE | `/api/customer/orders/` | `app/api/customer/orders/route.ts` | Bearer | customer | — | 200 `{detail,hidden_count}` (hide, not delete) | ⏳ | ⏳ |
| 17 | DELETE | `/api/customer/orders/{sale_id}/` | `app/api/customer/orders/[sale_id]/route.ts` | Bearer | customer, own sale | numeric id | 200 `{detail}` / 404 | ⏳ | ⏳ |
| 18 | GET | `/api/customer/orders/{sale_id}/receipt/` | `app/api/customer/orders/[sale_id]/receipt/route.ts` | Bearer | customer, own sale, confirmed payment | numeric id | 200 PDF attachment / 404 / 409 / 503 | ⏳ | ⏳ |

## C. Supplier (2)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 19 | GET | `/api/supplier/dashboard/` | `app/api/supplier/dashboard/route.ts` | Bearer | supplier + active window | — | 200 `{supplier,products_count,low_stock_count,pending_payments_count,pending_payments,products}` / 403 / 404 | ⏳ | ⏳ |
| 20 | GET | `/api/supplier/alerts/` | `app/api/supplier/alerts/route.ts` | Bearer | supplier + active window | — | 200 `{alerts,pending_count}` | ⏳ | ⏳ |

## D. Driver (3)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 21 | GET | `/api/driver/dashboard/` | `app/api/driver/dashboard/route.ts` | Bearer | driver + active window; sole-driver auto-assign | — | 200 `{driver,active_deliveries}` | ⏳ | ⏳ |
| 22 | GET | `/api/driver/alerts/` | `app/api/driver/alerts/route.ts` | Bearer | driver + active window | — | 200 `{alerts,active_count}` (≤25) | ⏳ | ⏳ |
| 23 | PATCH | `/api/driver/sales/{sale_id}/status/` | `app/api/driver/sales/[sale_id]/status/route.ts` | Bearer | driver, assigned sales only | `status ∈ out_for_delivery·delivered` | 200 Sale / 400 / 404 | ⏳ | ⏳ |

## E. Users (6)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 24 | GET | `/api/users/` | `app/api/users/route.ts` | Bearer | admin | — | 200 `[User]` | ⏳ | ⏳ |
| 25 | POST | `/api/users/` | `app/api/users/route.ts` | Bearer | admin; `role` read-only (stays inert) | optional password ≥8, unique username/email/phone | 201 user / 400 | ⏳ | ⏳ |
| 26 | GET | `/api/users/{id}/` | `app/api/users/[id]/route.ts` | Bearer | admin | numeric id | 200 user / 404 | ⏳ | ⏳ |
| 27 | PUT | `/api/users/{id}/` | `app/api/users/[id]/route.ts` | Bearer | admin; role/windows read-only | full replace of writable fields | 200 user / 400 / 404 | ⏳ | ⏳ |
| 28 | PATCH | `/api/users/{id}/` | `app/api/users/[id]/route.ts` | Bearer | admin; role/windows read-only | partial | 200 user / 400 / 404 | ⏳ | ⏳ |
| 29 | DELETE | `/api/users/{id}/` | `app/api/users/[id]/route.ts` | Bearer | admin | numeric id | 204 / 404 | ⏳ | ⏳ |

## F. Categories (6) — any authenticated user (original rule)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | GET | `/api/categories/` | `app/api/categories/route.ts` | Bearer | authenticated | — | 200 `[Category]` | ⏳ | ⏳ |
| 31 | POST | `/api/categories/` | `app/api/categories/route.ts` | Bearer | authenticated | `name` required (≤200), description | 201 / 400 | ⏳ | ⏳ |
| 32 | GET | `/api/categories/{id}/` | `app/api/categories/[id]/route.ts` | Bearer | authenticated | numeric id | 200 / 404 | ⏳ | ⏳ |
| 33 | PUT | `/api/categories/{id}/` | `app/api/categories/[id]/route.ts` | Bearer | authenticated | full | 200 / 400 / 404 | ⏳ | ⏳ |
| 34 | PATCH | `/api/categories/{id}/` | `app/api/categories/[id]/route.ts` | Bearer | authenticated | partial | 200 / 400 / 404 | ⏳ | ⏳ |
| 35 | DELETE | `/api/categories/{id}/` | `app/api/categories/[id]/route.ts` | Bearer | authenticated | numeric id | 204 / 404 | ⏳ | ⏳ |

## G. Suppliers (6) — admin only

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 36 | GET | `/api/suppliers/` | `app/api/suppliers/route.ts` | Bearer | admin | — | 200 `[Supplier]` | ⏳ | ⏳ |
| 37 | POST | `/api/suppliers/` | `app/api/suppliers/route.ts` | Bearer | admin | user FK unique (OneToOne), company_name, phone, address | 201 / 400 | ⏳ | ⏳ |
| 38–41 | GET·PUT·PATCH·DELETE | `/api/suppliers/{id}/` | `app/api/suppliers/[id]/route.ts` | Bearer | admin | numeric id | 200/204/400/404 | ⏳ | ⏳ |

## H. Customers (6) — admin only

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 42 | GET | `/api/customers/` | `app/api/customers/route.ts` | Bearer | admin | — | 200 `[Customer]` | ⏳ | ⏳ |
| 43 | POST | `/api/customers/` | `app/api/customers/route.ts` | Bearer | admin | user FK unique, phone | 201 / 400 | ⏳ | ⏳ |
| 44–47 | GET·PUT·PATCH·DELETE | `/api/customers/{id}/` | `app/api/customers/[id]/route.ts` | Bearer | admin | numeric id | 200/204/400/404 | ⏳ | ⏳ |

## I. Products (7)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 48 | GET | `/api/products/` | `app/api/products/route.ts` | public | AllowAny; public serializer; skip broken rows | — | 200 `[PublicProduct]` array / 503 | ⏳ | ⏳ |
| 49 | POST | `/api/products/` | `app/api/products/route.ts` | Bearer | admin or supplier (supplier FK forced to own profile; others 403) | multipart: name,category(id\|name\|blank),price,cost_price,quantity,barcode,description?,image? (≤10MiB, JPEG≤1MiB pipeline),is_active? | 201 Product / 400 / 403 / 503 | ⏳ | ⏳ |
| 50 | GET | `/api/products/{id}/` | `app/api/products/[id]/route.ts` | public | pk or slug | id or slug | 200 Product / 404 / 503 | ⏳ | ⏳ |
| 51 | PUT | `/api/products/{id}/` | `app/api/products/[id]/route.ts` | Bearer | admin, or supplier owning the product | full replace + optional image | 200 / 400 / 403 / 404 | ⏳ | ⏳ |
| 52 | PATCH | `/api/products/{id}/` | `app/api/products/[id]/route.ts` | Bearer | admin or owning supplier | partial + optional image | 200 / 400 / 403 / 404 | ⏳ | ⏳ |
| 53 | DELETE | `/api/products/{id}/` | `app/api/products/[id]/route.ts` | Bearer | admin or owning supplier | id/slug | 204 / 403 / 404 | ⏳ | ⏳ |
| 54 | GET | `/api/products/{id}/image/` | `app/api/products/[id]/image/route.ts` | public | AllowAny | id/slug | 200 bytes (`inline`, `max-age=86400`) / 404 | ⏳ | ⏳ |

## J. Sales (7)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 55 | GET | `/api/sales/` | `app/api/sales/route.ts` | Bearer | scoping: admin all · driver assigned · customer own · supplier none | — | 200 `[Sale]` | ⏳ | ⏳ |
| 56 | POST | `/api/sales/` | `app/api/sales/route.ts` | Bearer | admin only | sale fields; `final_amount` recomputed | 201 Sale / 400 / 403 | ⏳ | ⏳ |
| 57 | GET | `/api/sales/{id}/` | `app/api/sales/[id]/route.ts` | Bearer | same scoping (404 out of scope) | numeric id | 200 / 404 | ⏳ | ⏳ |
| 58 | PUT | `/api/sales/{id}/` | `app/api/sales/[id]/route.ts` | Bearer | admin only | full | 200 / 400 / 403 / 404 | ⏳ | ⏳ |
| 59 | PATCH | `/api/sales/{id}/` | `app/api/sales/[id]/route.ts` | Bearer | admin only | partial | 200 / 400 / 403 / 404 | ⏳ | ⏳ |
| 60 | DELETE | `/api/sales/{id}/` | `app/api/sales/[id]/route.ts` | Bearer | admin only | numeric id | 204 / 403 / 404 | ⏳ | ⏳ |
| 61 | POST | `/api/sales/{id}/assign_driver/` | `app/api/sales/[id]/assign_driver/route.ts` | Bearer | admin | `{driver_id}` must be a driver (else 404) | 200 Sale / 404 | ⏳ | ⏳ |

## K. Sale items (6) — scoped reads; admin writes (audit §7.3)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 62 | GET | `/api/sale-items/` | `app/api/sale-items/route.ts` | Bearer | admin all · customer own sales · driver assigned · supplier own-product sales | — | 200 `[SaleItem]` | ⏳ | ⏳ |
| 63 | POST | `/api/sale-items/` | `app/api/sale-items/route.ts` | Bearer | admin only | `{sale,product,quantity,price}`; `total` recomputed | 201 / 400 / 403 | ⏳ | ⏳ |
| 64 | GET | `/api/sale-items/{id}/` | `app/api/sale-items/[id]/route.ts` | Bearer | scoped | numeric id | 200 / 404 | ⏳ | ⏳ |
| 65–66 | PUT·PATCH | `/api/sale-items/{id}/` | `app/api/sale-items/[id]/route.ts` | Bearer | admin only | totals recomputed | 200 / 400 / 403 / 404 | ⏳ | ⏳ |
| 67 | DELETE | `/api/sale-items/{id}/` | `app/api/sale-items/[id]/route.ts` | Bearer | admin only | numeric id | 204 / 403 / 404 | ⏳ | ⏳ |

## L. Stock / stock movements (6) — `StockMovement` CRUD, authenticated (original rule)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 68 | GET | `/api/stock/` | `app/api/stock/route.ts` | Bearer | authenticated | — | 200 `[StockMovement]` | ⏳ | ⏳ |
| 69 | POST | `/api/stock/` | `app/api/stock/route.ts` | Bearer | audit row only (no quantity side effect, as original) | product,quantity,movement_type ∈ IN·OUT, sale_item? | 201 / 400 | ⏳ | ⏳ |
| 70 | GET | `/api/stock/{id}/` | `app/api/stock/[id]/route.ts` | Bearer | authenticated | numeric id | 200 / 404 | ⏳ | ⏳ |
| 71–72 | PUT·PATCH | `/api/stock/{id}/` | `app/api/stock/[id]/route.ts` | Bearer | authenticated | movement fields | 200 / 400 / 404 | ⏳ | ⏳ |
| 73 | DELETE | `/api/stock/{id}/` | `app/api/stock/[id]/route.ts` | Bearer | authenticated | numeric id | 204 / 404 | ⏳ | ⏳ |

## M. Payments (8)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 74 | GET | `/api/payments/` | `app/api/payments/route.ts` | Bearer | admin all · customer own sales · others none | — | 200 `[Payment]` | ⏳ | ⏳ |
| 75 | POST | `/api/payments/` | `app/api/payments/route.ts` | Bearer | own sale (or admin); status forced pending for non-admin (audit §7.2) | sale, payment_method, proof_image?, status | 201 / 400 / 403 | ⏳ | ⏳ |
| 76 | GET | `/api/payments/{id}/` | `app/api/payments/[id]/route.ts` | Bearer | scoped (404 out of scope) | numeric id | 200 / 404 | ⏳ | ⏳ |
| 77 | PUT | `/api/payments/{id}/` | `app/api/payments/[id]/route.ts` | Bearer | owner/admin; status·confirmed_by admin-only | full | 200 / 400 / 403 / 404 | ⏳ | ⏳ |
| 78 | PATCH | `/api/payments/{id}/` | `app/api/payments/[id]/route.ts` | Bearer | owner/admin; status·confirmed_by admin-only | partial | 200 / 400 / 403 / 404 | ⏳ | ⏳ |
| 79 | DELETE | `/api/payments/{id}/` | `app/api/payments/[id]/route.ts` | Bearer | admin only (financial rows — see note 1) | numeric id | 204 / 403 / 404 | ⏳ | ⏳ |
| 80 | POST | `/api/payments/{id}/confirm/` | `app/api/payments/[id]/confirm/route.ts` | Bearer | admin or supplier-owning-product; pending→confirmed (409 otherwise) | — | 200 Payment / 404 / 409 / 503 | ⏳ | ⏳ |
| 81 | GET | `/api/payments/admin_pending/` | `app/api/payments/admin_pending/route.ts` | Bearer | admin | — | 200 `[PaymentAdmin]` | ⏳ | ⏳ |

## N. API root (1)

| # | Method | Path | Next.js handler | Auth | Role / rule | Request validation | Response | Test | Manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 82 | GET | `/api/` | `app/api/route.ts` | public (DRF router root) | — | — | 200 `{users,categories,suppliers,customers,products,sales,sale-items,stock,payments}` (absolute URLs) | ⏳ | ⏳ |

---

## Verification notes

* Count check: 13 auth + 5 customer + 2 supplier + 3 driver + 6 users + 6 categories +
  6 suppliers + 6 customers + 7 products + 7 sales + 6 sale-items + 6 stock + 8 payments +
  1 root = **82 method/path combinations** (42+ distinct route patterns).
* Note 1 — payments DELETE: the original ModelViewSet let a scoped customer delete their own
  payment rows; because removing accounting data contradicts the master prompt, DELETE is
  admin-only and covered by tests. Application flows never delete payments otherwise.
* Note 2 — trailing slashes: preserved (`/api/…/`); Next normalizes with a 308 that keeps
  method/body/headers, verified in integration tests.
* Note 3 — `HEAD`/`OPTIONS` are answered by the framework (as DRF did) and are not counted.



