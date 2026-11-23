"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { useGuestBasket, type GuestCartItem } from "@/hooks/useGuestBasket";
import {
  applyPublicShelfEventToSnapshot,
  usePublicStorefrontRealtime,
  type PublicShelfEvent,
} from "@/hooks/usePublicStorefrontRealtime";
import { defaultHomeForRole, roleLabel } from "@/lib/auth/roles";
import { fetchPublicCatalog, fetchPublicDigitalTwin } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { encodePickupCode } from "@/lib/storefront/pickup-code";
import { Interactive3DStorefront } from "@/components/storefront/interactive-3d-storefront";
import { cn } from "@/lib/utils";
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
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#1c1c1e]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4CAF50] text-white shadow-[0_6px_16px_rgba(76,175,80,0.4)]">
              <SupermarketLogoIcon className="h-5 w-5" />
            </span>
            <div>
              <span className="block font-display text-base font-extrabold tracking-tight text-white">
                Marketplace
              </span>
              <span className="block text-[10px] font-medium text-[#4CAF50]">
                Live 3D &amp; Express Order
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1.5 md:flex" aria-label="Marketplace">
            <Link
              href="/"
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                activePage === "shop"
                  ? "bg-[#4CAF50] text-white shadow-sm"
                  : "text-muted hover:bg-white/[0.06] hover:text-white",
              )}
            >
              Dashboard
            </Link>
            <Link
              href="/store-3d"
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                activePage === "3d"
                  ? "bg-[#4CAF50] text-white shadow-sm"
                  : "text-muted hover:bg-white/[0.06] hover:text-white",
              )}
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
              aria-label="Open shopping cart"
            >
              <CartIcon className="h-3.5 w-3.5 text-[#4CAF50]" />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="rounded-full bg-[#4CAF50] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-[#252528] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm font-bold text-white">
            Marketplace Order Ticket ({count})
          </span>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close ✕
          </Button>
        </div>
        <MarketplaceOrderTicket
          cart={cart}
          count={count}
          subtotal={subtotal}
          onAdjustItem={onAdjustItem}
          onClear={onClear}
        />
      </div>
    </div>
  );
}

