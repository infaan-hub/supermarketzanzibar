// Role-Based Access Control (RBAC) & multi-portal routing policy shared by
// API routes, AuthProvider, Sidebar, Header, and pages.
//
// Portal layout:
// - Guest (no login): `/` (Public Storefront), `/store-3d` (Read-only 3D Store),
//   `/login`, `/register`, `/unauthorized`.
// - Admin (`admin`): ALL management pages live under `/admin/*`.
// - MarketMaster & Store Staff (`marketmaster`, `manager`, `cashier`,
//   `inventory_staff`, `viewer`): operational root routes (`/dashboard`, `/pos`,
//   `/digital-twin`, `/products`, `/stock`, `/warehouse`, `/shelves`, etc.).
// - Supplier (`supplier`): dedicated self-service portal under `/supplier/*`.

export const ALL_ROLES = [
  "admin",
  "marketmaster",
  "manager",
  "cashier",
  "inventory_staff",
  "viewer",
  "supplier",
  "driver",
  "customer",
] as const;

export type AppRole = (typeof ALL_ROLES)[number];

export const ADMIN_ROLES: readonly string[] = ["admin"];
export const MANAGER_ROLES: readonly string[] = [
  "admin",
  "marketmaster",
  "manager",
];
export const INVENTORY_ROLES: readonly string[] = [
  "admin",
  "marketmaster",
  "manager",
  "inventory_staff",
  "supplier",
];
export const POS_ROLES: readonly string[] = [
  "admin",
  "marketmaster",
  "manager",
  "cashier",
];
export const STAFF_ROLES: readonly string[] = [
  "admin",
  "marketmaster",
  "manager",
  "cashier",
  "inventory_staff",
  "supplier",
];
export const EXPLORE_ROLES: readonly string[] = [
  "admin",
  "marketmaster",
  "manager",
  "cashier",
  "inventory_staff",
  "supplier",
  "viewer",
];
export const SUPPLIER_PORTAL_ROLES: readonly string[] = [
  "supplier",
  "admin",
  "marketmaster",
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

export function isManagerRole(role: string | null | undefined): boolean {
  return MANAGER_ROLES.includes(normalizeRole(role));
}

export function isInventoryRole(role: string | null | undefined): boolean {
  return INVENTORY_ROLES.includes(normalizeRole(role));
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
  if (normalized === "supplier") return "/supplier";
  if (EXPLORE_ROLES.includes(normalized)) return "/dashboard";
  return "/";
}

/**
 * Rewrite an operational route path into the active role's portal namespace.
 * - `admin`: `/dashboard` -> `/admin`, `/pos` -> `/admin/pos`, `/users` -> `/admin/users`
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
    path.startsWith("/admin/")
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

  return path;
}

/**
 * If an administrator visits a legacy non-`/admin/*` management route (like
 * `/dashboard`, `/pos`, `/users`, `/settings`, `/digital-twin`), return its
 * canonical `/admin/...` path so all Admin pages consistently start with `/admin/`.
 * Returns `null` when no redirect is needed (e.g. public storefront `/` or `/store-3d`,
 * `/supplier*`, or already under `/admin`).
 */
export function adminCanonicalRedirect(pathname: string): string | null {
  if (
    pathname === "/" ||
    pathname === "/store-3d" ||
    pathname.startsWith("/store-3d/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
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

/** Allowed roles for an application pathname. Returns null for any signed-in user (or public). */
export function requiredRolesForPath(
  pathname: string,
): readonly string[] | null {
  if (isPublicPath(pathname)) return null;

  // All `/admin` & `/admin/*` pages belong exclusively to administrators.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return ADMIN_ROLES;
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
    pathname.startsWith("/purchase-orders/")
  ) {
    return MANAGER_ROLES;
  }

  if (
    pathname === "/goods-received" ||
    pathname.startsWith("/goods-received/") ||
    pathname === "/shelves" ||
    pathname.startsWith("/shelves/")
  ) {
    return INVENTORY_ROLES;
  }

  if (
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    pathname === "/shopping-cart" ||
    pathname.startsWith("/shopping-cart/")
  ) {
    return POS_ROLES;
  }

  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/digital-twin" ||
    pathname.startsWith("/digital-twin/") ||
    pathname === "/warehouse" ||
    pathname.startsWith("/warehouse/") ||
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
    case "cashier":
      return "Cashier";
    case "inventory_staff":
      return "Inventory Staff";
    case "viewer":
      return "Viewer";
    case "supplier":
      return "Supplier";
    case "driver":
      return "Driver";
    case "customer":
      return "Customer";
    default:
      return normalized
        ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
        : "User";
  }
}
