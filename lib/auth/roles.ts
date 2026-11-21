// Role-Based Access Control (RBAC) policy shared by API routes and the UI.

export const ALL_ROLES = [
  "admin",
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
export const MANAGER_ROLES: readonly string[] = ["admin", "manager"];
export const INVENTORY_ROLES: readonly string[] = [
  "admin",
  "manager",
  "inventory_staff",
  "supplier",
];
export const POS_ROLES: readonly string[] = ["admin", "manager", "cashier"];
export const STAFF_ROLES: readonly string[] = [
  "admin",
  "manager",
  "cashier",
  "inventory_staff",
  "supplier",
];
export const EXPLORE_ROLES: readonly string[] = [
  "admin",
  "manager",
  "cashier",
  "inventory_staff",
  "supplier",
  "viewer",
];

export const PUBLIC_PATHS = ["/login", "/register", "/unauthorized"] as const;

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(normalizeRole(role));
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

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) =>
      pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  );
}

/** Allowed roles for an application pathname. Returns null for any signed-in user. */
export function requiredRolesForPath(pathname: string): readonly string[] | null {
  if (isPublicPath(pathname)) return null;
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
    pathname === "/" ||
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
