// Shared inventory thresholds.
//
// Products do not currently store a per-product minimum, so the dashboard and
// the stock API both use these configured values. Keeping them in one module
// prevents the two views from disagreeing about what "low stock" means.

export const LOW_STOCK_THRESHOLD = 10;
export const REORDER_LEVEL = 20;

export type StockState = "healthy" | "low" | "out";

export function stockState(
  quantity: number,
  threshold = LOW_STOCK_THRESHOLD,
): StockState {
  if (quantity <= 0) return "out";
  if (quantity <= threshold) return "low";
  return "healthy";
}
