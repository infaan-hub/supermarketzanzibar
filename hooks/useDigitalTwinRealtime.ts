"use client";

import * as React from "react";
import { getAccessToken } from "@/lib/auth/client";
import type { RealtimeInventoryEvent } from "@/types/digital-twin";

export function useDigitalTwinRealtime(
  onEvent: (event: RealtimeInventoryEvent) => void,
  enabled = true,
) {
  const [connected, setConnected] = React.useState(false);
  const [lastEvent, setLastEvent] =
    React.useState<RealtimeInventoryEvent | null>(null);
  const onEventRef = React.useRef(onEvent);

  React.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const token = getAccessToken();
      if (!token) {
        setConnected(false);
        return;
      }

      es = new EventSource(
        `/api/realtime/events?token=${encodeURIComponent(token)}`,
      );

      es.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as RealtimeInventoryEvent;
          setLastEvent(parsed);
          if (parsed.type !== "connected") {
            onEventRef.current(parsed);
          }
        } catch {
          // ignore malformed keepalive messages
        }
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        if (disposed) return;
        const delayMs = Math.min(30_000, 1500 * Math.pow(1.6, attempt));
        attempt += 1;
        retryTimer = setTimeout(connect, delayMs);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled]);

  return { connected, lastEvent };
}
