// Role-Based Access Control (RBAC) & multi-portal routing policy shared by
// API routes, AuthProvider, Sidebar, Header, and pages.
//
// Portal layout:
// - Guest (no login): `/` (Public Storefront), `/store-3d` (Read-only 3D Store),
//   `/login`, `/register`, `/unauthorized`.
// - Admin (`admin`): ALL management pages live under `/admin/*`, including user
//   registration for `manager`, `marketmaster`, and other roles.
// - Manager (`manager`): ALL manager pages live under `/manager/*` — inventory,
//   stock, products, receiving goods, supplier orders, shelves, warehouse, POS, reports.
// - MarketMaster (`marketmaster`): ALL MarketMaster pages live under `/market/*` —
//   POS (checkout, sales, payments, customers) and all products (catalogue, categories, barcodes).
// - Viewer (`viewer`): read-only exploration of overview, 3D store & warehouse.
// - Supplier (`supplier`): dedicated self-service portal under `/supplier/*`.

export const ALL_ROLES = [
  "admin",
  "manager",
  "marketmaster",
  "viewer",
  "supplier",
  "customer",
] as const;

export type AppRole = (typeof ALL_ROLES)[number];

export const ADMIN_ROLES: readonly string[] = ["admin"];
export const MANAGER_PORTAL_ROLES: readonly string[] = ["manager"];
export const MARKET_ROLES: readonly string[] = ["marketmaster"];
export const MANAGER_ROLES: readonly string[] = ["admin", "manager"];
export const INVENTORY_ROLES: readonly string[] = [
  "admin",
  "manager",
  "supplier",
];
export const PRODUCT_ROLES: readonly string[] = [
  "admin",
  "manager",
  "marketmaster",
];
export const POS_ROLES: readonly string[] = [
  "admin",
  "manager",
  "marketmaster",
];
export const STAFF_ROLES: readonly string[] = [
  "admin",
  "manager",
  "marketmaster",
  "supplier",
];
export const EXPLORE_ROLES: readonly string[] = [
  "admin",
  "manager",
  "marketmaster",
  "supplier",
  "viewer",
];
export const WAREHOUSE_VIEW_ROLES: readonly string[] = [
  "admin",
  "manager",
  "supplier",
  "viewer",
];
export const SUPPLIER_PORTAL_ROLES: readonly string[] = [
  "supplier",
  "admin",
  "manager",
];

/** Paths accessible without signing in. */
export const PUBLIC_PATHS = [
  "/",
  "/store-3d",
  "/login",
  "/register",
  "/unauthorized",
] as const;

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(normalizeRole(role));
}

export function isMarketMasterRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "marketmaster";
}

export function isManagerOnlyRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "manager";
}

export function isManagerRole(role: string | null | undefined): boolean {
  return MANAGER_ROLES.includes(normalizeRole(role));
}

export function isInventoryRole(role: string | null | undefined): boolean {
  return INVENTORY_ROLES.includes(normalizeRole(role));
}

export function isProductRole(role: string | null | undefined): boolean {
  return PRODUCT_ROLES.includes(normalizeRole(role));
}

export function isPosRole(role: string | null | undefined): boolean {
  return POS_ROLES.includes(normalizeRole(role));
}

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(normalizeRole(role));
}

export function isExplorerRole(role: string | null | undefined): boolean {
  return EXPLORE_ROLES.includes(normalizeRole(role));
}

export function isSupplierRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "supplier";
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some(
    (publicPath) =>
      publicPath !== "/" &&
      (pathname === publicPath || pathname.startsWith(`${publicPath}/`)),
  );
}

/** True for consumer storefront pages that render their own guest navigation bar. */
export function isStorefrontPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/store-3d" ||
    pathname.startsWith("/store-3d/")
  );
}

/** True for auth/status utility pages that render without app shell chrome. */
export function isAuthUtilityPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/unauthorized/")
  );
}

/** Default landing route after sign-in for each role. */
export function defaultHomeForRole(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  if (normalized === "admin") return "/admin";
  if (normalized === "manager") return "/manager";
  if (normalized === "marketmaster") return "/market";
  if (normalized === "supplier") return "/supplier";
  if (EXPLORE_ROLES.includes(normalized)) return "/dashboard";
  return "/";
}

