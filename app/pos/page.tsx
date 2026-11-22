// Unified Point of Sale (POS) terminal.
//
// Split-screen workflow: continuous barcode scanning & searchable catalogue on
// the left, live basket + customer selector + checkout on the right. Cashiers
// stay on /pos across multi-item scans and jump to /receipt/[id] only when a
// sale is finalized.

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useCustomers } from "@/hooks/useCustomers";
import { usePosCart } from "@/hooks/usePosCart";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function PosPage() {
  const router = useRouter();
  const { data, loading, error, refresh } = useProducts({ take: 200 });
  const { data: categoriesData } = useCategories();
  const { data: customersData } = useCustomers({ take: 100 });
  const cart = usePosCart();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);

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
      router.push(`/receipt/${encodeURIComponent(receipt.saleId)}`);
    } else if (receipt) {
      refresh();
      router.push("/receipt");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <SkeletonText lines={2} className="w-[40%]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="h-[540px] rounded-lg border border-border bg-background p-6">
            <SkeletonText lines={8} />
          </div>
          <div className="h-[540px] rounded-lg border border-border bg-background p-6">
            <SkeletonText lines={8} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Point of Sale
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
    <div className="mx-auto max-w-[1440px] space-y-5">
      <PageHeader
        title="Point of Sale"
        description="Scan barcodes or select products to build the basket and complete checkout."
        actions={
          <>
            <Link href="/shopping-cart">
              <Button size="sm" variant="secondary">
                Full Cart ({cart.itemCount})
              </Button>
            </Link>
            <Link href="/sales">
              <Button size="sm" variant="secondary">
                Sales History →
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:items-start">
        {/* LEFT: Scanner & Product Picker */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Scan &amp; Pick Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-3 border-b border-border px-6 pb-5">
              <label
                htmlFor="barcode-scan"
                className="text-sm font-medium text-foreground"
              >
                Scan barcode (USB / Bluetooth / Camera)
              </label>
              <form onSubmit={handleScanSubmit} className="flex min-w-0 gap-2">
                <Input
                  id="barcode-scan"
                  ref={cart.scanInputRef}
                  value={cart.scanValue}
                  onChange={(e) => cart.setScanValue(e.target.value)}
                  placeholder="Scan or type a Code 128 label and press Enter…"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={cart.scanning || cart.checkingOut}
                />
                <Button
                  type="submit"
                  disabled={
                    !cart.scanValue.trim() || cart.scanning || cart.checkingOut
                  }
                >
                  {cart.scanning ? "Looking…" : "Add"}
                </Button>
              </form>
              <BarcodeCameraScanner
                continuous
                disabled={cart.checkingOut}
                startLabel="Scan with device camera"
                onScan={handleCameraScan}
              />
              {cart.scanError && (
                <div
                  role="alert"
                  className="rounded-md border border-danger/20 bg-danger/10 p-2.5 text-sm text-danger"
                >
                  {cart.scanError}
                </div>
              )}
              {cart.scanSuccess && (
                <div
                  role="status"
                  className="rounded-md border border-success/20 bg-success/10 p-2.5 text-sm text-success"
                >
                  {cart.scanSuccess}
                </div>
              )}
            </div>

            <div className="space-y-3 border-b border-border px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Search products by name or barcode…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="sm:w-52"
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("")}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      selectedCategory === ""
                        ? "border-primary-hover bg-primary-hover text-white"
                        : "border-border bg-surface-subtle text-muted hover:text-foreground",
                    )}
                  >
                    All ({products.length})
                  </button>
                  {categories.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        selectedCategory === c.id
                          ? "border-primary-hover bg-primary-hover text-white"
                          : "border-border bg-surface-subtle text-muted hover:text-foreground",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[480px] overflow-auto px-4 py-3">
              {filteredProducts.length === 0 ? (
                <EmptyState
                  title="No products found"
                  description="Try clearing your search or category filter."
                />
              ) : (
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
                          <div className="font-medium text-foreground">
                            {p.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span>{p.category?.name ?? "Uncategorized"}</span>
                            {p.barcode && (
                              <span className="font-mono text-[11px]">
                                · {p.barcode}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          {formatMoney(p.price)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
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
                            variant="default"
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Live Cart & Checkout */}
        <Card className="xl:sticky xl:top-20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>
              Active Basket{" "}
              {cart.itemCount > 0 && (
                <Badge variant="default" className="ml-2">
                  {cart.itemCount}
                </Badge>
              )}
            </CardTitle>
            {cart.cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={cart.clearCart}
                disabled={cart.checkingOut}
                className="text-danger hover:text-danger"
              >
                Clear
              </Button>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="max-h-[280px] overflow-auto rounded-lg border border-border">
              {cart.cart.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted">
                  Scan a barcode or click <strong>+ Add</strong> to start a sale.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {cart.cart.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.productName}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <span>{formatMoney(item.price)} each</span>
                          {item.unitId && item.quantityMultiplier > 1 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.unitId} ×{" "}
                              {cart.formatMultiplier(item.quantityMultiplier)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => cart.adjustQuantity(item.key, -1)}
                          aria-label={`Decrease ${item.productName}`}
                        >
                          −
                        </Button>
                        <span className="w-7 text-center text-xs font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => cart.adjustQuantity(item.key, 1)}
                          aria-label={`Increase ${item.productName}`}
                        >
                          +
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-danger"
                          onClick={() => cart.removeFromCart(item.key)}
                          aria-label={`Remove ${item.productName}`}
                        >
                          ×
                        </Button>
                      </div>
                      <div className="w-20 text-right text-sm font-semibold tabular-nums">
                        {formatMoney(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment & Discount */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">
                  Payment Method
                </label>
                <Select
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
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">
                  Discount (TZS)
                </label>
                <Input
                  type="number"
                  min={0}
                  step="100"
                  placeholder="0"
                  value={cart.discountInput}
                  onChange={(e) => cart.setDiscountInput(e.target.value)}
                />
              </div>
            </div>

            {/* Optional Customer / Loyalty Picker */}
            <div className="space-y-2 rounded-lg border border-border bg-surface-subtle/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-foreground">
                  Customer (Optional — Walk-in by default)
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setShowCustomerDetails((v) => !v)}
                >
                  {showCustomerDetails ? "Hide fields" : "Enter manually"}
                </button>
              </div>
              <Select
                value={cart.customer.customerId ?? ""}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                aria-label="Select existing customer"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) · {c.loyaltyPoints} pts
                  </option>
                ))}
              </Select>
              {showCustomerDetails && (
                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                  <Input
                    placeholder="Full name"
                    value={cart.customer.fullName}
                    onChange={(e) =>
                      cart.setCustomer({
                        ...cart.customer,
                        fullName: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Phone (optional)"
                    value={cart.customer.phone}
                    onChange={(e) =>
                      cart.setCustomer({
                        ...cart.customer,
                        phone: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="email"
                    placeholder="Email for receipt (optional)"
                    value={cart.customer.email}
                    onChange={(e) =>
                      cart.setCustomer({
                        ...cart.customer,
                        email: e.target.value,
                      })
                    }
                    className="sm:col-span-2"
                  />
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(cart.subtotal)}
                </span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span className="font-medium tabular-nums">
                    −{formatMoney(cart.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Tax ({cart.taxRatePercent}%)</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(cart.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                <span>Grand Total</span>
                <span className="tabular-nums">
                  {formatMoney(cart.grandTotal)}
                </span>
              </div>
            </div>

            {cart.checkoutError && (
              <div
                role="alert"
                className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger"
              >
                {cart.checkoutError}
              </div>
            )}

            <Button
              variant="success"
              size="lg"
              className="w-full font-semibold"
              disabled={cart.cart.length === 0 || cart.checkingOut}
              isLoading={cart.checkingOut}
              onClick={() => void handleCompleteSale()}
            >
              Complete Sale — {formatMoney(cart.grandTotal)}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
