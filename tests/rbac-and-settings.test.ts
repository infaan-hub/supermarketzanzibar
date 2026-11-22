import { describe, expect, it } from "vitest";
import {
  adminCanonicalRedirect,
  canAccessPath,
  defaultHomeForRole,
  isAdminRole,
  isExplorerRole,
  isInventoryRole,
  isManagerRole,
  isMarketMasterRole,
  isPosRole,
  isPublicPath,
  isStaffRole,
  portalHref,
  roleLabel,
} from "../lib/auth/roles";
import {
  DEFAULT_STORE_SETTINGS,
  sanitizeStoreSettings,
} from "../lib/store-settings";
import { generateReceipt } from "../lib/receipt";

describe("RBAC path and role guards", () => {
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
    expect(canAccessPath("manager", "/admin/users")).toBe(false);
    expect(canAccessPath("manager", "/users")).toBe(false);
    expect(canAccessPath("cashier", "/settings")).toBe(false);
    expect(canAccessPath("supplier", "/admin")).toBe(false);
  });

  it("allows admin, marketmaster, and manager on /reports but blocks cashiers and customers", () => {
    expect(canAccessPath("admin", "/reports")).toBe(true);
    expect(canAccessPath("marketmaster", "/reports")).toBe(true);
    expect(canAccessPath("manager", "/reports")).toBe(true);
    expect(canAccessPath("cashier", "/reports")).toBe(false);
    expect(canAccessPath("customer", "/reports")).toBe(false);
  });

  it("allows staff roles on /dashboard, POS, and inventory while blocking customers from staff screens", () => {
    expect(canAccessPath("marketmaster", "/dashboard")).toBe(true);
    expect(canAccessPath("marketmaster", "/pos")).toBe(true);
    expect(canAccessPath("marketmaster", "/purchase-orders")).toBe(true);
    expect(canAccessPath("cashier", "/dashboard")).toBe(true);
    expect(canAccessPath("cashier", "/pos")).toBe(true);
    expect(canAccessPath("cashier", "/products/12")).toBe(true);
    expect(canAccessPath("supplier", "/supplier")).toBe(true);
    expect(canAccessPath("supplier", "/supplier/orders")).toBe(true);
    expect(canAccessPath("supplier", "/stock/movements")).toBe(true);
    expect(canAccessPath("customer", "/dashboard")).toBe(false);
    expect(canAccessPath("customer", "/pos")).toBe(false);
    expect(canAccessPath("customer", "/supplier")).toBe(false);
    // Customers can browse the public storefront `/` and `/store-3d`.
    expect(canAccessPath("customer", "/")).toBe(true);
    expect(canAccessPath("customer", "/store-3d")).toBe(true);
  });

  it("routes each role to its proper portal namespace and default landing page", () => {
    expect(defaultHomeForRole("admin")).toBe("/admin");
    expect(defaultHomeForRole("marketmaster")).toBe("/dashboard");
    expect(defaultHomeForRole("manager")).toBe("/dashboard");
    expect(defaultHomeForRole("cashier")).toBe("/dashboard");
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
    expect(canAccessPath("driver", "/profile")).toBe(true);
    expect(canAccessPath(null, "/profile")).toBe(false);
  });

  it("normalizes role helpers case-insensitively", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isMarketMasterRole("MarketMaster")).toBe(true);
    expect(roleLabel("marketmaster")).toBe("MarketMaster");
    expect(isManagerRole("marketmaster")).toBe(true);
    expect(isManagerRole("Manager")).toBe(true);
    expect(isStaffRole("Cashier")).toBe(true);
    expect(isInventoryRole("inventory_staff")).toBe(true);
    expect(isPosRole("cashier")).toBe(true);
    expect(isPosRole("viewer")).toBe(false);
    expect(isExplorerRole("viewer")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
  });

  it("enforces Phase 16 Digital Twin, Warehouse, Shelves, and Procurement RBAC", () => {
    // Viewer can explore 3D store, warehouse & departments, but not POS/shelves/GRN/POs/users.
    expect(canAccessPath("viewer", "/digital-twin")).toBe(true);
    expect(canAccessPath("viewer", "/warehouse")).toBe(true);
    expect(canAccessPath("viewer", "/departments")).toBe(true);
    expect(canAccessPath("viewer", "/pos")).toBe(false);
    expect(canAccessPath("viewer", "/shelves")).toBe(false);
    expect(canAccessPath("viewer", "/goods-received")).toBe(false);
    expect(canAccessPath("viewer", "/purchase-orders")).toBe(false);

    // Inventory staff can manage shelves & goods received, but not POS or POs or users.
    expect(canAccessPath("inventory_staff", "/digital-twin")).toBe(true);
    expect(canAccessPath("inventory_staff", "/shelves")).toBe(true);
    expect(canAccessPath("inventory_staff", "/goods-received")).toBe(true);
    expect(canAccessPath("inventory_staff", "/pos")).toBe(false);
    expect(canAccessPath("inventory_staff", "/purchase-orders")).toBe(false);
    expect(canAccessPath("inventory_staff", "/users")).toBe(false);

    // Manager can manage purchase orders, shelves, POS, and reports, but not /users.
    expect(canAccessPath("manager", "/purchase-orders")).toBe(true);
    expect(canAccessPath("manager", "/goods-received")).toBe(true);
    expect(canAccessPath("manager", "/digital-twin")).toBe(true);
    expect(canAccessPath("manager", "/users")).toBe(false);
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
