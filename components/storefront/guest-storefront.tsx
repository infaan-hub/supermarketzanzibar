"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { useGuestBasket, type GuestCartItem } from "@/hooks/useGuestBasket";
import { defaultHomeForRole, roleLabel } from "@/lib/auth/roles";
import { fetchPublicCatalog, fetchPublicDigitalTwin } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Interactive3DStorefront } from "@/components/storefront/interactive-3d-storefront";
import type { PublicCatalogProduct, PublicCatalogResponse } from "@/types/api";
import type { DigitalTwinSnapshot } from "@/types/digital-twin";

export function StorefrontHeader({
  cartCount = 0,
  onOpenCart,
  activePage = "shop",
}: {
  cartCount?: number;
  onOpenCart?: () => void;
  activePage?: "shop" | "3d";
}) {
  const { user, isAuthenticated } = useAuth();
  const portalUrl = user ? defaultHomeForRole(user.role) : "/login";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white">
              SZ
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
              Supermarket Zanzibar
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Storefront">
            <Link
              href="/"
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activePage === "shop"
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-muted hover:bg-surface-subtle hover:text-foreground"
              }`}
            >
              Shop
            </Link>
            <Link
              href="/store-3d"
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activePage === "3d"
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-muted hover:bg-surface-subtle hover:text-foreground"
              }`}
            >
              3D Store
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {onOpenCart && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onOpenCart}
              aria-label="Open shopping basket"
            >
              <span>Basket</span>
              {cartCount > 0 && (
                <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                  {cartCount}
                </span>
              )}
            </Button>
          )}

          {isAuthenticated && user ? (
            <Link href={portalUrl}>
              <Button size="sm">{roleLabel(user.role)}</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="secondary">
                  Sign in
                </Button>
              </Link>
              <Link href="/register" className="hidden sm:inline-flex">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function GuestBasketDrawer({
  open,
  onClose,
  cart,
  count,
  subtotal,
  onAdjustItem,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  cart: GuestCartItem[];
  count: number;
  subtotal: number;
  onAdjustItem: (productId: string, delta: number) => void;
  onClear: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Shopping basket ({count})
            </h2>
            <p className="text-xs text-muted">
              Saved on this device until checkout
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-foreground">
                Your basket is empty
              </p>
              <p className="mt-1 text-xs text-muted">
                Pick items directly off any 3D shelf or from the catalog below.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted tabular-nums">
                    {formatMoney(item.price)} × {item.quantity} ={" "}
                    <strong className="text-foreground">
                      {formatMoney(item.price * item.quantity)}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 w-7 p-0"
                    onClick={() => onAdjustItem(item.productId, -1)}
                  >
                    −
                  </Button>
                  <span className="w-6 text-center font-mono text-xs font-semibold">
                    {item.quantity}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 w-7 p-0"
                    onClick={() => onAdjustItem(item.productId, 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 border-t border-border bg-surface-subtle p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Estimated subtotal</span>
            <span className="text-base font-semibold text-foreground tabular-nums">
              {formatMoney(subtotal)}
            </span>
          </div>
          <div className="flex gap-2">
            {cart.length > 0 && (
              <Button variant="secondary" size="sm" onClick={onClear}>
                Clear
              </Button>
            )}
            <Link href="/login" className="flex-1">
              <Button className="w-full" size="md">
                Sign in to checkout
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuestStorefront() {
  const store3DSectionRef = React.useRef<HTMLDivElement>(null);

  const [catalog, setCatalog] = React.useState<PublicCatalogResponse | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");

  const [twinSnapshot, setTwinSnapshot] =
    React.useState<DigitalTwinSnapshot | null>(null);
  const [twinLoading, setTwinLoading] = React.useState(true);
  const [twinRefreshing, setTwinRefreshing] = React.useState(false);
  const [twinError, setTwinError] = React.useState<string | null>(null);
  const [show3D, setShow3D] = React.useState(true);
  const [focusProductRequest, setFocusProductRequest] = React.useState<{
    productId: string;
    nonce: number;
  } | null>(null);

  const basket = useGuestBasket();
  const [cartOpen, setCartOpen] = React.useState(false);

  const loadCatalog = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicCatalog({
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        take: 60,
      });
      setCatalog(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load store products.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  const loadTwin = React.useCallback(async (silent = false) => {
    if (silent) setTwinRefreshing(true);
    else setTwinLoading(true);
    setTwinError(null);
    try {
      const data = await fetchPublicDigitalTwin();
      setTwinSnapshot(data);
    } catch (err) {
      setTwinError(
        err instanceof Error ? err.message : "Unable to load 3D shelves.",
      );
    } finally {
      setTwinLoading(false);
      setTwinRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  React.useEffect(() => {
    void loadTwin(false);
    // Keep live shelf availability fresh every 30s without moving the camera.
    const interval = window.setInterval(() => {
      void loadTwin(true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadTwin]);

  const catalogById = React.useMemo(() => {
    const map = new Map<string, PublicCatalogProduct>();
    for (const p of catalog?.products ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [catalog]);

  const placedProductIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const shelf of twinSnapshot?.shelves ?? []) {
      for (const pos of shelf.positions) {
        if (pos.product) set.add(pos.product.id);
      }
    }
    return set;
  }, [twinSnapshot]);

  const handleViewOnShelf = (productId: string) => {
    setShow3D(true);
    setFocusProductRequest({ productId, nonce: Date.now() });
    store3DSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <StorefrontHeader
        cartCount={basket.count}
        onOpenCart={() => setCartOpen(true)}
        activePage="shop"
      />

      {/* Compact Store Intro Header */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted">
              Stone Town, Zanzibar
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Walk the aisles &amp; pick live from the shelves
            </h1>
            <p className="max-w-2xl text-sm text-muted">
              Move through our interactive 3D store, inspect real-time shelf
              stock, and add products straight to your basket.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {catalog && (
              <p className="text-xs text-muted tabular-nums">
                <strong className="font-semibold text-foreground">
                  {catalog.store.totalProducts}
                </strong>{" "}
                items ·{" "}
                <strong className="font-semibold text-foreground">
                  {catalog.categories.length}
                </strong>{" "}
                aisles
              </p>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShow3D((v) => !v)}
            >
              {show3D ? "Hide 3D store" : "Show 3D store"}
            </Button>
            <a href="#catalog">
              <Button size="sm" variant="secondary">
                Browse list
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Movable 3D Storefront Section */}
      {show3D && (
        <div
          ref={store3DSectionRef}
          className="mx-auto w-full max-w-[1360px] px-4 pt-5 sm:px-6"
        >
          <Interactive3DStorefront
            snapshot={twinSnapshot}
            loading={twinLoading}
            error={twinError}
            onRefresh={() => void loadTwin(true)}
            refreshing={twinRefreshing}
            catalogById={catalogById}
            basketQuantities={basket.basketQuantities}
            basketCount={basket.count}
            onAddItem={basket.addItem}
            onAdjustItem={basket.adjustItem}
            onOpenBasket={() => setCartOpen(true)}
            focusProductRequest={focusProductRequest}
          />
        </div>
      )}

      {/* Live Catalog Workspace */}
      <main
        id="catalog"
        className="mx-auto w-full max-w-[1360px] flex-1 space-y-5 px-4 py-6 sm:px-6"
      >
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Store catalog
            </h2>
            <p className="text-xs text-muted">
              Filter by aisle or jump straight to any product&apos;s 3D shelf
              position.
            </p>
          </div>
          <div className="w-full shrink-0 sm:w-72">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search store products"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              selectedCategory === ""
                ? "bg-primary text-white"
                : "border border-border bg-white text-muted hover:border-border-hover hover:text-foreground"
            }`}
          >
            All aisles
          </button>
          {(catalog?.categories ?? []).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-primary text-white"
                  : "border border-border bg-white text-muted hover:border-border-hover hover:text-foreground"
              }`}
            >
              {cat.name}{" "}
              <span className="opacity-70 tabular-nums">
                ({cat.productCount})
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading && !catalog ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-64 animate-pulse rounded-lg border border-border bg-white"
              />
            ))}
          </div>
        ) : (catalog?.products ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-12 text-center">
            <p className="text-sm font-semibold text-foreground">
              No matching products found
            </p>
            <p className="mt-1 text-xs text-muted">
              Try a different search term or browse another aisle.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(catalog?.products ?? []).map((product) => {
              const inBasket = basket.basketQuantities[product.id] ?? 0;
              const onShelfIn3D = placedProductIds.has(product.id);
              return (
                <article
                  key={product.id}
                  className="flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-white shadow-card transition-colors hover:border-border-hover"
                >
                  <div>
                    <div className="relative flex h-36 items-center justify-center border-b border-border bg-surface-subtle p-4">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="max-h-28 max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-white text-sm font-semibold text-muted">
                          {product.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute right-2.5 top-2.5">
                        <Badge
                          variant={
                            product.stockStatus === "out_of_stock"
                              ? "danger"
                              : product.stockStatus === "low_stock"
                                ? "warning"
                                : "success"
                          }
                        >
                          {product.stockStatus === "out_of_stock"
                            ? "Out of stock"
                            : product.stockStatus === "low_stock"
                              ? "Low stock"
                              : "In stock"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1 p-4">
                      <div className="flex items-center justify-between gap-2">
                        {product.category ? (
                          <p className="truncate text-[11px] font-medium text-muted">
                            {product.category.name}
                          </p>
                        ) : (
                          <span />
                        )}
                        {onShelfIn3D && (
                          <button
                            type="button"
                            onClick={() => handleViewOnShelf(product.id)}
                            className="shrink-0 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                          >
                            Show on shelf
                          </button>
                        )}
                      </div>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="line-clamp-2 text-xs text-muted">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(product.price)}
                    </span>

                    {inBasket > 0 ? (
                      <div className="flex items-center gap-1 rounded-md border border-border bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            basket.adjustItem(
                              product.id,
                              -1,
                              product.availableQuantity,
                            )
                          }
                          className="flex h-6 w-6 items-center justify-center rounded text-xs font-semibold text-foreground hover:bg-surface-subtle cursor-pointer"
                          aria-label={`Remove one ${product.name}`}
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center font-mono text-xs font-semibold text-foreground">
                          {inBasket}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            basket.addItem({
                              productId: product.id,
                              name: product.name,
                              price: product.price,
                              maxQuantity: product.availableQuantity,
                              categoryName: product.category?.name ?? null,
                            })
                          }
                          className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-white hover:bg-primary-hover cursor-pointer"
                          aria-label={`Add one more ${product.name}`}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!product.inStock}
                        onClick={() =>
                          basket.addItem({
                            productId: product.id,
                            name: product.name,
                            price: product.price,
                            maxQuantity: product.availableQuantity,
                            categoryName: product.category?.name ?? null,
                          })
                        }
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-border bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-4 py-5 text-xs text-muted sm:px-6">
          <p>Supermarket Zanzibar · Stone Town</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/store-3d" className="hover:text-foreground hover:underline">
              3D Store
            </Link>
            <Link href="/login" className="hover:text-foreground hover:underline">
              Staff sign in
            </Link>
            <Link href="/register" className="hover:text-foreground hover:underline">
              Register
            </Link>
          </div>
        </div>
      </footer>

      <GuestBasketDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={basket.cart}
        count={basket.count}
        subtotal={basket.subtotal}
        onAdjustItem={(productId, delta) => basket.adjustItem(productId, delta)}
        onClear={basket.clearBasket}
      />
    </div>
  );
}
