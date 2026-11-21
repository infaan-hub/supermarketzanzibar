// Store & POS configuration defaults and browser persistence.
//
// Keeps receipt headers, tax rate, low-stock thresholds, and paper width in
// one strongly-typed module without requiring a breaking DB schema migration.

import { LOW_STOCK_THRESHOLD, REORDER_LEVEL } from "@/lib/inventory";

export type ReceiptPaperWidth = "58mm" | "80mm";

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  storePhone: string;
  storeAddress: string;
  taxNumber: string;
  /** Percentage, e.g. 15 means 15%. */
  taxRatePercent: number;
  lowStockThreshold: number;
  reorderLevel: number;
  receiptWidth: ReceiptPaperWidth;
  receiptFooter: string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "Supermarket Zanzibar",
  storeTagline: "Fresh Groceries & Everyday Essentials",
  storePhone: "+255 777 000 000",
  storeAddress: "Stone Town, Zanzibar, Tanzania",
  taxNumber: "",
  taxRatePercent: 15,
  lowStockThreshold: LOW_STOCK_THRESHOLD,
  reorderLevel: REORDER_LEVEL,
  receiptWidth: "80mm",
  receiptFooter: "Thank you for shopping with Supermarket Zanzibar!",
};

const STORAGE_KEY = "sz_store_settings";
export const SETTINGS_EVENT = "sz-settings-change";

export function sanitizeStoreSettings(
  raw: Partial<StoreSettings> | null | undefined,
): StoreSettings {
  const input = raw ?? {};
  const taxRate = Number(input.taxRatePercent);
  const lowThreshold = Number(input.lowStockThreshold);
  const reorder = Number(input.reorderLevel);
  const receiptWidth: ReceiptPaperWidth =
    input.receiptWidth === "58mm" ? "58mm" : "80mm";

  return {
    storeName:
      typeof input.storeName === "string" && input.storeName.trim()
        ? input.storeName.trim().slice(0, 120)
        : DEFAULT_STORE_SETTINGS.storeName,
    storeTagline:
      typeof input.storeTagline === "string"
        ? input.storeTagline.trim().slice(0, 160)
        : DEFAULT_STORE_SETTINGS.storeTagline,
    storePhone:
      typeof input.storePhone === "string"
        ? input.storePhone.trim().slice(0, 40)
        : DEFAULT_STORE_SETTINGS.storePhone,
    storeAddress:
      typeof input.storeAddress === "string"
        ? input.storeAddress.trim().slice(0, 200)
        : DEFAULT_STORE_SETTINGS.storeAddress,
    taxNumber:
      typeof input.taxNumber === "string"
        ? input.taxNumber.trim().slice(0, 60)
        : DEFAULT_STORE_SETTINGS.taxNumber,
    taxRatePercent:
      Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 50
        ? Math.round(taxRate * 100) / 100
        : DEFAULT_STORE_SETTINGS.taxRatePercent,
    lowStockThreshold:
      Number.isInteger(lowThreshold) && lowThreshold >= 0 && lowThreshold <= 10_000
        ? lowThreshold
        : DEFAULT_STORE_SETTINGS.lowStockThreshold,
    reorderLevel:
      Number.isInteger(reorder) && reorder >= 0 && reorder <= 10_000
        ? reorder
        : DEFAULT_STORE_SETTINGS.reorderLevel,
    receiptWidth,
    receiptFooter:
      typeof input.receiptFooter === "string" && input.receiptFooter.trim()
        ? input.receiptFooter.trim().slice(0, 240)
        : DEFAULT_STORE_SETTINGS.receiptFooter,
  };
}

export function readStoreSettings(): StoreSettings {
  if (typeof window === "undefined") return DEFAULT_STORE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORE_SETTINGS;
    return sanitizeStoreSettings(JSON.parse(raw) as Partial<StoreSettings>);
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

export function saveStoreSettings(
  next: Partial<StoreSettings>,
): StoreSettings {
  const merged = sanitizeStoreSettings({ ...readStoreSettings(), ...next });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    } catch {
      // ignore storage errors
    }
  }
  return merged;
}

export function resetStoreSettings(): StoreSettings {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    } catch {
      // ignore
    }
  }
  return DEFAULT_STORE_SETTINGS;
}