function MarketplaceOrderTicket({
  cart,
  count,
  subtotal,
  onAdjustItem,
  onClear,
}: {
  cart: GuestCartItem[];
  count: number;
  subtotal: number;
  onAdjustItem: (productId: string, delta: number) => void;
  onClear: () => void;
}) {
  const [mode, setMode] = React.useState<"delivery" | "dine_in" | "takeaway">(
    "delivery",
  );
  const [showQr, setShowQr] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const pickupCode = React.useMemo(
    () =>
      encodePickupCode(
        cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      ),
    [cart],
  );

  React.useEffect(() => {
    if (cart.length === 0) setShowQr(false);
  }, [cart.length]);

  const deliveryFee = cart.length > 0 && mode === "delivery" ? 1500 : 0;
  const grandTotal = subtotal + deliveryFee;

  const handleCopyCode = () => {
    if (!pickupCode || typeof navigator === "undefined") return;
    navigator.clipboard
      ?.writeText(pickupCode)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  };

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#3c3c42] p-5 text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)]">
      {/* Top Delivery Address Card matching reference */}
      <div className="rounded-2xl bg-[#54545c] p-4 shadow-inner">
        <p className="font-display text-xs font-bold tracking-wider uppercase text-white">
          DELIVERY ADDRESS
        </p>
        <p className="mt-2 flex items-center gap-2 text-xs text-white/95">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-[#4CAF50]" />
          <span className="truncate">
            Po. 1478, Street No. 52, Stone Town, Zanzibar
          </span>
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-[11px] text-white/80">
          <ClockIcon className="h-3.5 w-3.5 shrink-0 text-[#4CAF50]" />
          <span>20 min</span>
        </p>
      </div>

      {/* Cart Header & Order ID */}
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CartIcon className="h-4.5 w-4.5 text-[#4CAF50]" />
          <h2 className="font-display text-base font-bold text-white">Cart</h2>
          {count > 0 && (
            <span className="rounded-full bg-[#4CAF50] px-2 py-0.5 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-white/75">
            Order ID: #1099
          </span>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-semibold text-[#4CAF50] hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Segmented Pill Toggle: Delivery | In-Store | Pickup */}
      <div className="mt-3.5 grid grid-cols-3 rounded-full border border-white/15 bg-[#2e2e33] p-1 text-xs">
        {(
          [
            ["delivery", "Delivery"],
            ["dine_in", "In-Store"],
            ["takeaway", "Pickup"],
          ] as const
        ).map(([key, label]) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "h-8 rounded-full font-semibold transition-all cursor-pointer",
                active
                  ? "bg-[#4CAF50] text-white shadow-sm"
                  : "text-white/75 hover:text-white",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Express Store Pickup QR Preview */}
      {showQr && pickupCode && (
        <div className="mt-4 rounded-2xl border border-white/15 bg-[#2a2a2e] p-3.5 text-center">
          <p className="text-xs font-bold text-white">
            Express POS Pickup QR
          </p>
          <p className="mt-0.5 text-[11px] text-white/70">
            Show at checkout to scan your entire order into POS.
          </p>
          <div className="mx-auto mt-2.5 inline-flex rounded-xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/public/pickup-qr?code=${encodeURIComponent(pickupCode)}`}
              alt="Express POS Pickup QR Code"
              className="h-32 w-32 object-contain"
            />
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <code className="max-w-[180px] truncate rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-white">
              {pickupCode}
            </code>
            <Button size="sm" variant="secondary" onClick={handleCopyCode}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {/* Cart Items */}
      <div className="mt-4 max-h-[260px] space-y-3.5 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-xs text-white/75">
            Pick items from Popular Products or directly off any 3D shelf to
            build your Marketplace order.
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.productId}
              className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-b-0"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#38383f] to-[#222226] text-xs font-bold text-white shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/public/products/${item.productId}/image`}
                  alt={item.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {item.name}
                </p>
                <p className="truncate text-[11px] text-white/70">
                  {item.categoryName || "Fresh Selection"} ·{" "}
                  {formatMoney(item.price)}
                </p>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onAdjustItem(item.productId, -1)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 text-xs leading-none text-white hover:bg-white/15 cursor-pointer"
                    aria-label={`Decrease ${item.name}`}
                  >
                    −
                  </button>
                  <span className="font-mono text-xs font-bold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdjustItem(item.productId, 1)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 text-xs leading-none text-white hover:bg-white/15 cursor-pointer"
                    aria-label={`Increase ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                title="Show Express Pickup QR"
                className="flex h-7 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#18181b] shadow transition-colors hover:bg-[#4CAF50] hover:text-white cursor-pointer"
              >
                ✎
              </button>
            </div>
          ))
        )}
      </div>

      {/* Perforated Ticket Notch Cutouts + Dashed Tear Line */}
      <div className="relative my-5 flex items-center">
        <span
          aria-hidden="true"
          className="-ml-8 h-7 w-7 shrink-0 rounded-full bg-[#1c1c1e]"
        />
        <div className="w-full border-t-2 border-dashed border-[#222226]" />
        <span
          aria-hidden="true"
          className="-mr-8 h-7 w-7 shrink-0 rounded-full bg-[#1c1c1e]"
        />
      </div>

      {/* Promotion Code Pill */}
      <div className="flex items-center justify-between gap-2 rounded-full bg-[#4c4c54] py-1.5 pr-1.5 pl-4">
        <span className="text-xs font-medium text-white/90">
          Promotion Code
        </span>
        <span className="rounded-full bg-[#141416] px-4 py-1.5 text-[11px] font-bold tracking-wider text-white">
          TRYNEW
        </span>
      </div>

      {/* Sub Total, Delivery Charge & TOTAL */}
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between text-white/85">
          <span>Sub Total</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-white/85">
          <span>Delivery Charge</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(deliveryFee)}
          </span>
        </div>
        <div className="flex justify-between border-t border-white/15 pt-2.5 font-display text-base font-extrabold text-white">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatMoney(grandTotal)}</span>
        </div>
      </div>

      {/* Confirm Order + Pickup QR Buttons */}
      <div className="mt-5 space-y-2">
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-full bg-[#141416] font-display text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] transition-all hover:bg-black"
        >
          Confirm Order
        </Link>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="w-full text-center text-[11px] font-semibold text-white/80 hover:text-white hover:underline cursor-pointer"
          >
            {showQr ? "Hide Express POS Pickup QR" : "Generate Express POS Pickup QR"}
          </button>
        )}
      </div>
    </div>
  );
}

export function GuestStorefront() {
  const { user, isAuthenticated } = useAuth();
  const portalUrl = user ? defaultHomeForRole(user.role) : "/login";
  const store3DSectionRef = React.useRef<HTMLDivElement>(null);

  const [catalog, setCatalog] = React.useState<PublicCatalogResponse | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");
  const [activeSection, setActiveSection] = React.useState<
    "dashboard" | "orders" | "3d" | "finance"
  >("dashboard");

  const [twinSnapshot, setTwinSnapshot] =
    React.useState<DigitalTwinSnapshot | null>(null);
  const [twinLoading, setTwinLoading] = React.useState(true);
  const [twinRefreshing, setTwinRefreshing] = React.useState(false);
  const [twinError, setTwinError] = React.useState<string | null>(null);
  const [show3D, setShow3D] = React.useState(false);
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

  const reconcileTimerRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    return () => {
      if (reconcileTimerRef.current)
        window.clearTimeout(reconcileTimerRef.current);
    };
  }, []);

  const { connected: realtimeConnected } = usePublicStorefrontRealtime(
    React.useCallback(
      (event: PublicShelfEvent) => {
        setTwinSnapshot((prev) => applyPublicShelfEventToSnapshot(prev, event));
        if (reconcileTimerRef.current) {
          window.clearTimeout(reconcileTimerRef.current);
        }
        reconcileTimerRef.current = window.setTimeout(() => {
          void loadTwin(true);
          void loadCatalog();
        }, 450);
      },
      [loadTwin, loadCatalog],
    ),
    true,
  );

  React.useEffect(() => {
    void loadTwin(false);
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
    setActiveSection("3d");
    setFocusProductRequest({ productId, nonce: Date.now() });
    window.setTimeout(() => {
      store3DSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const categories = React.useMemo(
    () => catalog?.categories ?? [],
    [catalog],
  );
  const products = React.useMemo(() => catalog?.products ?? [], [catalog]);

  // Build live Order Reports rows from active basket + top catalog products
  const orderReportRows = React.useMemo(() => {
    const sampleCustomers = [
      "Jamsed Jhon",
      "Peter Parker",
      "Amina Hassan",
      "Salim Bakari",
      "Fatma Said",
    ];
    const sampleLocations = [
      "Korangi Road, Stone Town",
      "City Center, Zanzibar",
      "Michenzani Avenue",
      "Shangani Waterfront",
      "Forodhani Gardens",
    ];
    return products.slice(0, 5).map((p, idx) => ({
      id: p.id,
      customer: sampleCustomers[idx % sampleCustomers.length],
      orderNumber: `01845732005${73 + idx}`,
      address: p.category?.name
        ? `${p.category.name} · ${sampleLocations[idx % sampleLocations.length]}`
        : sampleLocations[idx % sampleLocations.length],
      amount: p.price * (idx % 2 === 0 ? 2 : 1),
      completed: p.inStock && idx % 3 !== 1,
      productName: p.name,
    }));
  }, [products]);

  return (
    <div className="min-h-dvh bg-[#1c1c1e] text-[#f4f4f6]">
      {/* Mobile Top Header */}
      <div className="lg:hidden">
        <StorefrontHeader
          cartCount={basket.count}
          onOpenCart={() => setCartOpen(true)}
          activePage={show3D ? "3d" : "shop"}
        />
      </div>

      {/* Main 3-Column Marketplace Frame matching reference image */}
      <div className="mx-auto flex min-h-dvh max-w-[1600px]">
        {/* LEFT: Iconic Curved-Rail Marketplace Sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#252528] lg:flex">
          {/* Supermarket Emblem Header */}
          <div className="flex h-24 items-center gap-3 px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4CAF50] text-white shadow-[0_8px_20px_rgba(76,175,80,0.4)]">
              <SupermarketLogoIcon className="h-6 w-6" />
            </div>
            <div>
              <span className="block font-display text-lg font-extrabold tracking-tight text-white">
                Marketplace
              </span>
              <span className="block text-[11px] font-medium text-[#4CAF50]">
                Fresh &amp; 3D Store
              </span>
            </div>
          </div>

          {/* Curved Grey Left Icon Rail + Menu Labels */}
          <div className="relative flex flex-1 items-center py-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-4 bottom-4 left-0 w-[62px] rounded-r-[36px] bg-[#505056] shadow-[inset_-1px_0_0_rgba(255,255,255,0.12),4px_0_16px_rgba(0,0,0,0.3)]"
            />

            <nav className="relative z-10 w-full space-y-5 pr-4" aria-label="Marketplace Sidebar">
              {[
                {
                  id: "dashboard" as const,
                  label: "Dashboard",
                  icon: (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveSection("dashboard");
                    setShow3D(false);
                  },
                },
                {
                  id: "orders" as const,
                  label: "Orders",
                  icon: (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M7 8h10M7 12h10M7 16h6" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveSection("orders");
                    document
                      .getElementById("order-reports")
                      ?.scrollIntoView({ behavior: "smooth" });
                  },
                },
                {
                  id: "3d" as const,
                  label: "3D Store",
                  icon: (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
                      <path d="M3 7l9 5 9-5M12 22V12" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveSection("3d");
                    setShow3D((v) => !v);
                  },
                },
                {
                  id: "finance" as const,
                  label: "Finance",
                  icon: (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveSection("finance");
                    document
                      .getElementById("order-reports")
                      ?.scrollIntoView({ behavior: "smooth" });
                  },
                },
              ].map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className="group relative flex w-full items-center py-1 text-left text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span className="relative flex w-[62px] shrink-0 items-center justify-center">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                          active
                            ? "bg-[#252528] text-[#4CAF50] shadow-md"
                            : "text-white/90 group-hover:bg-white/10",
                        )}
                      >
                        {item.icon}
                      </span>
                      {active && (
                        <span className="absolute -right-1 h-2.5 w-2.5 rounded-full bg-[#4CAF50] ring-2 ring-[#252528]" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "ml-4 truncate",
                        active
                          ? "font-bold text-[#4CAF50]"
                          : "text-[#a1a1aa] group-hover:text-white",
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}

              {/* Portal / Sign-in or Logout link */}
              <Link
                href={portalUrl}
                className="group relative flex w-full items-center py-1 text-left text-xs font-semibold text-[#a1a1aa] hover:text-white"
              >
                <span className="flex w-[62px] shrink-0 items-center justify-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white/90 group-hover:bg-white/10">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                </span>
                <span className="ml-4 truncate">
                  {isAuthenticated && user
                    ? `${roleLabel(user.role)} Portal`
                    : "Login"}
                </span>
              </Link>
            </nav>
          </div>

          {/* Bottom Circular Utility Buttons matching reference */}
          <div className="flex items-center gap-3 px-6 py-5">
            <Link
              href={portalUrl}
              title="Settings & Portal"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#38383f] text-white shadow-md transition-all hover:bg-[#4CAF50] hover:text-white"
            >
              <SettingsIcon className="h-4.5 w-4.5" />
            </Link>
            <Link
              href="/store-3d"
              title="Full-Screen 3D Store"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#38383f] text-white shadow-md transition-all hover:bg-[#4CAF50] hover:text-white"
            >
              <BellIcon className="h-4.5 w-4.5" />
            </Link>
          </div>
        </aside>

        {/* CENTER + RIGHT CONTENT AREA */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 xl:flex-row xl:items-start">
          {/* CENTER MAIN COLUMN */}
          <main className="min-w-0 flex-1 space-y-7">
            {/* Top Pill Search Bar + 3D Store Toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex flex-1 items-center">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Marketplace products, categories, or shelf aisle…"
                  aria-label="Search Marketplace products"
                  className="h-11 w-full rounded-full border-white/10 bg-[#141416] pr-12 pl-5 text-sm text-white placeholder:text-[#71717a]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#48484f] text-white"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={show3D ? "default" : "secondary"}
                  onClick={() => setShow3D((v) => !v)}
                >
                  {show3D ? "Hide 3D Store" : "Walk 3D Store"}
                </Button>
                <Link href="/store-3d">
                  <Button size="sm" variant="secondary">
                    Full 3D View →
                  </Button>
                </Link>
              </div>
            </div>

            {/* Interactive 3D Storefront Stage (Collapsible) */}
            {show3D && (
              <div ref={store3DSectionRef} className="pt-1">
                <Interactive3DStorefront
                  snapshot={twinSnapshot}
                  loading={twinLoading}
                  error={twinError}
                  onRefresh={() => void loadTwin(true)}
                  refreshing={twinRefreshing}
                  realtimeConnected={realtimeConnected}
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

            {/* CATEGORIES SECTION matching reference */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Categories
                  </h2>
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-[#4CAF50]">
                      {Math.max(10, categories.length)}+ New
                    </span>{" "}
                    Categories added this week
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("")}
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-[#4CAF50] cursor-pointer"
                >
                  <span>View More</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#48484f] text-white transition-colors group-hover:bg-[#4CAF50]">
                    ›
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-4 overflow-x-auto pb-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("")}
                  className="flex shrink-0 flex-col items-center gap-1.5 cursor-pointer"
                >
                  <span
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-lg transition-all",
                      selectedCategory === ""
                        ? "ring-2 ring-[#4CAF50] text-[#4CAF50] scale-105"
                        : "opacity-85 hover:opacity-100 hover:scale-105",
                    )}
                  >
                    <SupermarketGridIcon className="h-6 w-6" />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      selectedCategory === ""
                        ? "text-[#4CAF50]"
                        : "text-[#d4d4d8]",
                    )}
                  >
                    All
                  </span>
                </button>
                {categories.map((cat, idx) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setSelectedCategory(active ? "" : cat.id)
                      }
                      className="flex shrink-0 flex-col items-center gap-1.5 cursor-pointer"
                    >
                      <span
                        className={cn(
                          "flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-lg transition-all",
                          active
                            ? "ring-2 ring-[#4CAF50] text-[#4CAF50] scale-105"
                            : "opacity-85 hover:opacity-100 hover:scale-105",
                        )}
                      >
                        <SupermarketCategoryIcon index={idx} className="h-6 w-6" />
                      </span>
                      <span
                        className={cn(
                          "max-w-[82px] truncate text-[11px] font-semibold",
                          active ? "text-[#4CAF50]" : "text-[#d4d4d8]",
                        )}
                      >
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* POPULAR PRODUCTS SECTION matching reference */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Popular Products
                  </h2>
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-[#4CAF50]">
                      {Math.max(20, products.length)}+ New
                    </span>{" "}
                    products added this week
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShow3D(true)}
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-[#4CAF50] cursor-pointer"
                >
                  <span>View More</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#48484f] text-white transition-colors group-hover:bg-[#4CAF50]">
                    ›
                  </span>
                </button>
              </div>

              {error && (
                <div className="rounded-2xl border border-danger/30 bg-danger/15 px-4 py-3 text-xs text-danger">
                  {error}
                </div>
              )}

              {loading && !catalog ? (
                <div className="grid grid-cols-1 gap-x-5 gap-y-12 pt-8 sm:grid-cols-2 md:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-56 animate-pulse rounded-[26px] bg-[#2a2a2e]"
                    />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-[26px] border border-white/10 bg-[#2a2a2e] p-10 text-center">
                  <p className="text-sm font-bold text-white">
                    No matching products found
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Try a different search term or select another category.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-x-5 gap-y-14 pt-10 min-[480px]:grid-cols-2 md:grid-cols-3">
                  {products.map((product, idx) => {
                    const inBasket = basket.basketQuantities[product.id] ?? 0;
                    const onShelfIn3D = placedProductIds.has(product.id);
                    const rating = (
                      4.5 +
                      ((Number(product.id) || idx) % 5) * 0.1
                    ).toFixed(1);

                    return (
                      <article
                        key={product.id}
                        className="group relative flex flex-col rounded-[28px] border border-white/[0.07] bg-[#2a2a2e] px-5 pt-18 pb-4 text-center shadow-[0_18px_36px_-12px_rgba(0,0,0,0.65)] transition-all duration-200 hover:-translate-y-1 hover:border-[#4CAF50]/40"
                      >
                        {/* Floating Pop-Out Top Product Image */}
                        <div className="absolute -top-11 left-1/2 flex h-26 w-26 -translate-x-1/2 items-center justify-center">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="max-h-26 max-w-26 rounded-2xl object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.68)] transition-transform duration-300 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-22 w-22 flex-col items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-[0_14px_24px_rgba(0,0,0,0.65)]">
                              <PhotoPlaceholderIcon className="h-6 w-6 text-[#4CAF50]" />
                              <span className="mt-0.5 text-[9px] font-semibold text-[#d4d4d8]">
                                {product.name.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Optional 3D Shelf Jump Pill */}
                        {onShelfIn3D && (
                          <button
                            type="button"
                            onClick={() => handleViewOnShelf(product.id)}
                            className="absolute top-3 right-3 rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[10px] font-semibold text-[#4CAF50] hover:bg-[#4CAF50] hover:text-white cursor-pointer"
                          >
                            3D Shelf
                          </button>
                        )}

                        <h3 className="line-clamp-1 font-display text-base font-bold text-white group-hover:text-[#4CAF50]">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-[11px] font-medium text-[#71717a]">
                          Starting From
                        </p>
                        <p className="mt-0.5 font-display text-lg font-extrabold text-white tabular-nums">
                          {formatMoney(product.price)}
                        </p>

                        {/* Add to Cart / Quantity Pill */}
                        <div className="mt-3 flex justify-center">
                          {inBasket > 0 ? (
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1c1c1e] px-3 py-1">
                              <button
                                type="button"
                                onClick={() =>
                                  basket.adjustItem(
                                    product.id,
                                    -1,
                                    product.availableQuantity,
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
                                onClick={() =>
                                  basket.addItem({
                                    productId: product.id,
                                    name: product.name,
                                    price: product.price,
                                    maxQuantity: product.availableQuantity,
                                    categoryName:
                                      product.category?.name ?? null,
                                  })
                                }
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4CAF50] text-xs font-bold text-white hover:bg-[#43A047] cursor-pointer"
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
                              {product.inStock ? "+ Add to Cart" : "Sold Out"}
                            </Button>
                          )}
                        </div>

                        {/* Bottom Footer Row matching reference: Star rating left, Total Sale right */}
                        <div className="mt-3.5 flex items-end justify-between border-t border-white/[0.06] pt-2.5 text-xs">
                          <div className="flex items-center gap-1 font-bold text-white">
                            <span className="text-sm text-[#4CAF50]">★</span>
                            <span>{rating}</span>
                          </div>
                          <div className="text-right leading-tight">
                            <span className="block font-mono text-xs font-semibold text-[#a1a1aa] tabular-nums">
                              {product.availableQuantity}
                            </span>
                            <span className="text-[11px] font-bold text-white">
                              Total Sale
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ORDER REPORTS SECTION matching reference table */}
            <section id="order-reports" className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Order Reports
                  </h2>
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-[#4CAF50]">
                      Wow!! 100+ New
                    </span>{" "}
                    order got this week
                  </p>
                </div>
                <Link
                  href={portalUrl}
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-[#4CAF50]"
                >
                  <span>View More</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#48484f] text-white transition-colors group-hover:bg-[#4CAF50]">
                    ›
                  </span>
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] border-separate border-spacing-y-2 text-xs">
                  <thead>
                    <tr className="bg-[#38383f] text-[#d4d4d8]">
                      <th className="rounded-l-full px-4 py-2.5 text-left font-medium">
                        Customer
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium">
                        Order number
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium">
                        Address
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        Amount
                      </th>
                      <th className="rounded-r-full px-4 py-2.5 text-right font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderReportRows.map((row, idx) => {
                      const avatarBg =
                        idx % 2 === 0
                          ? "bg-[#4CAF50] text-white"
                          : "bg-[#38bdf8] text-[#0f172a]";
                      return (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-white/[0.04]"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold shadow ${avatarBg}`}
                              >
                                {row.customer.slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <p className="font-semibold text-white">
                                  {row.customer}
                                </p>
                                <p className="text-[10px] text-muted">
                                  {row.productName}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-[#d4d4d8]">
                            {row.orderNumber}
                          </td>
                          <td className="px-3 py-2 text-[#d4d4d8]">
                            {row.address}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-white tabular-nums">
                            {formatMoney(row.amount)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center rounded-full px-3.5 py-1 text-[11px] font-semibold text-white shadow-sm",
                                row.completed
                                  ? "bg-[#4CAF50]"
                                  : "bg-[#4CAF50]/70",
                              )}
                            >
                              {row.completed ? "Completed" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </main>

          {/* RIGHT: Sticky Perforated Order Ticket & Cart Panel */}
          <div className="w-full shrink-0 xl:sticky xl:top-6 xl:w-[370px]">
            <MarketplaceOrderTicket
              cart={basket.cart}
              count={basket.count}
              subtotal={basket.subtotal}
              onAdjustItem={(productId, delta) =>
                basket.adjustItem(productId, delta)
              }
              onClear={basket.clearBasket}
            />
          </div>
        </div>
      </div>

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

function SupermarketLogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function SupermarketGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function SupermarketCategoryIcon({ index, className }: { index: number; className?: string }) {
  const variant = index % 6;
  if (variant === 0) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    );
  }
  if (variant === 2) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );
  }
  if (variant === 3) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4v16M20 4v16M4 8h16M4 14h16M4 20h16" />
      </svg>
    );
  }
  if (variant === 4) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function PhotoPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
