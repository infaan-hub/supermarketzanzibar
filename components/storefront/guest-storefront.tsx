"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <header className="sticky top-0 z-30 border-b border-border bg-white/88 shadow-[0_4px_24px_-12px_rgba(15,62,66,0.14)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 font-display text-sm font-bold text-white shadow-[0_6px_14px_-3px_rgba(13,148,136,0.45)] transition-transform group-hover:scale-[1.03]">
              SZ
            </div>
            <div>
              <span className="block font-display text-[15px] font-bold leading-tight text-foreground">
                Supermarket Zanzibar
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                Stone Town · Digital Storefront
              </span>
            </div>
          </Link>

          <nav
            className="hidden items-center gap-1 rounded-xl border border-border/70 bg-surface-subtle/70 p-1 md:flex"
            aria-label="Storefront"
          >
            <Link
              href="/"
              className={`rounded-lg px-3.5 py-1.5 font-display text-xs font-semibold transition-all ${
                activePage === "shop"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Shop Catalog
            </Link>
            <Link
              href="/store-3d"
              className={`rounded-lg px-3.5 py-1.5 font-display text-xs font-semibold transition-all ${
                activePage === "3d"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              3D Store Tour
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {onOpenCart && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onOpenCart}
              aria-label="Open shopping basket"
            >
              <span>Basket</span>
              {cartCount > 0 && (
                <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {cartCount}
                </span>
              )}
            </Button>
          )}

          {isAuthenticated && user ? (
            <Link href={portalUrl}>
              <Button size="sm">{roleLabel(user.role)} Portal</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="secondary">
                  Sign In
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
    <div className="flex min-h-dvh flex-col page-surface text-foreground">
      <StorefrontHeader
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        activePage="shop"
      />

      {/* Editorial Coastal Hero */}
      <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-br from-white via-[#eefaf8] to-[#dff5f1]">
        <div className="mx-auto grid max-w-[1400px] items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.25fr_0.95fr] lg:py-14">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/90 bg-white/90 px-3.5 py-1 text-xs font-semibold text-teal-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live Shelf Stock · Stone Town, Zanzibar
            </span>
            <h1 className="font-display text-3xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-5xl">
              Fresh Zanzibar groceries, now explorable in{" "}
              <span className="text-teal-700">real-time 3D</span>.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Shop directly from live supermarket inventory without creating an
              account, build your basket, or walk through all 18 aisles in our
              interactive 3D Digital Twin store.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link href="/store-3d">
                <Button size="lg">Explore 3D Supermarket</Button>
              </Link>
              <a href="#catalog">
                <Button size="lg" variant="secondary">
                  Browse Aisles
                </Button>
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-xs font-medium text-muted">Active Catalog</p>
              <p className="mt-1.5 font-display text-3xl font-bold tabular-nums text-teal-900">
                {catalog?.store.totalProducts ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Live products synced to PostgreSQL
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-xs font-medium text-muted">Store Departments</p>
              <p className="mt-1.5 font-display text-3xl font-bold tabular-nums text-teal-900">
                {catalog?.categories.length ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Groceries, beverages, dairy &amp; more
              </p>
            </div>
            <div className="glass-panel sm:col-span-2 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold text-teal-950">
                    Dedicated Role Workspaces
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Admin (<code className="text-teal-800">/admin/*</code>) ·
                    MarketMaster (<code className="text-teal-800">/dashboard</code>) ·
                    Supplier (<code className="text-teal-800">/supplier/*</code>)
                  </p>
                </div>
                <Link href="/login">
                  <Button size="sm" variant="secondary">
                    Staff Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Catalog Workspace */}
      <main
        id="catalog"
        className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-8 sm:px-6"
      >
        <div className="glass-panel flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("")}
              className={`rounded-full px-3.5 py-1.5 font-display text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === ""
                  ? "bg-teal-600 text-white shadow-sm"
                  : "border border-border bg-white text-muted hover:border-teal-400 hover:text-foreground"
              }`}
            >
              All Aisles
            </button>
            {(catalog?.categories ?? []).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-3.5 py-1.5 font-display text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-teal-600 text-white shadow-sm"
                    : "border border-border bg-white text-muted hover:border-teal-400 hover:text-foreground"
                }`}
              >
                {cat.name}{" "}
                <span className="opacity-75">({cat.productCount})</span>
              </button>
            ))}
          </div>

          <div className="w-full shrink-0 sm:w-72">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groceries, drinks, dairy…"
              aria-label="Search store products"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-danger/25 bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading && !catalog ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-64 animate-pulse rounded-2xl border border-border bg-white/80"
              />
            ))}
          </div>
        ) : (catalog?.products ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="font-display text-base font-semibold text-foreground">
                No matching products found
              </p>
              <p className="mt-1 text-xs text-muted">
                Try another search term or switch aisle categories.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(catalog?.products ?? []).map((product) => {
              const inBasket =
                cart.find((i) => i.productId === product.id)?.quantity ?? 0;
              return (
                <Card
                  key={product.id}
                  className="group flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400/60 hover:shadow-soft"
                >
                  <div>
                    <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-[#f2fbfa] via-[#e9f7f5] to-[#ddf2ef] p-5">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="max-h-32 max-w-full rounded-xl object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-teal-200/80 bg-white/80 font-display text-xl font-bold text-teal-700 shadow-sm">
                          {product.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute right-3 top-3">
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
                              ? "Limited"
                              : "In stock"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1.5 p-4">
                      {product.category && (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-teal-700">
                          {product.category.name}
                        </p>
                      )}
                      <h2 className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-foreground">
                        {product.name}
                      </h2>
                      {product.description && (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-surface-subtle/40 px-4 py-3">
                    <span className="font-display text-base font-bold tabular-nums text-teal-950">
                      {formatMoney(product.price)}
                    </span>

                    {inBasket > 0 ? (
                      <div className="flex items-center gap-1 rounded-xl border border-teal-300/70 bg-white p-0.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => adjustBasket(product.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-teal-900 hover:bg-surface-subtle cursor-pointer"
                          aria-label={`Remove one ${product.name}`}
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center font-mono text-xs font-bold text-teal-950">
                          {inBasket}
                        </span>
                        <button
                          type="button"
                          onClick={() => addToBasket(product)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer"
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
                        + Add
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="mt-10 border-t border-border bg-white/80">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted sm:px-6">
          <p className="font-medium text-foreground">
            Supermarket Zanzibar · Stone Town · Live 3D Digital Twin &amp; Inventory
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/store-3d" className="hover:text-teal-800 hover:underline">
              3D Store Tour
            </Link>
            <Link href="/login" className="hover:text-teal-800 hover:underline">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-teal-800 hover:underline">
              Register
            </Link>
          </div>
        </div>
      </footer>

      {/* Guest Shopping Basket Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-teal-950/30 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-surface-subtle/70 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Shopping Basket ({cartCount})
                </h2>
                <p className="text-xs text-muted">
                  Saved locally — sign in to finalize checkout
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

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="font-display text-sm font-semibold text-foreground">
                    Your basket is empty
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Add products from any aisle to start building your order.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle/60 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatMoney(item.price)} × {item.quantity} ={" "}
                        <strong className="text-teal-900">
                          {formatMoney(item.price * item.quantity)}
                        </strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 p-0"
                        onClick={() => adjustBasket(item.productId, -1)}
                      >
                        −
                      </Button>
                      <span className="w-6 text-center font-mono text-xs font-bold">
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

            <div className="space-y-3 border-t border-border bg-surface-subtle/50 p-5">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-muted">Estimated Subtotal</span>
                <span className="font-display text-xl font-bold text-teal-950 tabular-nums">
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
                    Sign In to Checkout
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
