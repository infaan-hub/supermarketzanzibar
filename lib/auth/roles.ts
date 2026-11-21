// Role-Based Access Control (RBAC) policy shared by API routes and the UI.

export const ALL_ROLES = [
  "admin",
  "manager",
  "cashier",
  "supplier",
  "driver",
  "customer",
] as const;

export type AppRole = (typeof ALL_ROLES)[number];

export const ADMIN_ROLES: readonly string[] = ["admin"];
export const MANAGER_ROLES: readonly string[] = ["admin", "manager"];
export const STAFF_ROLES: readonly string[] = [
  "admin",
  "manager",
  "cashier",
  "supplier",
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

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(normalizeRole(role));
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
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return MANAGER_ROLES;
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
