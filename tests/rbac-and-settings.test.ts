import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  isAdminRole,
  isManagerRole,
  isPublicPath,
  isStaffRole,
} from "../lib/auth/roles";
import {
  DEFAULT_STORE_SETTINGS,
  sanitizeStoreSettings,
} from "../lib/store-settings";
import { generateReceipt } from "../lib/receipt";

describe("RBAC path and role guards", () => {
  it("allows public paths without any role", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/unauthorized")).toBe(true);
    expect(canAccessPath(null, "/login")).toBe(true);
  });

  it("restricts /users and /settings strictly to admin", () => {
    expect(canAccessPath("admin", "/users")).toBe(true);
    expect(canAccessPath("admin", "/settings")).toBe(true);
    expect(canAccessPath("manager", "/users")).toBe(false);
    expect(canAccessPath("cashier", "/settings")).toBe(false);
  });

  it("allows admin and manager on /reports but blocks cashiers and customers", () => {
    expect(canAccessPath("admin", "/reports")).toBe(true);
    expect(canAccessPath("manager", "/reports")).toBe(true);
    expect(canAccessPath("cashier", "/reports")).toBe(false);
    expect(canAccessPath("customer", "/reports")).toBe(false);
  });

  it("allows staff roles on POS, inventory, and dashboard while blocking customers", () => {
    expect(canAccessPath("cashier", "/")).toBe(true);
    expect(canAccessPath("cashier", "/pos")).toBe(true);
    expect(canAccessPath("cashier", "/products/12")).toBe(true);
    expect(canAccessPath("supplier", "/stock/movements")).toBe(true);
    expect(canAccessPath("customer", "/")).toBe(false);
    expect(canAccessPath("customer", "/pos")).toBe(false);
  });

  it("allows any authenticated user to access /profile", () => {
    expect(canAccessPath("customer", "/profile")).toBe(true);
    expect(canAccessPath("driver", "/profile")).toBe(true);
    expect(canAccessPath(null, "/profile")).toBe(false);
  });

  it("normalizes role helpers case-insensitively", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isManagerRole("Manager")).toBe(true);
    expect(isStaffRole("Cashier")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
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
