"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { PHYSICAL_AREAS } from "@/lib/digital-twin/spatial-plan";
import type {
  TwinDepartmentNode,
  TwinSelection,
  TwinShelfNode,
  TwinWarehouseRackNode,
} from "@/types/digital-twin";
import { cn } from "@/lib/utils";

export function DepartmentNavigation({
  departments,
  shelves,
  warehouseRacks,
  selection,
  onSelectDepartment,
  onSelectShelf,
  onSelectWarehouseRack,
  onResetOverview,
}: {
  departments: TwinDepartmentNode[];
  shelves: TwinShelfNode[];
  warehouseRacks: TwinWarehouseRackNode[];
  selection: TwinSelection;
  onSelectDepartment: (code: string) => void;
  onSelectShelf: (shelf: TwinShelfNode) => void;
  onSelectWarehouseRack: (rack: TwinWarehouseRackNode) => void;
  onResetOverview: () => void;
}) {
  const [tab, setTab] = React.useState<"departments" | "shelves" | "warehouse">(
    "departments",
  );

  const deptByCode = React.useMemo(
    () => new Map(departments.map((d) => [d.code.toUpperCase(), d])),
    [departments],
  );

  const retailAreas = PHYSICAL_AREAS.filter((a) => a.category === "retail");

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-1 border-b border-border bg-surface-subtle p-1.5">
        {(
          [
            { key: "departments", label: "Depts" },
            { key: "shelves", label: "Shelves" },
            { key: "warehouse", label: "Warehouse" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
              tab === item.key
                ? "bg-white font-semibold text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {tab === "departments" && (
          <>
            <button
              type="button"
              onClick={onResetOverview}
              className={cn(
                "flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer",
                selection === null
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-white hover:bg-surface-subtle",
              )}
            >
              <span>Full store overview</span>
              <span className="text-[11px] text-muted">18 areas</span>
            </button>

            {retailAreas.map((area) => {
              const dept = deptByCode.get(area.code.toUpperCase());
              const active =
                selection?.type === "department" &&
                selection.departmentCode === area.code;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => onSelectDepartment(area.code)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition-colors cursor-pointer",
                    active
                      ? "border-primary bg-primary-soft text-foreground"
                      : "border-border bg-white hover:bg-surface-subtle",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: area.accentColor }}
                      />
                      <span className="truncate text-xs font-medium text-foreground">
                        {area.name}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate pl-4 text-[11px] text-muted">
                      {area.aisleNumber ?? area.code} · {dept?.totalUnits ?? 0}{" "}
                      units
                    </p>
                  </div>
                  {(dept?.lowStockCount ?? 0) > 0 && (
                    <Badge variant="warning" className="text-[10px]">
                      {dept?.lowStockCount} low
                    </Badge>
                  )}
                </button>
              );
            })}
          </>
        )}

        {tab === "shelves" &&
          shelves.map((shelf) => {
            const active =
              selection?.type === "shelf" && selection.shelfId === shelf.id;
            return (
              <button
                key={shelf.id}
                type="button"
                onClick={() => onSelectShelf(shelf)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition-colors cursor-pointer",
                  active
                    ? "border-primary bg-primary-soft text-foreground"
                    : "border-border bg-white hover:bg-surface-subtle",
                )}
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-primary">
                    {shelf.code}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {shelf.departmentName} · {shelf.totalUnits}/{shelf.capacity}
                  </p>
                </div>
                <Badge
                  variant={
                    shelf.visualState === "out" || shelf.visualState === "expired"
                      ? "danger"
                      : shelf.visualState === "low"
                        ? "warning"
                        : "success"
                  }
                  className="text-[10px]"
                >
                  {shelf.productCount} SKUs
                </Badge>
              </button>
            );
          })}

        {tab === "warehouse" &&
          warehouseRacks.map((rack) => {
            const active =
              selection?.type === "warehouse_position" &&
              selection.rackCode === rack.rackCode;
            return (
              <button
                key={rack.rackCode}
                type="button"
                onClick={() => onSelectWarehouseRack(rack)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition-colors cursor-pointer",
                  active
                    ? "border-primary bg-primary-soft text-foreground"
                    : "border-border bg-white hover:bg-surface-subtle",
                )}
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-warning">
                    {rack.rackCode}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {rack.zoneCode} · {rack.totalUnits} units stored
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {rack.locationType}
                </Badge>
              </button>
            );
          })}
      </div>
    </div>
  );
}
