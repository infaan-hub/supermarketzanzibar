// GET /api/public/realtime — Read-only sanitized Server-Sent Events stream for
// public storefront visitors (`/` and `/store-3d`).
//
// Strictly strips user identities, cost prices, warehouse data, and operational
// notes; emits only public shelf-stock refresh triggers so customers watching
// a 3D shelf see POS sales and restocks reflected live (<200ms).

import type { NextRequest } from "next/server";
import { subscribeInventoryEvents } from "@/lib/realtime/event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream closed by client.
        }
      };

      send(
        `event: connected\ndata: ${JSON.stringify({
          type: "connected",
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );

      unsubscribe = subscribeInventoryEvents((event) => {
        // Strictly sanitized public payload — zero PII, zero warehouse or cost fields.
        // Broadcasts only `{ productId, shelfCode, positionId, quantity }` (plus optional
        // multi-line `updates` array with those exact 4 fields).
        const sanitizedUpdates = Array.isArray(event.updates)
          ? event.updates
              .filter(
                (u) =>
                  typeof u.productId === "string" &&
                  typeof u.quantity === "number" &&
                  Number.isFinite(u.quantity),
              )
              .map((u) => ({
                productId: u.productId,
                ...(u.shelfCode ? { shelfCode: u.shelfCode } : {}),
                ...(u.positionId ? { positionId: u.positionId } : {}),
                quantity: Math.max(0, Math.round(u.quantity)),
              }))
          : undefined;

        const publicEvent = {
          ...(event.productId ? { productId: event.productId } : {}),
          ...(event.shelfCode ? { shelfCode: event.shelfCode } : {}),
          ...(event.positionId ? { positionId: event.positionId } : {}),
          ...(typeof event.quantity === "number" && Number.isFinite(event.quantity)
            ? { quantity: Math.max(0, Math.round(event.quantity)) }
            : {}),
          ...(sanitizedUpdates && sanitizedUpdates.length > 0
            ? { updates: sanitizedUpdates }
            : {}),
          timestamp: event.timestamp,
        };
        send(`event: shelf_update\ndata: ${JSON.stringify(publicEvent)}\n\n`);
      });

      heartbeat = setInterval(() => {
        send(`: heartbeat ${Date.now()}\n\n`);
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