/**
 * Rewrite an operational route path into the active role's portal namespace.
 * - `admin`: `/dashboard` -> `/admin`, `/pos` -> `/admin/pos`, `/users` -> `/admin/users`
 * - `manager`: `/dashboard` -> `/manager`, `/stock` -> `/manager/stock`, `/products` -> `/manager/products`
 * - `marketmaster`: `/dashboard` -> `/market`, `/products` -> `/market/products`, `/pos` -> `/market/pos`
 * - other roles: keep root operational routes as-is (e.g. `/dashboard`, `/pos`, `/supplier`)
 */
export function portalHref(
  role: string | null | undefined,
  path: string,
): string {
  if (!path.startsWith("/")) return path;
  if (
    path === "/" ||
    path === "/store-3d" ||
    path.startsWith("/store-3d?") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/unauthorized") ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/manager" ||
    path.startsWith("/manager/") ||
    path === "/market" ||
    path.startsWith("/market/") ||
    path === "/supplier" ||
    path.startsWith("/supplier/")
  ) {
    return path;
  }

  if (isAdminRole(role)) {
    if (path === "/dashboard") return "/admin";
    if (path.startsWith("/dashboard?")) {
      return `/admin${path.slice("/dashboard".length)}`;
    }
    return `/admin${path}`;
  }

  if (isManagerOnlyRole(role)) {
    if (path === "/dashboard") return "/manager";
    if (path.startsWith("/dashboard?")) {
      return `/manager${path.slice("/dashboard".length)}`;
    }
    return `/manager${path}`;
  }

  if (isMarketMasterRole(role)) {
    if (path === "/dashboard") return "/market";
    if (path.startsWith("/dashboard?")) {
      return `/market${path.slice("/dashboard".length)}`;
    }
    return `/market${path}`;
  }

  return path;
}

/**
 * If an administrator visits a legacy non-`/admin/*` management route (like
 * `/dashboard`, `/pos`, `/users`, `/settings`, `/digital-twin`), return its
 * canonical `/admin/...` path so all Admin pages consistently start with `/admin/`.
 * Returns `null` when no redirect is needed (e.g. public storefront `/` or `/store-3d`,
 * `/supplier*`, `/manager*`, `/market*`, or already under `/admin`).
 */
export function adminCanonicalRedirect(pathname: string): string | null {
  if (
    pathname === "/" ||
    pathname === "/store-3d" ||
    pathname.startsWith("/store-3d/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/manager" ||
    pathname.startsWith("/manager/") ||
    pathname === "/market" ||
    pathname.startsWith("/market/") ||
    pathname === "/supplier" ||
    pathname.startsWith("/supplier/") ||
    isAuthUtilityPath(pathname)
  ) {
    return null;
  }
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return "/admin";
  }
  return `/admin${pathname}`;
}

/**
 * If a Manager visits an allowed non-`/manager/*` operational route (like
 * `/dashboard`, `/products`, `/stock`, `/shelves`, `/warehouse`, `/suppliers`,
 * `/purchase-orders`, `/goods-received`, `/pos`, `/reports`, `/profile`),
 * return its canonical `/manager/...` path so all Manager pages consistently
 * live under `/manager/*`. Returns `null` when already under `/manager`, on
 * public storefront routes, on `/supplier/*`, or on paths Manager cannot access.
 */
export function managerCanonicalRedirect(pathname: string): string | null {
  if (
    pathname === "/" ||
    pathname === "/store-3d" ||
    pathname.startsWith("/store-3d/") ||
    pathname === "/manager" ||
    pathname.startsWith("/manager/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/market" ||
    pathname.startsWith("/market/") ||
    pathname === "/supplier" ||
    pathname.startsWith("/supplier/") ||
    isAuthUtilityPath(pathname)
  ) {
    return null;
  }
  if (!canAccessPath("manager", pathname)) {
    return null;
  }
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return "/manager";
  }
  return `/manager${pathname}`;
}

/**
 * If a MarketMaster visits an allowed non-`/market/*` operational route (like
 * `/dashboard`, `/products`, `/pos`, `/sales`, `/customers`, `/profile`),
 * return its canonical `/market/...` path so all MarketMaster pages consistently
 * live under `/market/*`. Returns `null` when already under `/market`, on public
 * storefront routes, or on paths MarketMaster is not authorized to access.
 */
