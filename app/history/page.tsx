"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuestBasket } from "@/hooks/useGuestBasket";
import { fetchCustomerOrders } from "@/lib/api";
import {
  formatBusinessDateTime,
  formatMoney,
  saleStatusTone,
  statusLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CustomerBoughtProductRecord,
  CustomerOrdersResponse,
} from "@/types/api";

type SortKey = "recent" | "most_bought" | "highest_spent" | "name";
type ViewMode = "cards" | "table";

export default function CustomerPurchaseHistoryPage() {
  const basket = useGuestBasket();

  const [data, setData] = React.useState<CustomerOrdersResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortKey>("recent");
  const [viewMode, setViewMode] = React.useState<ViewMode>("cards");
  const [expandedProductId, setExpandedProductId] = React.useState<string | null>(
    null,
  );

  const loadHistory = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchCustomerOrders();
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your purchase history.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHistory(false);
  }, [loadHistory]);

  const boughtProducts = React.useMemo(() => {
    const list = data?.boughtProducts ?? [];
    const q = search.trim().toLowerCase();

    const filtered = q
      ? list.filter(
          (item) =>
            item.productName.toLowerCase().includes(q) ||
            (item.categoryName ?? "").toLowerCase().includes(q) ||
            item.barcode.toLowerCase().includes(q),
        )
      : list;

    return [...filtered].sort((a, b) => {
      if (sortBy === "most_bought") {
        return b.totalQuantityBought - a.totalQuantityBought;
      }
      if (sortBy === "highest_spent") {
        return b.totalSpent - a.totalSpent;
      }
      if (sortBy === "name") {
        return a.productName.localeCompare(b.productName);
      }
      return (
        new Date(b.lastPurchasedAt).getTime() -
        new Date(a.lastPurchasedAt).getTime()
      );
    });
  }, [data?.boughtProducts, search, sortBy]);

  const handleBuyAgain = (item: CustomerBoughtProductRecord) => {
    if (!item.inStock) return;
    basket.addItem({
      productId: item.productId,
      name: item.productName,
      price: item.currentPrice,
      maxQuantity: Math.max(1, item.currentStock),
      categoryName: item.categoryName,
    });
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader
        title="Purchase History"
        description="Every product you have bought on Marketplace — view quantities purchased, dates, prices, and buy again in one click."
        actions={
          <>
            {basket.count > 0 && (
              <Link href="/dashboard">
                <Button size="sm">Checkout Cart ({basket.count})</Button>
              </Link>
            )}
            <Link href="/orders">
              <Button size="sm" variant="secondary">
                My Orders ({data?.summary.totalOrders ?? 0})
              </Button>
            </Link>
            <Link href="/3d-store">
              <Button size="sm" variant="secondary">
                3D Store
              </Button>
            </Link>
            <Button
              size="sm"
              variant="secondary"
              isLoading={refreshing}
              onClick={() => void loadHistory(true)}
            >
              Refresh
            </Button>
          </>
        }
      />

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Unique Products Bought</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-white tabular-nums">
            {data?.summary.uniqueProductsBought ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted">Distinct store items</p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Total Units Bought</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#4CAF50] tabular-nums">
            {data?.summary.totalItemsBought ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Across {data?.summary.totalOrders ?? 0} orders
          </p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Total Spent</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-white tabular-nums">
            {formatMoney(data?.summary.totalSpent ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted">Lifetime purchases</p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-5 shadow-card">
          <p className="text-xs font-medium text-muted">Loyalty Points</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#4CAF50] tabular-nums">
            {data?.customer.loyaltyPoints ?? 0} pts
          </p>
          <p className="mt-1 text-[11px] text-muted">Earned on every order</p>
        </div>
      </div>

      {/* Controls: Search, Sort, View Toggle */}
      <div className="flex flex-col gap-3 rounded-[24px] border border-white/[0.07] bg-[#2a2a2e] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bought products, category, or barcode…"
            aria-label="Search bought products"
            className="h-9 rounded-full border-white/10 bg-[#141416] px-4 text-xs text-white placeholder:text-[#71717a]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Sort bought products"
            className="h-9 rounded-full border border-white/10 bg-[#141416] px-3.5 text-xs font-semibold text-white focus:border-[#4CAF50] focus:outline-none"
          >
            <option value="recent">Most Recent</option>
            <option value="most_bought">Most Bought</option>
            <option value="highest_spent">Highest Spent</option>
            <option value="name">Name (A–Z)</option>
          </select>

          <div
            role="group"
            aria-label="Layout view"
            className="inline-flex rounded-full border border-white/10 bg-[#141416] p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                viewMode === "cards"
                  ? "bg-[#4CAF50] text-white"
                  : "text-muted hover:text-white",
              )}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                viewMode === "table"
                  ? "bg-[#4CAF50] text-white"
                  : "text-muted hover:text-white",
              )}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/35 bg-danger/15 px-4 py-3 text-xs text-white">
          <span>{error}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadHistory(false)}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Bought Products Content */}
      {loading && !data ? (
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-64 animate-pulse rounded-[26px] bg-[#2a2a2e]"
            />
          ))}
        </div>
      ) : boughtProducts.length === 0 ? (
        <div className="rounded-[26px] border border-white/[0.07] bg-[#2a2a2e] p-12 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#38383f] text-[#4CAF50]">
            <HistoryBagIcon className="h-7 w-7" />
          </div>
          <h2 className="font-display text-base font-bold text-white">
            {(data?.boughtProducts.length ?? 0) === 0
              ? "You have not bought any products yet"
              : "No bought products match your search"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            {(data?.boughtProducts.length ?? 0) === 0
              ? "Once you confirm an order on your Dashboard or in the 3D Store, every product you buy will appear here."
              : "Try a different product name, category, or barcode."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {(data?.boughtProducts.length ?? 0) === 0 ? (
              <>
                <Link href="/dashboard">
                  <Button size="sm">Shop Products</Button>
                </Link>
                <Link href="/3d-store">
                  <Button size="sm" variant="secondary">
                    Explore 3D Store
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSearch("")}
              >
                Clear Search
              </Button>
            )}
          </div>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-x-5 gap-y-14 pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {boughtProducts.map((item) => {
            const inBasket = basket.basketQuantities[item.productId] ?? 0;
            const expanded = expandedProductId === item.productId;

            return (
              <article
                key={item.productId}
                className="group relative flex flex-col rounded-[28px] border border-white/[0.07] bg-[#2a2a2e] px-5 pt-18 pb-5 shadow-[0_18px_36px_-12px_rgba(0,0,0,0.65)] transition-all duration-200 hover:border-[#4CAF50]/40"
              >
                {/* Floating Top Product Photo */}
                <div className="absolute -top-11 left-1/2 flex h-26 w-26 -translate-x-1/2 items-center justify-center">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="max-h-26 max-w-26 rounded-2xl object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.68)] transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-22 w-22 flex-col items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-[0_14px_24px_rgba(0,0,0,0.65)]">
                      <span className="text-sm font-bold text-[#4CAF50]">
                        {item.productName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Top-Left Bought Count Pill */}
                <span className="absolute top-3 left-3 rounded-full bg-[#4CAF50]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#4CAF50]">
                  Bought {item.totalQuantityBought}×
                </span>

                {/* Top-Right Direct 3D Shelf Link */}
                <Link
                  href={`/3d-store?product=${encodeURIComponent(item.productId)}`}
                  className="absolute top-3 right-3 rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[10px] font-semibold text-[#4CAF50] transition-colors hover:bg-[#4CAF50] hover:text-white"
                >
                  3D Shelf
                </Link>

                {/* Title & Current Price */}
                <div className="text-center">
                  <h3 className="line-clamp-1 font-display text-base font-bold text-white">
                    {item.productName}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {item.categoryName || "Marketplace"}
                    {item.barcode ? ` · ${item.barcode}` : ""}
                  </p>
                  <p className="mt-1 font-display text-lg font-extrabold text-white tabular-nums">
                    {formatMoney(item.currentPrice)}
                  </p>
                </div>

                {/* Purchase Summary Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#1c1c1e] p-3 text-xs">
                  <div>
                    <span className="block text-[10px] text-muted">
                      Total Spent
                    </span>
                    <span className="font-display font-bold text-[#4CAF50] tabular-nums">
                      {formatMoney(item.totalSpent)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-muted">
                      Orders
                    </span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {item.orderCount}{" "}
                      {item.orderCount === 1 ? "order" : "orders"}
                    </span>
                  </div>
                  <div className="col-span-2 border-t border-white/[0.06] pt-2">
                    <span className="block text-[10px] text-muted">
                      Last Purchased
                    </span>
                    <span className="text-[11px] font-medium text-white">
                      {formatBusinessDateTime(item.lastPurchasedAt)}
                    </span>
                  </div>
                </div>

                {/* Buy Again / Basket Pill */}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Badge variant={item.inStock ? "success" : "danger"}>
                    {item.inStock ? `${item.currentStock} in stock` : "Sold Out"}
                  </Badge>

                  {inBasket > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1c1c1e] px-3 py-1">
                      <button
                        type="button"
                        onClick={() =>
                          basket.adjustItem(
                            item.productId,
                            -1,
                            item.currentStock,
                          )
                        }
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-[#38383f] text-xs font-bold text-white hover:bg-[#4CAF50] cursor-pointer"
                      >
                        −
                      </button>
                      <span className="font-mono text-xs font-bold text-white tabular-nums">
                        {inBasket}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleBuyAgain(item)}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4CAF50] text-xs font-bold text-white hover:bg-[#43A047] cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!item.inStock}
                      onClick={() => handleBuyAgain(item)}
                    >
                      + Buy Again
                    </Button>
                  )}
                </div>

                {/* Expandable Purchase Entries Log */}
                {item.purchases.length > 0 && (
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProductId(expanded ? null : item.productId)
                      }
                      className="flex w-full items-center justify-between text-[11px] font-semibold text-muted hover:text-[#4CAF50] cursor-pointer"
                    >
                      <span>
                        Purchase log ({item.purchases.length}{" "}
                        {item.purchases.length === 1 ? "entry" : "entries"})
                      </span>
                      <span>{expanded ? "▲" : "▼"}</span>
                    </button>

                    {expanded && (
                      <div className="mt-2 space-y-1.5">
                        {item.purchases.map((entry, idx) => (
                          <div
                            key={`${entry.saleId}-${idx}`}
                            className="flex items-center justify-between rounded-xl bg-[#1c1c1e] px-2.5 py-2 text-[11px]"
                          >
                            <div className="min-w-0">
                              <p className="font-mono font-semibold text-white">
                                {entry.quantity} × {formatMoney(entry.unitPrice)}
                              </p>
                              <p className="text-[10px] text-muted">
                                {formatBusinessDateTime(entry.purchasedAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-[#4CAF50] tabular-nums">
                                {formatMoney(entry.lineTotal)}
                              </p>
                              <Badge
                                variant={saleStatusTone(entry.status)}
                                className="mt-0.5 text-[9px]"
                              >
                                {statusLabel(entry.status)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#2a2a2e] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-[#252528] text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-3.5 font-semibold">Product</th>
                  <th className="px-4 py-3.5 font-semibold">Category</th>
                  <th className="px-4 py-3.5 text-right font-semibold">
                    Qty Bought
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold">
                    Orders
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold">
                    Total Spent
                  </th>
                  <th className="px-4 py-3.5 font-semibold">Last Bought</th>
                  <th className="px-4 py-3.5 font-semibold">Stock</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {boughtProducts.map((item) => {
                  const inBasket = basket.basketQuantities[item.productId] ?? 0;
                  return (
                    <tr
                      key={item.productId}
                      className="transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1e]">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <span className="text-[11px] font-bold text-[#4CAF50]">
                                {item.productName.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white">
                              {item.productName}
                            </p>
                            <p className="font-mono text-[10px] text-muted">
                              {item.barcode || "No barcode"} ·{" "}
                              {formatMoney(item.currentPrice)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted">
                        {item.categoryName || "Marketplace"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-white tabular-nums">
                        {item.totalQuantityBought}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-muted tabular-nums">
                        {item.orderCount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-display font-bold text-[#4CAF50] tabular-nums">
                        {formatMoney(item.totalSpent)}
                      </td>
                      <td className="px-4 py-3.5 text-muted">
                        {formatBusinessDateTime(item.lastPurchasedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={item.inStock ? "success" : "danger"}>
                          {item.inStock
                            ? `${item.currentStock} left`
                            : "Sold Out"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/3d-store?product=${encodeURIComponent(item.productId)}`}
                            className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-[#4CAF50] hover:bg-[#4CAF50] hover:text-white"
                          >
                            3D Shelf
                          </Link>
                          <Button
                            size="sm"
                            disabled={!item.inStock}
                            onClick={() => handleBuyAgain(item)}
                          >
                            {inBasket > 0 ? `In Cart (${inBasket})` : "+ Buy Again"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryBagIcon({ className }: { className?: string }) {
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
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
