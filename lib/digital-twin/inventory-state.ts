// Pure operational inventory-state classification & color semantics shared
// across the 3D Digital Twin, Heatmap, Warehouse, and 2D Floor-Plan views.

import type { InventoryVisualState } from "@/types/digital-twin";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";

export interface InventoryStateInput {
  quantity: number;
  reorderLevel?: number;
  reservedQuantity?: number;
  isExpired?: boolean;
  isRestocking?: boolean;
  isActive?: boolean;
}

export function classifyInventoryState(
  input: InventoryStateInput,
): InventoryVisualState {
  if (input.isRestocking) return "restocking";
  if (input.isExpired) return "expired";
  if (input.quantity <= 0) return "out";
  const threshold = input.reorderLevel ?? LOW_STOCK_THRESHOLD;
  if (input.quantity <= threshold) return "low";
  if ((input.reservedQuantity ?? 0) > 0 && input.reservedQuantity! >= input.quantity * 0.5) {
    return "reserved";
  }
  return "normal";
}

export interface VisualStateStyle {
  label: string;
  color: string;
  emissive: string;
  badgeTone: "success" | "warning" | "danger" | "secondary" | "default";
  description: string;
}

export const INVENTORY_STATE_STYLES: Record<
  InventoryVisualState,
  VisualStateStyle
> = {
  normal: {
    label: "Healthy Stock",
    color: "#14b8a6",
    emissive: "#0f766e",
    badgeTone: "success",
    description: "Stock level is above the reorder threshold.",
  },
  low: {
    label: "Low Stock",
    color: "#f59e0b",
    emissive: "#b45309",
    badgeTone: "warning",
    description: "At or below reorder point — replenishment recommended.",
  },
  out: {
    label: "Out of Stock",
    color: "#ef4444",
    emissive: "#b91c1c",
    badgeTone: "danger",
    description: "Zero units available on this shelf or location.",
  },
  expired: {
    label: "Expired Batch",
    color: "#dc2626",
    emissive: "#991b1b",
    badgeTone: "danger",
    description: "Contains an expired inventory batch requiring removal.",
  },
  reserved: {
    label: "Reserved Stock",
    color: "#0284c7",
    emissive: "#0369a1",
    badgeTone: "default",
    description: "Allocated to pending orders or active transfers.",
  },
  restocking: {
    label: "Restocking",
    color: "#10b981",
    emissive: "#047857",
    badgeTone: "success",
    description: "Active stock transfer committed from warehouse.",
  },
};

export function heatmapColorForState(
  state: InventoryVisualState,
  active = true,
): string {
  if (!active) return "#94a3b8";
  switch (state) {
    case "normal":
    case "restocking":
    case "reserved":
      return "#16a34a"; // Green: healthy
    case "low":
      return "#f59e0b"; // Amber: low stock
    case "out":
    case "expired":
      return "#dc2626"; // Red: critical
  }
}
