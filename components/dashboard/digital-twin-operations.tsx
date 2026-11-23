"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { canAccessPath, portalHref } from "@/lib/auth/roles";
import type { DashboardOverview } from "@/types/api";
import { Panel, PanelHeader, PanelLink } from "./panel";

export function DigitalTwinOperations({
  operations,
}: {
  operations?: DashboardOverview["operations"];
}) {
  const { user } = useAuth();
  const href = (path: string) => portalHref(user?.role, path);
  const canOpen = (path: string) => canAccessPath(user?.role, path);

  const expiringSoon = operations?.expiringSoonCount ?? 0;
  const expired = operations?.expiredCount ?? 0;
  const pendingPOs = operations?.pendingPurchaseOrdersCount ?? 0;
  const whUnits = operations?.warehouseUnitsTotal ?? 0;
  const departments = operations?.departmentPerformance ?? [];

  return (
    <section className="space-y-4">
      <Panel>
        <PanelHeader
          title="Store & warehouse operations"
          description="Batch expiry, replenishment, and 3D floor overview"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link href={href("/digital-twin")}>
                <Button size="sm">3D Store</Button>
              </Link>
              {canOpen("/warehouse") && (
                <Link href={href("/warehouse")}>
                  <Button size="sm" variant="secondary">
                    Warehouse
                  </Button>
                </Link>
              )}
              {canOpen("/purchase-orders") && (
                <Link href={href("/purchase-orders")}>
                  <Button size="sm" variant="secondary">
                    Purchase Orders
                  </Button>
                </Link>
              )}
            </div>
          }
        />

        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-4">
            <p className="text-xs text-muted">Expiring in 14 days</p>
            <div className="mt-1.5 flex items-baseline justify-between">
              <p className="text-xl font-semibold tabular-nums text-warning">
                {expiringSoon}
              </p>
              {canOpen("/stock") && (
                <Link
                  href={href("/stock")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Review batches
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white p-4">
            <p className="text-xs text-muted">Expired active batches</p>
            <div className="mt-1.5 flex items-baseline justify-between">
              <p
                className={`text-xl font-semibold tabular-nums ${
                  expired > 0 ? "text-danger" : "text-foreground"
                }`}
              >
                {expired}
              </p>
              <Badge variant={expired > 0 ? "danger" : "success"}>
                {expired > 0 ? "Action needed" : "Clear"}
              </Badge>
            </div>
          </div>

          <div className="bg-white p-4">
            <p className="text-xs text-muted">Open purchase orders</p>
            <div className="mt-1.5 flex items-baseline justify-between">
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {pendingPOs}
              </p>
              {canOpen("/goods-received") && (
                <Link
                  href={href("/goods-received")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Receive stock
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white p-4">
            <p className="text-xs text-muted">Warehouse reserve</p>
            <div className="mt-1.5 flex items-baseline justify-between">
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {whUnits.toLocaleString()}
              </p>
              {canOpen("/warehouse") && (
                <Link
                  href={href("/warehouse")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Inspect racks
                </Link>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {departments.length > 0 && (
        <Panel>
          <PanelHeader
            title="Department stock"
            description="Click a department to inspect its aisles in 3D"
            action={<PanelLink href="/departments">All departments</PanelLink>}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {departments.map((dept) => (
              <Link
                key={dept.id}
                href={href(`/digital-twin?dept=${encodeURIComponent(dept.code)}`)}
                className="rounded-md border border-border bg-white p-3 transition-colors hover:border-border-hover hover:bg-surface-subtle"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-medium text-muted">
                    {dept.code}
                  </span>
                  {dept.outOfStockCount > 0 ? (
                    <Badge variant="danger">{dept.outOfStockCount} out</Badge>
                  ) : dept.lowStockCount > 0 ? (
                    <Badge variant="warning">{dept.lowStockCount} low</Badge>
                  ) : (
                    <Badge variant="success">OK</Badge>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-semibold text-foreground">
                  {dept.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted tabular-nums">
                  {dept.totalUnits} units · {dept.productCount} SKUs
                </p>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </section>
  );
}
