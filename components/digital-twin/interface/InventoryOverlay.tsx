"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type {
  DigitalTwinSnapshot,
  TwinViewMode,
} from "@/types/digital-twin";

export function InventoryOverlay({
  summary,
  viewMode,
  realtimeConnected,
  lastEventMessage,
}: {
  summary: DigitalTwinSnapshot["summary"];
  viewMode: TwinViewMode;
  realtimeConnected: boolean;
  lastEventMessage: string | null;
}) {
  return (
    <div className="pointer-events-none flex flex-wrap items-center justify-between gap-2">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-teal-200/70 bg-white/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur-md">
        <span className="inline-flex items-center gap-1.5 font-semibold text-teal-900">
          <span
            className={`h-2 w-2 rounded-full ${
              realtimeConnected ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {realtimeConnected ? "Live Sync" : "Reconnecting…"}
        </span>
        <span className="text-border">|</span>
        <span>
          Shelf: <strong className="tabular-nums">{summary.totalShelfUnits}</strong>
        </span>
        <span>
          Warehouse:{" "}
          <strong className="tabular-nums">{summary.totalWarehouseUnits}</strong>
        </span>
        <Badge
          variant={summary.lowStockCount > 0 ? "warning" : "success"}
          className="text-[10px]"
        >
          {summary.lowStockCount} Low
        </Badge>
        <Badge
          variant={summary.outOfStockCount > 0 ? "danger" : "success"}
          className="text-[10px]"
        >
          {summary.outOfStockCount} Out
        </Badge>
        {summary.expiredCount > 0 && (
          <Badge variant="danger" className="text-[10px]">
            {summary.expiredCount} Expired
          </Badge>
        )}
      </div>

      {viewMode !== "realistic" && (
        <div
          className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-teal-200/70 bg-white/90 px-3 py-1.5 text-[11px] shadow-sm backdrop-blur-md"
          aria-label="Inventory visualization legend"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Healthy
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Low Stock
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            Critical / Expired
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            Empty / Inactive
          </span>
        </div>
      )}

      {lastEventMessage && (
        <div
          role="status"
          className="pointer-events-auto rounded-lg border border-emerald-200 bg-emerald-50/95 px-3 py-1 text-xs font-medium text-emerald-900 shadow-sm"
        >
          {lastEventMessage}
        </div>
      )}
    </div>
  );
}
