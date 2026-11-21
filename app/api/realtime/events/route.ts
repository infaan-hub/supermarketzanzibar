// GET /api/realtime/events — Server-Sent Events stream for live 3D Digital Twin
// synchronization (Phase 12).
//
// EventSource cannot send custom headers in browsers, so we accept either a
// standard `Authorization: Bearer <token>` header or `?token=<accessToken>`.

import type { NextRequest } from "next/server";
import {
  authenticateTokenString,
  extractBearerToken,
} from "@/lib/auth/request";
import { isExplorerRole } from "@/lib/auth/roles";
import { forbidden, unauthorized } from "@/lib/http";
import { subscribeInventoryEvents } from "@/lib/realtime/event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token =
    extractBearerToken(request) ?? searchParams.get("token")?.trim() ?? null;

  const auth = await authenticateTokenString(token);
  if (!auth.ok) {
    return unauthorized(auth.error);
  }
  if (!isExplorerRole(auth.user.role)) {
    return forbidden("Authorized store viewer or staff access is required.");
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed by client.
        }
      };

      send(
        `event: connected\ndata: ${JSON.stringify({
          type: "connected",
          timestamp: new Date().toISOString(),
          user: auth.user.username,
        })}\n\n`,
      );

      unsubscribe = subscribeInventoryEvents((event) => {
        send(`event: inventory\ndata: ${JSON.stringify(event)}\n\n`);
      });

      heartbeat = setInterval(() => {
        send(`: heartbeat ${Date.now()}\n\n`);
      }, 20_000);

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
