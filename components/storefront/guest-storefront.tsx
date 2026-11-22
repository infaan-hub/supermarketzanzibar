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
    <header className="sticky top-0 z-30 border-b border-teal-200/70 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-hover font-display text-sm font-bold text-white shadow-sm">
              SZ
            </div>
            <div>
              <span className="block font-display text-base font-bold leading-tight text-foreground">
                Supermarket Zanzibar
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-teal-700">
                Stone Town · Fresh &amp; 3D Store
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Storefront">
            <Link
              href="/"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activePage === "shop"
                  ? "bg-teal-50 text-teal-900"
                  : "text-muted hover:bg-surface-subtle hover:text-foreground"
              }`}
            >
              Shop Products
            </Link>
            <Link
              href="/store-3d"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activePage === "3d"
                  ? "bg-teal-50 text-teal-900"
                  : "text-muted hover:bg-surface-subtle hover:text-foreground"
              }`}
            >
              3D Store Tour
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenCart && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onOpenCart}
              aria-label="Open shopping basket"
            >
              Basket
              {cartCount > 0 && (
                <span className="ml-1.5 rounded-full bg-teal-700 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  {cartCount}
                </span>
              )}
            </Button>
          )}

          {isAuthenticated && user ? (
            <Link href={portalUrl}>
              <Button size="sm">
                {roleLabel(user.role)} Portal
              </Button>
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
    <div className="min-h-dvh bg-[#f5fbfa] text-foreground">
      <StorefrontHeader
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        activePage="shop"
      />

      {/* Hero Banner */}
      <section className="border-b border-teal-200/60 bg-gradient-to-br from-white via-[#eefaf7] to-[#e2f5f2]">
        <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:py-12">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white/90 px-3 py-1 text-xs font-semibold text-teal-800">
              Live Store Availability · Stone Town, Zanzibar
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Fresh Groceries, Beverages &amp; Essentials — Explore in 3D
            </h1>
            <p className="text-sm text-muted sm:text-base">
              Browse live shelf stock directly from our store database, build
              your shopping basket without logging in, or take an interactive 3D
              walkthrough of every supermarket aisle.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link href="/store-3d">
                <Button>Explore 3D Supermarket</Button>
              </Link>
              <a href="#catalog">
                <Button variant="secondary">Browse All Products</Button>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="glass-panel rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-muted">Active Products</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-teal-900">
                {catalog?.store.totalProducts ?? "—"}
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-muted">Categories</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-teal-900">
                {catalog?.categories.length ?? "—"}
              </p>
            </div>
            <div className="glass-panel col-span-2 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-teal-800">
                Staff, Admin &amp; Supplier Access
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Administrators manage under <code>/admin/*</code>, MarketMasters
                operate on root workspaces, and Suppliers use{" "}
                <code>/supplier/*</code>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Search & Category Filter */}
      <main
        id="catalog"
        className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === ""
                  ? "bg-teal-700 text-white shadow-sm"
                  : "border border-border bg-white text-muted hover:text-foreground"
              }`}
            >
              All Aisles
            </button>
            {(catalog?.categories ?? []).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-teal-700 text-white shadow-sm"
                    : "border border-border bg-white text-muted hover:text-foreground"
                }`}
              >
                {cat.name} ({cat.productCount})
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groceries, drinks, dairy…"
              aria-label="Search store products"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading && !catalog ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-56 animate-pulse rounded-2xl border border-border bg-white"
              />
            ))}
          </div>
        ) : (catalog?.products ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <p className="font-display text-base font-semibold text-foreground">
                No matching products found
              </p>
              <p className="mt-1 text-xs text-muted">
                Try another search term or explore another aisle category.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(catalog?.products ?? []).map((product) => {
              const inBasket =
                cart.find((i) => i.productId === product.id)?.quantity ?? 0;
              return (
                <Card
                  key={product.id}
                  className="flex flex-col justify-between overflow-hidden border-teal-200/60 bg-white transition-shadow hover:shadow-md"
                >
                  <div>
                    <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-[#f0faf8] to-[#e4f4f1] p-4">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="max-h-28 max-w-full rounded-lg object-contain"
                        />
                      ) : (
                        <span className="font-display text-2xl font-bold text-teal-800/35">
                          {product.name.slice(0, 2).toUpperCase()}
                        </span>
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
                              ? "Limited stock"
                              : "In stock"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1 p-4">
                      {product.category && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                          {product.category.name}
                        </p>
                      )}
                      <h2 className="line-clamp-2 font-display text-base font-bold text-foreground">
                        {product.name}
                      </h2>
                      {product.description && (
                        <p className="line-clamp-2 text-xs text-muted">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
                    <span className="font-display text-base font-bold tabular-nums text-teal-950">
                      {formatMoney(product.price)}
                    </span>
                    <Button
                      size="sm"
                      disabled={!product.inStock}
                      onClick={() => addToBasket(product)}
                    >
                      {inBasket > 0 ? `In Basket (${inBasket})` : "+ Add"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Guest Shopping Basket Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Shopping Basket ({cartCount})
                </h2>
                <p className="text-xs text-muted">
                  Saved in your browser — sign in to complete your order
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
                <p className="py-12 text-center text-sm text-muted">
                  Your basket is empty. Add products from the catalog.
                </p>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatMoney(item.price)} each
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

            <div className="space-y-3 border-t border-border p-5">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Estimated Total</span>
                <span className="font-display text-lg text-teal-900">
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
                  <Button className="w-full" size="sm">
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
