"use client";

import * as React from "react";
import { classifyInventoryState } from "@/lib/digital-twin/inventory-state";
import type {
  DigitalTwinSnapshot,
  PublicShelfStockUpdate,
} from "@/types/digital-twin";

export interface PublicShelfEvent {
  timestamp: string;
  productId?: string;
  shelfCode?: string;
  positionId?: string;
  quantity?: number;
  updates?: PublicShelfStockUpdate[];
}

/**
 * Instantly patch an existing DigitalTwinSnapshot in memory (<5ms) from a
 * sanitized public SSE event `{ productId, shelfCode, positionId, quantity }`.
 * Returns the original reference unchanged when no shelf position matches.
 */
export function applyPublicShelfEventToSnapshot(
  snapshot: DigitalTwinSnapshot | null,
  event: PublicShelfEvent,
): DigitalTwinSnapshot | null {
  if (!snapshot) return snapshot;

  const updates: PublicShelfStockUpdate[] =
    event.updates && event.updates.length > 0
      ? event.updates
      : event.productId && typeof event.quantity === "number"
        ? [
            {
              productId: event.productId,
              shelfCode: event.shelfCode,
              positionId: event.positionId,
              quantity: event.quantity,
            },
          ]
        : [];

  if (updates.length === 0) return snapshot;

  const byPositionId = new Map<string, PublicShelfStockUpdate>();
  const byProductId = new Map<string, PublicShelfStockUpdate>();
  for (const upd of updates) {
    if (upd.positionId) byPositionId.set(upd.positionId, upd);
    else byProductId.set(upd.productId, upd);
  }

  let changed = false;
  let totalShelfUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const nextShelves = snapshot.shelves.map((shelf) => {
    let shelfChanged = false;
    const nextPositions = shelf.positions.map((pos) => {
      const match =
        byPositionId.get(pos.id) ??
        (pos.product ? byProductId.get(pos.product.id) : undefined);

      if (!match) return pos;
      if (match.shelfCode && match.shelfCode !== shelf.code) return pos;

      const nextQty = Math.max(0, Math.round(match.quantity));
      if (nextQty === pos.quantity) return pos;

      shelfChanged = true;
      changed = true;
      return {
        ...pos,
        quantity: nextQty,
        visualState: classifyInventoryState({
          quantity: nextQty,
          reorderLevel: pos.reorderLevel,
        }),
      };
    });

    const placed = nextPositions.filter((p) => p.product !== null);
    const shelfUnits = placed.reduce((sum, p) => sum + p.quantity, 0);
    const shelfLow = placed.filter((p) => p.visualState === "low").length;
    const shelfOut = placed.filter((p) => p.visualState === "out").length;
    totalShelfUnits += shelfUnits;
    lowStockCount += shelfLow;
    outOfStockCount += shelfOut;

    if (!shelfChanged) return shelf;
    return {
      ...shelf,
      totalUnits: shelfUnits,
      lowStockCount: shelfLow,
      restockNeeded: shelfLow > 0 || shelfOut > 0,
      visualState:
        shelfOut > 0 ? ("out" as const) : shelfLow > 0 ? ("low" as const) : ("normal" as const),
      positions: nextPositions,
    };
  });

  if (!changed) return snapshot;

  return {
    ...snapshot,
    generatedAt: event.timestamp || new Date().toISOString(),
    shelves: nextShelves,
    summary: {
      ...snapshot.summary,
      totalShelfUnits,
      lowStockCount,
      outOfStockCount,
    },
  };
}

/**
 * Subscribe to the sanitized public SSE stream (`/api/public/realtime`) so
 * customers viewing the 3D live shelves see POS sales & shelf restocks live (<200ms).
 */
export function usePublicStorefrontRealtime(
  onUpdate: (event: PublicShelfEvent) => void,
  enabled = true,
) {
  const [connected, setConnected] = React.useState(false);
  const callbackRef = React.useRef(onUpdate);

  React.useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      source = new EventSource("/api/public/realtime");

      source.addEventListener("connected", () => {
        if (!disposed) setConnected(true);
      });

      source.addEventListener("shelf_update", (msg) => {
        try {
          const parsed = JSON.parse((msg as MessageEvent).data) as PublicShelfEvent;
          callbackRef.current(parsed);
        } catch {
          // ignore malformed payload
        }
      });

      source.onerror = () => {
        if (disposed) return;
        setConnected(false);
        source?.close();
        source = null;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connect, 4500);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [enabled]);

  return { connected };
}
