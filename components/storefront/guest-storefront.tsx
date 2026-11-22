"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { defaultHomeForRole, roleLabel } from "@/lib/auth/roles";
import { fetchPublicCatalog } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { PublicCatalogProduct, PublicCatalogResponse } from "@/types/api";

interface GuestCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  categoryName: string | null;
}

const GUEST_CART_KEY = "sz_guest_basket";

function loadGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    return raw ? (JSON.parse(raw) as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

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

export function GuestStorefront() {
  const [catalog, setCatalog] = React.useState<PublicCatalogResponse | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");

  const [cart, setCart] = React.useState<GuestCartItem[]>([]);
  const [cartOpen, setCartOpen] = React.useState(false);

  React.useEffect(() => {
    setCart(loadGuestCart());
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

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

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  const addToBasket = (product: PublicCatalogProduct) => {
    if (!product.inStock) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: Math.min(product.availableQuantity, i.quantity + 1) }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          categoryName: product.category?.name ?? null,
        },
      ];
    });
  };

  const adjustBasket = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <StorefrontHeader
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        activePage="shop"
      />

      {/* Compact Store Intro Strip */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted">
              Stone Town, Zanzibar
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Fresh groceries &amp; everyday essentials
            </h1>
            <p className="max-w-xl text-sm text-muted">
              Check live shelf availability, build your basket, or walk through
              the store in 3D before you visit.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
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
            <Link href="/store-3d">
              <Button size="sm" variant="secondary">
                Explore 3D Store
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Catalog Workspace */}
      <main
        id="catalog"
        className="mx-auto w-full max-w-[1360px] flex-1 space-y-5 px-4 py-6 sm:px-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="w-full shrink-0 sm:w-72">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search store products"
            />
          </div>
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
              const inBasket =
                cart.find((i) => i.productId === product.id)?.quantity ?? 0;
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
                      {product.category && (
                        <p className="text-[11px] font-medium text-muted">
                          {product.category.name}
                        </p>
                      )}
                      <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {product.name}
                      </h2>
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
                          onClick={() => adjustBasket(product.id, -1)}
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
                          onClick={() => addToBasket(product)}
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
                        onClick={() => addToBasket(product)}
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

      {/* Basket Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
          <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-[var(--shadow-popover)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Shopping basket ({cartCount})
                </h2>
                <p className="text-xs text-muted">
                  Saved on this device until checkout
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCartOpen(false)}
              >
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
                    Add products from the catalog to start an order.
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
                        onClick={() => adjustBasket(item.productId, -1)}
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
                        onClick={() => adjustBasket(item.productId, 1)}
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
                  {formatMoney(cartSubtotal)}
                </span>
              </div>
              <div className="flex gap-2">
                {cart.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCart([])}
                  >
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
      )}
    </div>
  );
}
