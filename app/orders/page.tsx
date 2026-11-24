"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuestBasket } from "@/hooks/useGuestBasket";
import { fetchCustomerOrders } from "@/lib/api";
import {
  formatBusinessDateTime,
  formatMoney,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  saleStatusTone,
  statusLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CustomerOrderRecord,
  CustomerOrdersResponse,
} from "@/types/api";

type OrderFilter = "all" | "completed" | "pending" | "cancelled";

export default function CustomerOrdersPage() {
  const router = useRouter();
  const basket = useGuestBasket();

  const [data, setData] = React.useState<CustomerOrdersResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<OrderFilter>("all");
  const [search, setSearch] = React.useState("");
  const [reorderedId, setReorderedId] = React.useState<string | null>(null);

  const loadOrders = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchCustomerOrders();
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load your orders.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOrders(false);
  }, [loadOrders]);

  const filteredOrders = React.useMemo(() => {
    const list = data?.orders ?? [];
    const q = search.trim().toLowerCase();

    return list.filter((order) => {
      if (filter === "completed") {
        if (!["completed", "confirmed", "paid"].includes(order.status)) {
          return false;
        }
      } else if (filter === "pending") {
        if (!["pending", "pending_payment"].includes(order.status)) {
          return false;
        }
      } else if (filter === "cancelled") {
        if (!["cancelled", "canceled", "failed", "refunded"].includes(order.status)) {
          return false;
        }
      }

      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        (order.controlNumber ?? "").toLowerCase().includes(q) ||
        order.deliveryLocation.toLowerCase().includes(q) ||
        order.items.some(
          (item) =>
            item.productName.toLowerCase().includes(q) ||
            item.barcode.toLowerCase().includes(q),
        )
      );
    });
  }, [data?.orders, filter, search]);

  const handleReorderOrder = (order: CustomerOrderRecord) => {
    for (const item of order.items) {
      basket.addItem({
        productId: item.productId,
        name: item.productName,
        price: item.price,
        maxQuantity: Math.max(99, item.quantity),
        categoryName: item.categoryName,
        quantity: item.quantity,
      });
    }
    setReorderedId(order.id);
    window.setTimeout(() => {
      setReorderedId((cur) => (cur === order.id ? null : cur));
    }, 2500);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader
        title="My Orders"
        description="Track every Marketplace order, payment control number, delivery address, and receipt item."
        actions={
          <>
            <Link href="/dashboard">
              <Button size="sm">Shop Dashboard</Button>
            </Link>
            <Link href="/3d-store">
              <Button size="sm" variant="secondary">
                3D Store
              </Button>
            </Link>
            <Link href="/history">
              <Button size="sm" variant="secondary">
                Purchase History
              </Button>
            </Link>
            <Button
              size="sm"
              variant="secondary"
              isLoading={refreshing}
              onClick={() => void loadOrders(true)}
            >
              Refresh
            </Button>
          </>
        }
      />

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Total Orders</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-white tabular-nums">
            {data?.summary.totalOrders ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {data?.summary.totalItemsBought ?? 0} total units ordered
          </p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Completed</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#4CAF50] tabular-nums">
            {data?.summary.completedOrders ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Confirmed &amp; fulfilled
          </p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Pending</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-white tabular-nums">
            {data?.summary.pendingOrders ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Awaiting completion
          </p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Total Spent</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-white tabular-nums">
            {formatMoney(data?.summary.totalSpent ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-[#4CAF50]">
            {data?.customer.loyaltyPoints ?? 0} loyalty pts earned
          </p>
        </div>
      </div>

      {/* Filter Pills + Search Bar */}
      <div className="flex flex-col gap-3 rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All Orders" },
              { id: "completed", label: "Completed" },
              { id: "pending", label: "Pending" },
              { id: "cancelled", label: "Cancelled" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                filter === tab.id
                  ? "bg-[#4CAF50] text-white shadow-sm"
                  : "bg-[#1c1c1e] text-muted hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, control #, or item…"
            aria-label="Search orders"
            className="h-9 rounded-full border-white/10 bg-[#141416] px-4 text-xs text-white placeholder:text-[#71717a]"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/35 bg-danger/15 px-4 py-3 text-xs text-white">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => void loadOrders(false)}>
            Try Again
          </Button>
        </div>
      )}

      {/* Orders List */}
      {loading && !data ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-[26px] bg-[#2a2a2e]"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-[26px] border border-white/[0.07] bg-[#2a2a2e] p-12 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#38383f] text-[#4CAF50]">
            <ReceiptIcon className="h-7 w-7" />
          </div>
          <h2 className="font-display text-base font-bold text-white">
            {(data?.orders.length ?? 0) === 0
              ? "No orders placed yet"
              : "No orders match your filter"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            {(data?.orders.length ?? 0) === 0
              ? "Browse products on your Dashboard or walk the 3D Store to place your first Marketplace order."
              : "Try clearing the search query or switching to All Orders."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {(data?.orders.length ?? 0) === 0 ? (
              <>
                <Link href="/dashboard">
                  <Button size="sm">Browse Products</Button>
                </Link>
                <Link href="/3d-store">
                  <Button size="sm" variant="secondary">
                    Walk 3D Store
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#2a2a2e] shadow-card"
            >
              {/* Order Header */}
              <div className="flex flex-col gap-3 border-b border-white/[0.07] bg-[#252528] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">
                      {order.orderNumber}
                    </span>
                    <Badge variant={saleStatusTone(order.status)}>
                      {statusLabel(order.status)}
                    </Badge>
                    <Badge variant={paymentStatusTone(order.paymentStatus)}>
                      {paymentStatusLabel(order.paymentStatus)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">
                    Placed {formatBusinessDateTime(order.createdAt)} ·{" "}
                    {order.itemsCount}{" "}
                    {order.itemsCount === 1 ? "item" : "items"} ·{" "}
                    {paymentMethodLabel(order.paymentMethod)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:text-right">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-muted">
                      Order Total
                    </span>
                    <span className="font-display text-lg font-extrabold text-[#4CAF50] tabular-nums">
                      {formatMoney(order.grandTotal)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleReorderOrder(order)}
                  >
                    {reorderedId === order.id ? "Added to Cart" : "+ Reorder"}
                  </Button>
                  {reorderedId === order.id && (
                    <Button
                      size="sm"
                      onClick={() => router.push("/dashboard")}
                    >
                      Go to Cart →
                    </Button>
                  )}
                </div>
              </div>

              {/* Meta Strip: Control Number & Delivery Location */}
              <div className="grid grid-cols-1 gap-2 border-b border-white/[0.06] bg-[#1f1f22] px-5 py-3 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2 text-muted">
                  <span className="font-semibold text-white">Control #:</span>
                  <span className="rounded-full bg-[#38383f] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#4CAF50]">
                    {order.controlNumber || "Pending"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted sm:justify-end">
                  <span className="font-semibold text-white">Delivery:</span>
                  <span className="truncate">{order.deliveryLocation}</span>
                </div>
              </div>

              {/* Line Items */}
              <div className="divide-y divide-white/[0.06] px-5">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e]">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <span className="text-xs font-bold text-[#4CAF50]">
                            {item.productName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {item.productName}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {item.categoryName || "Marketplace"}
                          {item.barcode ? ` · ${item.barcode}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <p className="font-mono text-xs text-muted tabular-nums">
                          {item.quantity} × {formatMoney(item.price)}
                        </p>
                        <p className="font-display text-sm font-bold text-white tabular-nums">
                          {formatMoney(item.lineTotal)}
                        </p>
                      </div>
                      <Link
                        href={`/3d-store?product=${encodeURIComponent(item.productId)}`}
                        className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-[#4CAF50] transition-colors hover:bg-[#4CAF50] hover:text-white"
                      >
                        3D Shelf
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Footer */}
              <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-white/[0.07] bg-[#252528] px-5 py-3 text-xs text-muted">
                <span>
                  Subtotal:{" "}
                  <strong className="text-white tabular-nums">
                    {formatMoney(order.subtotal)}
                  </strong>
                </span>
                {order.taxAmount > 0 && (
                  <span>
                    Tax:{" "}
                    <strong className="text-white tabular-nums">
                      {formatMoney(order.taxAmount)}
                    </strong>
                  </span>
                )}
                {order.discount > 0 && (
                  <span>
                    Discount:{" "}
                    <strong className="text-[#4CAF50] tabular-nums">
                      −{formatMoney(order.discount)}
                    </strong>
                  </span>
                )}
                <span>
                  Grand Total:{" "}
                  <strong className="font-display text-sm text-[#4CAF50] tabular-nums">
                    {formatMoney(order.grandTotal)}
                  </strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
