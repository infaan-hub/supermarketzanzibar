import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  adminCanonicalRedirect,
  canAccessPath,
  defaultHomeForRole,
  isAdminRole,
  isExplorerRole,
  isInventoryRole,
  isManagerRole,
  isMarketMasterRole,
  isPosRole,
  isProductRole,
  isPublicPath,
  isStaffRole,
  portalHref,
  roleDescription,
  roleLabel,
} from "../lib/auth/roles";
import {
  DEFAULT_STORE_SETTINGS,
  sanitizeStoreSettings,
} from "../lib/store-settings";
import {
  hashPassword,
  isUsablePassword,
  verifyPassword,
} from "../lib/auth/password";
import { generateReceipt } from "../lib/receipt";

describe("RBAC path and role guards", () => {
  it("registers manager and marketmaster while removing cashier, inventory_staff, and driver", () => {
    expect(ALL_ROLES).toContain("admin");
    expect(ALL_ROLES).toContain("manager");
    expect(ALL_ROLES).toContain("marketmaster");
    expect(ALL_ROLES).not.toContain("cashier");
    expect(ALL_ROLES).not.toContain("inventory_staff");
    expect(ALL_ROLES).not.toContain("driver");

    // Removed roles have zero operational access.
    expect(isStaffRole("cashier")).toBe(false);
    expect(isPosRole("cashier")).toBe(false);
    expect(isProductRole("cashier")).toBe(false);
    expect(isInventoryRole("inventory_staff")).toBe(false);
    expect(isStaffRole("inventory_staff")).toBe(false);
    expect(isStaffRole("driver")).toBe(false);
    expect(canAccessPath("cashier", "/pos")).toBe(false);
    expect(canAccessPath("cashier", "/dashboard")).toBe(false);
    expect(canAccessPath("inventory_staff", "/shelves")).toBe(false);
    expect(canAccessPath("inventory_staff", "/goods-received")).toBe(false);
    expect(canAccessPath("inventory_staff", "/stock")).toBe(false);
    expect(canAccessPath("driver", "/dashboard")).toBe(false);
    expect(canAccessPath("driver", "/pos")).toBe(false);
  });

  it("allows guest public storefront and auth paths without any role", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/store-3d")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/unauthorized")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(canAccessPath(null, "/")).toBe(true);
    expect(canAccessPath(null, "/store-3d")).toBe(true);
    expect(canAccessPath(null, "/login")).toBe(true);
    expect(canAccessPath(null, "/dashboard")).toBe(false);
  });

  it("restricts /admin/*, /users, and /settings strictly to admin", () => {
    expect(canAccessPath("admin", "/admin")).toBe(true);
    expect(canAccessPath("admin", "/admin/users")).toBe(true);
    expect(canAccessPath("admin", "/admin/digital-twin")).toBe(true);
    expect(canAccessPath("admin", "/users")).toBe(true);
    expect(canAccessPath("admin", "/settings")).toBe(true);

    expect(canAccessPath("marketmaster", "/admin")).toBe(false);
    expect(canAccessPath("marketmaster", "/admin/pos")).toBe(false);
    expect(canAccessPath("marketmaster", "/users")).toBe(false);
    expect(canAccessPath("marketmaster", "/settings")).toBe(false);
    expect(canAccessPath("manager", "/admin/users")).toBe(false);
    expect(canAccessPath("manager", "/users")).toBe(false);
    expect(canAccessPath("manager", "/settings")).toBe(false);
    expect(canAccessPath("supplier", "/admin")).toBe(false);
  });

  it("allows admin and manager across all store, inventory, stock, receiving, and supplier activities", () => {
    expect(canAccessPath("admin", "/reports")).toBe(true);
    expect(canAccessPath("manager", "/reports")).toBe(true);
    expect(canAccessPath("manager", "/dashboard")).toBe(true);
    expect(canAccessPath("manager", "/pos")).toBe(true);
    expect(canAccessPath("manager", "/sales")).toBe(true);
    expect(canAccessPath("manager", "/payments")).toBe(true);
    expect(canAccessPath("manager", "/customers")).toBe(true);
    expect(canAccessPath("manager", "/products")).toBe(true);
    expect(canAccessPath("manager", "/products/12")).toBe(true);
    expect(canAccessPath("manager", "/categories")).toBe(true);
    expect(canAccessPath("manager", "/barcodes")).toBe(true);
    expect(canAccessPath("manager", "/stock")).toBe(true);
    expect(canAccessPath("manager", "/stock/movements")).toBe(true);
    expect(canAccessPath("manager", "/warehouse")).toBe(true);
    expect(canAccessPath("manager", "/shelves")).toBe(true);
    expect(canAccessPath("manager", "/departments")).toBe(true);
    expect(canAccessPath("manager", "/digital-twin")).toBe(true);
    expect(canAccessPath("manager", "/goods-received")).toBe(true);
    expect(canAccessPath("manager", "/purchase-orders")).toBe(true);
    expect(canAccessPath("manager", "/suppliers")).toBe(true);
    expect(canAccessPath("manager", "/supplier")).toBe(true);

    expect(canAccessPath("customer", "/reports")).toBe(false);
  });

  it("scopes marketmaster to POS, sales, payments, customers, and all products", () => {
    expect(canAccessPath("marketmaster", "/dashboard")).toBe(true);
    expect(canAccessPath("marketmaster", "/pos")).toBe(true);
    expect(canAccessPath("marketmaster", "/shopping-cart")).toBe(true);
    expect(canAccessPath("marketmaster", "/sales")).toBe(true);
    expect(canAccessPath("marketmaster", "/payments")).toBe(true);
    expect(canAccessPath("marketmaster", "/customers")).toBe(true);
    expect(canAccessPath("marketmaster", "/products")).toBe(true);
    expect(canAccessPath("marketmaster", "/products/12")).toBe(true);
    expect(canAccessPath("marketmaster", "/categories")).toBe(true);
    expect(canAccessPath("marketmaster", "/barcodes")).toBe(true);
    expect(canAccessPath("marketmaster", "/digital-twin")).toBe(true);
    expect(canAccessPath("marketmaster", "/departments")).toBe(true);

    // Supplier procurement, receiving, warehouse, stock batches, shelves & reports belong to Manager/Admin.
    expect(canAccessPath("marketmaster", "/reports")).toBe(false);
    expect(canAccessPath("marketmaster", "/purchase-orders")).toBe(false);
    expect(canAccessPath("marketmaster", "/goods-received")).toBe(false);
    expect(canAccessPath("marketmaster", "/suppliers")).toBe(false);
    expect(canAccessPath("marketmaster", "/supplier")).toBe(false);
    expect(canAccessPath("marketmaster", "/stock")).toBe(false);
    expect(canAccessPath("marketmaster", "/stock/movements")).toBe(false);
    expect(canAccessPath("marketmaster", "/shelves")).toBe(false);
    expect(canAccessPath("marketmaster", "/warehouse")).toBe(false);

    // Supplier portal & storefront access for suppliers and customers.
    expect(canAccessPath("supplier", "/supplier")).toBe(true);
    expect(canAccessPath("supplier", "/supplier/orders")).toBe(true);
    expect(canAccessPath("supplier", "/stock/movements")).toBe(true);
    expect(canAccessPath("customer", "/dashboard")).toBe(false);
    expect(canAccessPath("customer", "/pos")).toBe(false);
    expect(canAccessPath("customer", "/supplier")).toBe(false);
    expect(canAccessPath("customer", "/")).toBe(true);
    expect(canAccessPath("customer", "/store-3d")).toBe(true);
  });

  it("routes each role to its proper portal namespace and default landing page", () => {
    expect(defaultHomeForRole("admin")).toBe("/admin");
    expect(defaultHomeForRole("marketmaster")).toBe("/dashboard");
    expect(defaultHomeForRole("manager")).toBe("/dashboard");
    expect(defaultHomeForRole("supplier")).toBe("/supplier");
    expect(defaultHomeForRole("customer")).toBe("/");

    expect(portalHref("admin", "/dashboard")).toBe("/admin");
    expect(portalHref("admin", "/products")).toBe("/admin/products");
    expect(portalHref("admin", "/digital-twin?dept=BEV")).toBe(
      "/admin/digital-twin?dept=BEV",
    );
    expect(portalHref("admin", "/")).toBe("/");

    expect(portalHref("marketmaster", "/dashboard")).toBe("/dashboard");
    expect(portalHref("marketmaster", "/products")).toBe("/products");

    expect(adminCanonicalRedirect("/dashboard")).toBe("/admin");
    expect(adminCanonicalRedirect("/users")).toBe("/admin/users");
    expect(adminCanonicalRedirect("/pos")).toBe("/admin/pos");
    expect(adminCanonicalRedirect("/admin/users")).toBe(null);
    expect(adminCanonicalRedirect("/")).toBe(null);
    expect(adminCanonicalRedirect("/store-3d")).toBe(null);
  });

  it("allows any authenticated user to access /profile", () => {
    expect(canAccessPath("customer", "/profile")).toBe(true);
    expect(canAccessPath("viewer", "/profile")).toBe(true);
    expect(canAccessPath("supplier", "/profile")).toBe(true);
    expect(canAccessPath(null, "/profile")).toBe(false);
  });

  it("normalizes role helpers case-insensitively", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isMarketMasterRole("MarketMaster")).toBe(true);
    expect(roleLabel("marketmaster")).toBe("MarketMaster");
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleDescription("manager")).toContain("inventory");
    expect(roleDescription("marketmaster")).toContain("POS");
    expect(isManagerRole("Manager")).toBe(true);
    expect(isManagerRole("marketmaster")).toBe(false);
    expect(isInventoryRole("manager")).toBe(true);
    expect(isInventoryRole("marketmaster")).toBe(false);
    expect(isProductRole("marketmaster")).toBe(true);
    expect(isProductRole("manager")).toBe(true);
    expect(isPosRole("marketmaster")).toBe(true);
    expect(isPosRole("manager")).toBe(true);
    expect(isPosRole("viewer")).toBe(false);
    expect(isExplorerRole("viewer")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
  });

  it("enforces Digital Twin, Warehouse, Shelves, and Procurement RBAC for viewer", () => {
    // Viewer can explore 3D store, warehouse & departments, but not POS/shelves/GRN/POs/users.
    expect(canAccessPath("viewer", "/digital-twin")).toBe(true);
    expect(canAccessPath("viewer", "/warehouse")).toBe(true);
    expect(canAccessPath("viewer", "/departments")).toBe(true);
    expect(canAccessPath("viewer", "/pos")).toBe(false);
    expect(canAccessPath("viewer", "/shelves")).toBe(false);
    expect(canAccessPath("viewer", "/goods-received")).toBe(false);
    expect(canAccessPath("viewer", "/purchase-orders")).toBe(false);
    expect(canAccessPath("viewer", "/users")).toBe(false);
  });
});

