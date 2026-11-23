// Unified Marketplace Point of Sale (POS) terminal.
//
// Split-screen workflow styled after the Marketplace dark charcoal & coral-red
// specification: pill search, circular category medallions, floating-top product
// pedestal cards (plus table view toggle), and the perforated order ticket cart
// panel on the right.

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarcodeCameraScanner } from "@/components/barcode-camera-scanner";
import { useAuth } from "@/components/auth/auth-provider";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useCustomers } from "@/hooks/useCustomers";
import { usePosCart } from "@/hooks/usePosCart";
import { portalHref } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type OrderFulfillmentMode = "delivery" | "dine_in" | "takeaway";

export default function PosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, refresh } = useProducts({ take: 200 });
  const { data: categoriesData } = useCategories();
  const { data: customersData } = useCustomers({ take: 100 });
  const cart = usePosCart();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] =
    useState<OrderFulfillmentMode>("delivery");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const products = useMemo(() => data?.products ?? [], [data]);
  const categories = useMemo(
    () => categoriesData?.categories ?? [],
    [categoriesData],
  );
  const customers = useMemo(
    () => customersData?.customers ?? [],
    [customersData],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory && p.category?.id !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedCategory]);

  const handleScanSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const added = await cart.addBarcodeToCart(cart.scanValue);
      if (added) {
        cart.setScanValue("");
        requestAnimationFrame(() => cart.scanInputRef.current?.focus());
      }
    },
    [cart],
  );

  const handleCameraScan = useCallback(
    async (barcode: string) => {
      await cart.addBarcodeToCart(barcode);
    },
    [cart],
  );

  const handleSelectCustomer = (customerId: string) => {
    if (!customerId) {
      cart.setCustomer({
        customerId: null,
        fullName: "",
        email: "",
        phone: "",
        address: "",
      });
      return;
    }
    const found = customers.find((c) => c.id === customerId);
    if (!found) return;
    cart.setCustomer({
      customerId: found.id,
      fullName: found.name,
      email: found.email.endsWith(".local") ? "" : found.email,
      phone: found.phone,
      address: found.address,
    });
  };

  const handleCompleteSale = async () => {
    const receipt = await cart.handleCheckout();
    if (receipt?.saleId) {
      refresh();
      router.push(
        portalHref(
          user?.role,
          `/receipt/${encodeURIComponent(receipt.saleId)}`,
        ),
      );
    } else if (receipt) {
      refresh();
      router.push(portalHref(user?.role, "/receipt"));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <SkeletonText lines={2} className="w-[40%]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_380px]">
          <div className="h-[540px] rounded-[24px] border border-border bg-background p-6">
            <SkeletonText lines={8} />
          </div>
          <div className="h-[540px] rounded-[28px] border border-border bg-background p-6">
            <SkeletonText lines={8} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-white">
          Marketplace POS
        </h1>
        <EmptyState
          title="Unable to load products"
          description={error.message}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.58fr)_390px] xl:items-start">
        {/* LEFT: Pill Search, Barcode Scanner, Circular Categories & Floating Product Cards */}
        <div className="space-y-6">
          {/* Top Pill Search Bar + Quick Links */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex flex-1 items-center">
              <Input
                placeholder="Search Marketplace products, categories, or barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "cards" ? "default" : "secondary"}
                onClick={() =>
                  setViewMode((v) => (v === "cards" ? "table" : "cards"))
                }
              >
                {viewMode === "cards" ? "Table View" : "Cards View"}
              </Button>
              <Link href={portalHref(user?.role, "/shopping-cart")}>
                <Button size="sm" variant="secondary">
                  Full Cart ({cart.itemCount})
                </Button>
              </Link>
              <Link href={portalHref(user?.role, "/sales")}>
                <Button size="sm" variant="secondary">
                  Orders →
                </Button>
              </Link>
            </div>
          </div>

          {/* Barcode & Pickup QR Scanner Bar */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <form
                onSubmit={handleScanSubmit}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <Input
                  id="barcode-scan"
                  ref={cart.scanInputRef}
                  value={cart.scanValue}
                  onChange={(e) => cart.setScanValue(e.target.value)}
                  placeholder="Scan barcode or Express Pickup QR (SZPICK1:…) and press Enter…"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={cart.scanning || cart.checkingOut}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={
                      !cart.scanValue.trim() ||
                      cart.scanning ||
                      cart.checkingOut
                    }
                  >
                    {cart.scanning ? "Looking…" : "+ Scan Add"}
                  </Button>
                  <BarcodeCameraScanner
                    continuous
                    disabled={cart.checkingOut}
                    startLabel="Camera Scan"
                    onScan={handleCameraScan}
                  />
                </div>
              </form>
              {cart.scanError && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger/15 px-3.5 py-2 text-xs text-danger"
                >
                  {cart.scanError}
                </div>
              )}
              {cart.scanSuccess && (
                <div
                  role="status"
                  className="rounded-xl border border-[#4CAF50]/30 bg-[#4CAF50]/15 px-3.5 py-2 text-xs text-[#4CAF50]"
                >
                  {cart.scanSuccess}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Circular Categories Row matching reference */}
          {categories.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Categories
                  </h2>
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-[#4CAF50]">
                      {categories.length}+ New
                    </span>{" "}
                    Categories added this week
                  </p>
                </div>
                <Link
                  href={portalHref(user?.role, "/categories")}
                  className="group inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-[#4CAF50]"
                >
                  <span>View More</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#48484f] text-white group-hover:bg-[#4CAF50]">
                    ›
                  </span>
                </Link>
              </div>

              <div className="flex items-center gap-3.5 overflow-x-auto pb-1.5">
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
                    All ({products.length})
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
                          "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-lg transition-all",
                          active
                            ? "ring-2 ring-[#4CAF50] text-[#4CAF50] scale-105"
                            : "opacity-85 hover:opacity-100 hover:scale-105",
                        )}
                      >
                        {cat.image_available ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`/api/categories/${cat.id}/image`}
                            alt={cat.name}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <SupermarketCategoryIcon index={idx} className="h-6 w-6" />
                        )}
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
          )}

          {/* Popular Products Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Popular Products
                </h2>
                <p className="text-xs text-muted">
                  <span className="font-semibold text-[#4CAF50]">
                    {filteredProducts.length}+ New
                  </span>{" "}
                  items ready for instant checkout
                </p>
              </div>
              <Link
                href={portalHref(user?.role, "/products")}
                className="group inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-[#4CAF50]"
              >
                <span>View More</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#48484f] text-white group-hover:bg-[#4CAF50]">
                  ›
                </span>
              </Link>
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState
                title="No products found"
                description="Try clearing your search or category filter."
              />
            ) : viewMode === "table" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-xs text-muted">
                          {p.category?.name ?? "General"}
                          {p.barcode ? ` · ${p.barcode}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-white tabular-nums">
                        {formatMoney(p.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            p.quantity <= 0
                              ? "danger"
                              : p.quantity <= 10
                                ? "warning"
                                : "success"
                          }
                        >
                          {p.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => cart.addToCart(p)}
                          disabled={p.quantity <= 0 || cart.checkingOut}
                        >
                          + Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="grid grid-cols-1 gap-x-4 gap-y-14 pt-10 min-[460px]:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((p, idx) => {
                  const rating = (
                    4.5 +
                    ((Number(p.id) || idx) % 5) * 0.1
                  ).toFixed(1);
                  const out = p.quantity <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (!out && !cart.checkingOut) cart.addToCart(p);
                      }}
                      className={cn(
                        "group relative flex flex-col rounded-[26px] border border-white/[0.07] bg-[#2a2a2e] px-4 pt-16 pb-4 text-center shadow-[0_16px_34px_-12px_rgba(0,0,0,0.65)] transition-all duration-200",
                        out
                          ? "opacity-55 cursor-not-allowed"
                          : "cursor-pointer hover:-translate-y-1 hover:border-[#4CAF50]/45",
                      )}
                    >
                      {/* Floating Pop-Out Top Product Image */}
                      <div className="absolute -top-10 left-1/2 flex h-24 w-24 -translate-x-1/2 items-center justify-center">
                        {p.image_available ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`/api/products/${p.id}/image?v=${encodeURIComponent(p.updatedAt ?? "")}`}
                            alt={p.name}
                            className="max-h-24 max-w-24 rounded-2xl object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.68)] transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-[0_12px_20px_rgba(0,0,0,0.6)]">
                            <PhotoPlaceholderIcon className="h-6 w-6 text-[#4CAF50]" />
                            <span className="mt-0.5 text-[9px] font-semibold text-[#d4d4d8]">
                              {p.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      <h3 className="line-clamp-1 font-display text-sm font-bold text-white group-hover:text-[#4CAF50]">
                        {p.name}
                      </h3>
                      <p className="mt-0.5 text-[10px] font-medium text-[#71717a]">
                        Starting From
                      </p>
                      <p className="mt-0.5 font-display text-base font-extrabold text-white tabular-nums">
                        {formatMoney(p.price)}
                      </p>

                      <div className="mt-3 flex items-end justify-between border-t border-white/[0.06] pt-2.5 text-[11px]">
                        <div className="flex items-center gap-1 font-bold text-white">
                          <span className="text-[#4CAF50]">★</span>
                          <span>{rating}</span>
                        </div>
                        <div className="text-right leading-tight">
                          <span className="block font-mono text-[11px] font-semibold text-[#a1a1aa]">
                            {p.quantity}
                          </span>
                          <span className="text-[10px] font-bold text-white">
                            Total Stock
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: Perforated Order Ticket & Cart Panel matching reference */}
        <aside className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#3c3c42] p-5 text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)] xl:sticky xl:top-20">
          {/* Top Delivery Address / Customer Card */}
          <div className="rounded-2xl bg-[#54545c] p-4 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xs font-bold tracking-wider uppercase text-white">
                DELIVERY ADDRESS
              </p>
              <button
                type="button"
                onClick={() => setShowCustomerDetails((v) => !v)}
                className="text-[11px] font-semibold text-[#4CAF50] hover:underline cursor-pointer"
              >
                {showCustomerDetails ? "Hide" : "Edit Customer"}
              </button>
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs text-white/95">
              <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-[#4CAF50]" />
              <span className="truncate">
                {cart.customer.address ||
                  cart.customer.fullName ||
                  "Po. 1478, Stone Town Main Road, Zanzibar"}
              </span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-white/80">
              <ClockIcon className="h-3.5 w-3.5 shrink-0 text-[#4CAF50]" />
              <span>20 min · Express Marketplace Checkout</span>
            </p>

            <div className="mt-3">
              <Select
                value={cart.customer.customerId ?? ""}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                aria-label="Select existing customer"
                className="h-8 bg-[#38383f] text-xs"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) · {c.loyaltyPoints} pts
                  </option>
                ))}
              </Select>
            </div>

            {showCustomerDetails && (
              <div className="mt-2.5 grid grid-cols-1 gap-2">
                <Input
                  placeholder="Customer full name"
                  value={cart.customer.fullName}
                  onChange={(e) =>
                    cart.setCustomer({
                      ...cart.customer,
                      fullName: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Phone or delivery address"
                  value={cart.customer.phone}
                  onChange={(e) =>
                    cart.setCustomer({
                      ...cart.customer,
                      phone: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* Cart Title + Order ID */}
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CartIcon className="h-4.5 w-4.5 text-[#4CAF50]" />
              <h2 className="font-display text-base font-bold text-white">
                Cart
              </h2>
              {cart.itemCount > 0 && (
                <span className="rounded-full bg-[#4CAF50] px-2 py-0.5 text-[10px] font-bold text-white">
                  {cart.itemCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-white/75">
                Order ID: #1099
              </span>
              {cart.cart.length > 0 && (
                <button
                  type="button"
                  onClick={cart.clearCart}
                  disabled={cart.checkingOut}
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
              const active = fulfillmentMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFulfillmentMode(key)}
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

          {/* Cart Items List */}
          <div className="mt-4 max-h-[250px] space-y-3 overflow-y-auto pr-1">
            {cart.cart.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-xs text-white/75">
                Tap any product card on the left or scan a barcode to add items
                to your order ticket.
              </div>
            ) : (
              cart.cart.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-b-0"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#38383f] to-[#222226] text-xs font-bold text-white shadow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/products/${item.productId}/image`}
                      alt={item.productName}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {item.productName}
                    </p>
                    <p className="text-[11px] text-white/70 tabular-nums">
                      {formatMoney(item.price)}
                      {item.unitId && item.quantityMultiplier > 1
                        ? ` · ${item.unitId} × ${cart.formatMultiplier(item.quantityMultiplier)}`
                        : ""}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cart.adjustQuantity(item.key, -1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 text-xs leading-none text-white hover:bg-white/15 cursor-pointer"
                        aria-label={`Decrease ${item.productName}`}
                      >
                        −
                      </button>
                      <span className="font-mono text-xs font-bold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => cart.adjustQuantity(item.key, 1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 text-xs leading-none text-white hover:bg-white/15 cursor-pointer"
                        aria-label={`Increase ${item.productName}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => cart.removeFromCart(item.key)}
                      title={`Remove ${item.productName}`}
                      className="flex h-7 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-[#18181b] shadow hover:bg-[#4CAF50] hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                    <span className="font-mono text-xs font-bold text-white tabular-nums">
                      {formatMoney(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Perforated Ticket Notch Cutouts + Dashed Tear Line */}
          <div className="relative my-5 flex items-center">
            <span
              aria-hidden="true"
              className=" -ml-8 h-7 w-7 shrink-0 rounded-full bg-[#1c1c1e]"
            />
            <div className="w-full border-t-2 border-dashed border-[#222226]" />
            <span
              aria-hidden="true"
              className="-mr-8 h-7 w-7 shrink-0 rounded-full bg-[#1c1c1e]"
            />
          </div>

          {/* Promotion / Discount Pill Bar & Payment Method */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 rounded-full bg-[#4c4c54] py-1.5 pr-1.5 pl-4">
              <span className="text-xs font-medium text-white/90">
                Promotion / Discount
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step="100"
                  placeholder="0 TSh"
                  value={cart.discountInput}
                  onChange={(e) => cart.setDiscountInput(e.target.value)}
                  className="h-7 w-24 rounded-full bg-[#141416] px-3 text-center font-mono text-xs font-bold text-white focus:outline-none"
                />
                <span className="rounded-full bg-[#141416] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white">
                  TRYNEW
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-full bg-[#4c4c54] py-1.5 pr-2 pl-4">
              <span className="text-xs font-medium text-white/90">
                Payment Method
              </span>
              <select
                value={cart.paymentMethod}
                onChange={(e) =>
                  cart.setPaymentMethod(
                    e.target.value as
                      | "cash"
                      | "mobile_money"
                      | "card"
                      | "bank_transfer",
                  )
                }
                className="h-7 rounded-full bg-[#141416] px-3 text-xs font-semibold text-white focus:outline-none"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Subtotal, Tax & Total */}
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between text-white/85">
              <span>Sub Total</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(cart.subtotal)}
              </span>
            </div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-[#4ade80]">
                <span>Discount</span>
                <span className="font-semibold tabular-nums">
                  −{formatMoney(cart.discount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-white/85">
              <span>Tax ({cart.taxRatePercent}%)</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(cart.taxAmount)}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/15 pt-2.5 font-display text-base font-extrabold text-white">
              <span>TOTAL</span>
              <span className="tabular-nums">
                {formatMoney(cart.grandTotal)}
              </span>
            </div>
          </div>

          {cart.checkoutError && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-danger/40 bg-danger/20 p-2.5 text-xs text-white"
            >
              {cart.checkoutError}
            </div>
          )}

          {/* Full-Width Dark Pill "Confirm Order" Button matching reference */}
          <button
            type="button"
            disabled={cart.cart.length === 0 || cart.checkingOut}
            onClick={() => void handleCompleteSale()}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[#141416] font-display text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] transition-all hover:bg-black disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {cart.checkingOut
              ? "Processing Order…"
              : `Confirm Order — ${formatMoney(cart.grandTotal)}`}
          </button>
        </aside>
      </div>
    </div>
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
