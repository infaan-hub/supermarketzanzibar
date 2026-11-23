// Express Store Pickup / POS Basket Code encoder & decoder.
//
// Encodes a customer's 3D-picked shopping basket into a compact, scannable
// token (`SZPICK1:12x2,45x1`) suitable for QR codes and direct POS scanning.
// Prices are NEVER trusted from the code — POS always re-prices every product
// from live PostgreSQL records.

export const PICKUP_CODE_PREFIX = "SZPICK1:";

export interface PickupCodeEntry {
  productId: string;
  quantity: number;
}

export function encodePickupCode(entries: PickupCodeEntry[]): string {
  const merged = new Map<string, number>();
  for (const entry of entries) {
    const id = entry.productId.trim();
    const qty = Math.floor(entry.quantity);
    if (!/^\d+$/.test(id) || qty <= 0) continue;
    merged.set(id, Math.min(999, (merged.get(id) ?? 0) + qty));
  }

  const pairs = Array.from(merged.entries())
    .slice(0, 30)
    .map(([id, qty]) => `${id}x${qty}`);

  return pairs.length > 0 ? `${PICKUP_CODE_PREFIX}${pairs.join(",")}` : "";
}

export function isPickupCode(raw: string | null | undefined): boolean {
  return Boolean(raw && raw.trim().toUpperCase().startsWith(PICKUP_CODE_PREFIX));
}

export function decodePickupCode(raw: string): PickupCodeEntry[] {
  const cleaned = raw.trim();
  if (!isPickupCode(cleaned)) return [];
  const body = cleaned.slice(PICKUP_CODE_PREFIX.length);
  if (!body) return [];

  const result: PickupCodeEntry[] = [];
  for (const token of body.split(",").slice(0, 30)) {
    const match = /^(\d+)x(\d+)$/i.exec(token.trim());
    if (!match) continue;
    const productId = match[1];
    const quantity = Math.min(999, Math.max(1, Number(match[2])));
    if (Number.isFinite(quantity) && quantity > 0) {
      result.push({ productId, quantity });
    }
  }
  return result;
}
