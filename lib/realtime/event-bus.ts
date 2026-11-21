// In-process Server-Sent Events (SSE) realtime pub/sub bus.
//
// Stored on `globalThis` so all Next.js Route Handlers share one event hub.
// Events are emitted ONLY after PostgreSQL transactions commit successfully.

import { EventEmitter } from "node:events";
import type { RealtimeInventoryEvent } from "@/types/digital-twin";

const EVENT_CHANNEL = "sz:inventory-event";

const globalForBus = globalThis as unknown as {
  __szRealtimeBus?: EventEmitter;
};

function getBus(): EventEmitter {
  if (!globalForBus.__szRealtimeBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalForBus.__szRealtimeBus = emitter;
  }
  return globalForBus.__szRealtimeBus;
}

export function publishInventoryEvent(
  event: Omit<RealtimeInventoryEvent, "timestamp"> & { timestamp?: string },
): RealtimeInventoryEvent {
  const payload: RealtimeInventoryEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  getBus().emit(EVENT_CHANNEL, payload);
  return payload;
}

export function subscribeInventoryEvents(
  listener: (event: RealtimeInventoryEvent) => void,
): () => void {
  const bus = getBus();
  bus.on(EVENT_CHANNEL, listener);
  return () => {
    bus.off(EVENT_CHANNEL, listener);
  };
}
