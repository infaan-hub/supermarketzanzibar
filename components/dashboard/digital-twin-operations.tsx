"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardOverview } from "@/types/api";

export function DigitalTwinOperations({
  operations,
}: {
  operations?: DashboardOverview["operations"];
}) {
  const expiringSoon = operations?.expiringSoonCount ?? 0;
  const expired = operations?.expiredCount ?? 0;
  const pendingPOs = operations?.pendingPurchaseOrdersCount ?? 0;
  const whUnits = operations?.warehouseUnitsTotal ?? 0;
  const departments = operations?.departmentPerformance ?? [];

  return (
    <section className="space-y-4">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 shadow-sm">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            3D Digital Twin Supermarket & Warehouse
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-foreground">
            Live Spatial Store Operations
          </h2>
          <p className="mt-1 text-xs text-muted">
            Explore all 18 physical store zones, inspect live PostgreSQL shelf
            quantities, view 3D inventory heatmaps, and restock directly from
            warehouse racks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/digital-twin">
            <Button size="sm">Launch 3D Supermarket</Button>
          </Link>
          <Link href="/warehouse">
            <Button size="sm" variant="secondary">
              3D Warehouse
            </Button>
          </Link>
          <Link href="/purchase-orders">
            <Button size="sm" variant="secondary">
              Purchase Orders
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Expiring Within 14 Days</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="font-display text-2xl font-bold tabular-nums text-amber-700">
                {expiringSoon}
              </p>
              <Link
                href="/stock"
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Review batches
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Expired Active Batches</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p
                className={`font-display text-2xl font-bold tabular-nums ${
                  expired > 0 ? "text-danger" : "text-success"
                }`}
              >
                {expired}
              </p>
              <Badge variant={expired > 0 ? "danger" : "success"}>
                {expired > 0 ? "Action needed" : "Clear"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Pending Purchase Orders</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                {pendingPOs}
              </p>
              <Link
                href="/goods-received"
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Receive stock
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Warehouse Reserve Stock</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="font-display text-2xl font-bold tabular-nums text-teal-800">
                {whUnits.toLocaleString()}
              </p>
              <Link
                href="/warehouse"
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Inspect racks
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {departments.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              Department Stock Performance
            </CardTitle>
            <Link
              href="/departments"
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              View all departments
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {departments.map((dept) => (
                <Link
                  key={dept.id}
                  href={`/digital-twin?dept=${encodeURIComponent(dept.code)}`}
                  className="group rounded-xl border border-border bg-surface-subtle/60 p-3 transition-colors hover:border-teal-500 hover:bg-teal-50/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-teal-800">
                      {dept.code}
                    </span>
                    {dept.outOfStockCount > 0 ? (
                      <Badge variant="danger" className="text-[10px]">
                        {dept.outOfStockCount} out
                      </Badge>
                    ) : dept.lowStockCount > 0 ? (
                      <Badge variant="warning" className="text-[10px]">
                        {dept.lowStockCount} low
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px]">
                        OK
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-foreground group-hover:text-teal-900">
                    {dept.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted tabular-nums">
                    {dept.totalUnits} units · {dept.productCount} SKUs
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
