"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchSupplierPortal } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { SupplierPortalResponse } from "@/types/api";

export type SupplierPortalSection =
  | "overview"
  | "products"
  | "orders"
  | "deliveries";

export function SupplierPortalView({
  section = "overview",
}: {
  section?: SupplierPortalSection;
}) {
  const [data, setData] = React.useState<SupplierPortalResponse | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSupplierPortal(selectedSupplierId || undefined);
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load supplier portal.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedSupplierId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const supplier = data?.supplier ?? null;
  const lowStockProducts = (data?.products ?? []).filter((p) => p.needsRestock);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Supplier Portal"
        title={supplier ? supplier.companyName : "Supplier Workspace"}
        description={
          supplier
            ? `${supplier.contactName} · ${supplier.email}${supplier.phone ? ` · ${supplier.phone}` : ""}`
            : "Track your supplied catalog, low-stock replenishment alerts, purchase orders, and receiving receipts."
        }
        actions={
          <>
            {(data?.availableSuppliers.length ?? 0) > 1 && (
              <Select
                value={selectedSupplierId || supplier?.id || ""}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="h-9 w-52 text-xs"
                aria-label="Select supplier account"
              >
                {data?.availableSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </Select>
            )}
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
          </>
        }
      />

      {/* Sub-navigation pills */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "overview", href: "/supplier", label: "Overview" },
            { key: "products", href: "/supplier/products", label: "My Products" },
            { key: "orders", href: "/supplier/orders", label: "Purchase Orders" },
            {
              key: "deliveries",
              href: "/supplier/deliveries",
              label: "Deliveries & GRN",
            },
          ] as const
        ).map((tab) => (
          <Link key={tab.key} href={tab.href}>
            <Button
              size="sm"
              variant={section === tab.key ? "default" : "secondary"}
            >
              {tab.label}
            </Button>
          </Link>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-muted">Loading supplier portal data…</p>
      ) : !supplier ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-display text-base font-bold text-foreground">
              No supplier profile linked yet
            </p>
            <p className="mt-1 text-xs text-muted">
              Ask an administrator to link your account to a supplier company
              profile in <code>/admin/suppliers</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted">Supplied Products</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                  {data?.summary.productsCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted">Low Stock Alerts</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-amber-700">
                  {data?.summary.lowStockCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted">Out of Stock</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-danger">
                  {data?.summary.outOfStockCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted">Open Purchase Orders</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-teal-800">
                  {data?.summary.openOrdersCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted">Confirmed Deliveries</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-success">
                  {data?.summary.deliveriesCount ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Priority Queue (Overview) */}
          {section === "overview" && lowStockProducts.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Replenishment Attention Needed ({lowStockProducts.length})
                </CardTitle>
                <Link
                  href="/supplier/products"
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  View all supplied items
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU / Barcode</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Store Stock</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.slice(0, 8).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted">
                          {p.sku} · {p.barcode}
                        </TableCell>
                        <TableCell className="text-xs text-muted">
                          {p.categoryName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={p.quantity <= 0 ? "danger" : "warning"}>
                            {p.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatMoney(p.costPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Supplied Products Table */}
          {section === "products" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  My Supplied Products ({data?.products.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.products.length ?? 0) === 0 ? (
                  <p className="p-6 text-sm text-muted">
                    No products are currently assigned to this supplier.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU / Barcode</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Cost Price</TableHead>
                        <TableHead className="text-right">Retail Price</TableHead>
                        <TableHead className="text-right">On Hand</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted">
                            {p.sku} · {p.barcode}
                          </TableCell>
                          <TableCell className="text-xs text-muted">
                            {p.categoryName ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatMoney(p.costPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatMoney(p.price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                p.quantity <= 0
                                  ? "danger"
                                  : p.needsRestock
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {p.quantity}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Purchase Orders */}
          {(section === "overview" || section === "orders") && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Purchase Orders ({data?.purchaseOrders.length ?? 0})
                </CardTitle>
                {section === "overview" && (
                  <Link
                    href="/supplier/orders"
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    View all orders
                  </Link>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {(data?.purchaseOrders.length ?? 0) === 0 ? (
                  <p className="p-6 text-sm text-muted">
                    No purchase orders have been issued yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Line Items</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.purchaseOrders ?? [])
                        .slice(0, section === "overview" ? 5 : 100)
                        .map((po) => (
                          <TableRow key={po.id}>
                            <TableCell className="font-mono text-xs font-bold text-teal-900">
                              {po.orderNumber}
                            </TableCell>
                            <TableCell className="text-xs text-muted">
                              {po.items.map((i) => (
                                <div key={i.id}>
                                  {i.productName}:{" "}
                                  <strong className="text-foreground">
                                    {i.receivedQuantity}/{i.orderedQuantity}
                                  </strong>
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="text-xs text-muted">
                              {po.expectedDate
                                ? new Date(po.expectedDate).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  po.status === "received"
                                    ? "success"
                                    : po.status === "cancelled"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                {po.status.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">
                              {formatMoney(po.totalAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Deliveries / Goods Receipts */}
          {(section === "overview" || section === "deliveries") && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Confirmed Goods Receipts &amp; Deliveries (
                  {data?.deliveries.length ?? 0})
                </CardTitle>
                {section === "overview" && (
                  <Link
                    href="/supplier/deliveries"
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    Full delivery log
                  </Link>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {(data?.deliveries.length ?? 0) === 0 ? (
                  <p className="p-6 text-sm text-muted">
                    No goods receipts recorded for this supplier yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GRN #</TableHead>
                        <TableHead>Purchase Order</TableHead>
                        <TableHead>Receiving Rack</TableHead>
                        <TableHead>Received By</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.deliveries ?? [])
                        .slice(0, section === "overview" ? 5 : 100)
                        .map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs font-bold text-teal-900">
                              {d.receiptNumber}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {d.orderNumber ?? "Direct"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted">
                              {d.warehouseLocation}
                            </TableCell>
                            <TableCell className="text-xs">
                              {d.receivedBy}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">
                              {d.totalUnits}
                            </TableCell>
                            <TableCell className="text-xs text-muted">
                              {new Date(d.receivedAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