export function marketCanonicalRedirect(pathname: string): string | null {
  if (
    pathname === "/" ||
    pathname === "/store-3d" ||
    pathname.startsWith("/store-3d/") ||
    pathname === "/market" ||
    pathname.startsWith("/market/") ||
    pathname === "/manager" ||
    pathname.startsWith("/manager/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/supplier" ||
    pathname.startsWith("/supplier/") ||
    isAuthUtilityPath(pathname)
  ) {
    return null;
  }
  if (!canAccessPath("marketmaster", pathname)) {
    return null;
  }
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return "/market";
  }
  return `/market${pathname}`;
}

/** Allowed roles for an application pathname. Returns null for any signed-in user (or public). */
export function requiredRolesForPath(
  pathname: string,
): readonly string[] | null {
  if (isPublicPath(pathname)) return null;

  // All `/admin` & `/admin/*` pages belong exclusively to administrators.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return ADMIN_ROLES;
  }

  // All `/manager` & `/manager/*` pages belong exclusively to Manager.
  if (pathname === "/manager" || pathname.startsWith("/manager/")) {
    return MANAGER_PORTAL_ROLES;
  }

  // All `/market` & `/market/*` pages belong exclusively to MarketMaster.
  if (pathname === "/market" || pathname.startsWith("/market/")) {
    return MARKET_ROLES;
  }

  // Dedicated Supplier Portal (`/supplier` & `/supplier/*`).
  if (pathname === "/supplier" || pathname.startsWith("/supplier/")) {
    return SUPPLIER_PORTAL_ROLES;
  }

  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    return null;
  }

  if (
    pathname === "/users" ||
    pathname.startsWith("/users/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  ) {
    return ADMIN_ROLES;
  }

  if (
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/purchase-orders" ||
    pathname.startsWith("/purchase-orders/") ||
    pathname === "/suppliers" ||
    pathname.startsWith("/suppliers/")
  ) {
    return MANAGER_ROLES;
  }

  if (
    pathname === "/goods-received" ||
    pathname.startsWith("/goods-received/") ||
    pathname === "/shelves" ||
    pathname.startsWith("/shelves/") ||
    pathname === "/stock" ||
    pathname.startsWith("/stock/")
  ) {
    return INVENTORY_ROLES;
  }

  if (pathname === "/warehouse" || pathname.startsWith("/warehouse/")) {
    return WAREHOUSE_VIEW_ROLES;
  }

  if (
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    pathname === "/shopping-cart" ||
    pathname.startsWith("/shopping-cart/") ||
    pathname === "/sales" ||
    pathname.startsWith("/sales/") ||
    pathname === "/payments" ||
    pathname.startsWith("/payments/") ||
    pathname === "/customers" ||
    pathname.startsWith("/customers/") ||
    pathname === "/receipt" ||
    pathname.startsWith("/receipt/")
  ) {
    return POS_ROLES;
  }

  if (pathname === "/barcodes" || pathname.startsWith("/barcodes/")) {
    return PRODUCT_ROLES;
  }

  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/digital-twin" ||
    pathname.startsWith("/digital-twin/") ||
    pathname === "/departments" ||
    pathname.startsWith("/departments/") ||
    pathname === "/products" ||
    pathname.startsWith("/products/") ||
    pathname === "/categories" ||
    pathname.startsWith("/categories/")
  ) {
    return EXPLORE_ROLES;
  }

  return STAFF_ROLES;
}

export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (isPublicPath(pathname)) return true;
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  const allowed = requiredRolesForPath(pathname);
  if (allowed === null) return true;
  return allowed.includes(normalized);
}

export function roleLabel(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case "admin":
      return "Admin";
    case "marketmaster":
      return "MarketMaster";
    case "manager":
      return "Manager";
    case "viewer":
      return "Viewer";
    case "supplier":
      return "Supplier";
    case "customer":
      return "Customer";
    default:
      return normalized
        ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
        : "User";
  }
}

export function roleDescription(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case "admin":
      return "Full system administration, user registration, and store settings.";
    case "manager":
      return "Manages all store activities including inventory, viewing products, stock levels, receiving goods, and sending orders to suppliers.";
    case "marketmaster":
      return "Manages Point of Sale (POS), sales, payments, customers, and all products, categories, and barcodes.";
    case "viewer":
      return "Read-only access to overview, 3D store, warehouse, products, and departments.";
    case "supplier":
      return "Self-service supplier portal for assigned products, purchase orders, and deliveries.";
    case "customer":
      return "Public storefront shopper account.";
    default:
      return "Store user account.";
  }
}