describe("store settings sanitization", () => {
  it("falls back to defaults on invalid or out-of-range values", () => {
    const clean = sanitizeStoreSettings({
      storeName: "   ",
      taxRatePercent: 999,
      lowStockThreshold: -5,
      receiptWidth: "invalid" as never,
    });
    expect(clean.storeName).toBe(DEFAULT_STORE_SETTINGS.storeName);
    expect(clean.taxRatePercent).toBe(DEFAULT_STORE_SETTINGS.taxRatePercent);
    expect(clean.lowStockThreshold).toBe(
      DEFAULT_STORE_SETTINGS.lowStockThreshold,
    );
    expect(clean.receiptWidth).toBe("80mm");
  });

  it("preserves valid custom store settings", () => {
    const clean = sanitizeStoreSettings({
      storeName: "Zanzibar Fresh Mart",
      taxRatePercent: 18,
      receiptWidth: "58mm",
      taxNumber: "102-334-556",
    });
    expect(clean.storeName).toBe("Zanzibar Fresh Mart");
    expect(clean.taxRatePercent).toBe(18);
    expect(clean.receiptWidth).toBe("58mm");
    expect(clean.taxNumber).toBe("102-334-556");
  });
});

describe("text receipt formatting", () => {
  it("formats currency in Tanzanian Shillings without dollar signs", () => {
    const output = generateReceipt({
      saleId: "42",
      controlNumber: "ZN26112200000042",
      customerFullName: "Amina",
      customerEmail: "amina@example.com",
      items: [
        {
          productId: "1",
          productName: "Zanzibar Rice 5kg",
          price: 15000,
          quantity: 2,
          lineTotal: 30000,
        },
      ],
      subtotal: 30000,
      discount: 2000,
      taxAmount: 4200,
      taxRatePercent: 15,
      grandTotal: 32200,
      paymentMethod: "mobile_money",
      paymentStatus: "confirmed",
      createdAt: new Date("2026-11-22T09:00:00Z"),
    });

    expect(output).toContain("SUPERMARKET ZANZIBAR RECEIPT");
    expect(output).toContain("Control #: ZN26112200000042");
    expect(output).toContain("Discount");
    expect(output).not.toContain("$");
  });
});

describe("admin-set user login passwords", () => {
  it("hashes and verifies PBKDF2-SHA256 login passwords within the 128-char DB limit", () => {
    const raw = "Zanzibar#2026!";
    const hashed = hashPassword(raw);
    expect(hashed.length).toBeLessThanOrEqual(128);
    expect(isUsablePassword(hashed)).toBe(true);
    expect(verifyPassword(raw, hashed)).toBe(true);
    expect(verifyPassword("WrongPassword1!", hashed)).toBe(false);
  });
});
