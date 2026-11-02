// POS page.
//
// Point-of-sale terminal: barcode scanner input, product picker, shopping cart,
// customer details, and checkout. Barcodes are resolved by the backend so the
// cart always uses the current branch price and stock.

"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarcodeCameraScanner } from "@/components/barcode-camera-scanner";
import Link from "@/components/ui/link";
import { useProducts } from "@/hooks/useProducts";
import { lookupBarcode } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";

interface CartItem {
  /** Product + packaging unit; lets an "each" and a "carton" line coexist. */
  key: string;
  productId: string;
  productName: string;
  /** Price for one scanned package (or one each). */
  price: number;
  /** Number of packages in the cart. */
  quantity: number;
  /** Base stock units represented by one package. */
  quantityMultiplier: number;
  unitId: string | null;
  barcode?: string | null;
}

interface CustomerForm {
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

interface Receipt {
  saleId: string;
  controlNumber: string;
  customerFullName: string;
  customerEmail: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  items: Array<{ productName: string; quantity: number; price: number; total: number }>;
  paymentMethod: string;
  createdAt: string;
}

function formatMultiplier(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export default function PosPage() {
  const { data, loading, error } = useProducts({ take: 100 });
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "card">(
    "cash",
  );
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const products = data?.products ?? [];

  const searchTerm = search.trim().toLowerCase();
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm) ||
      (p.barcode ?? "").toLowerCase().includes(searchTerm),
  );

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = 0.15;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  const addCartLine = useCallback(
    (line: Omit<CartItem, "key" | "quantity">) => {
      const key = `${line.productId}:${line.unitId ?? "each"}`;

      setCart((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
          );
        }
        return [...prev, { ...line, key, quantity: 1 }];
      });
    },
    [],
  );

  const addToCart = useCallback(
    (product: typeof products[number]) => {
      addCartLine({
        productId: product.id,
        productName: product.name,
        price:
          typeof product.price === "string" ? Number(product.price) : product.price,
        quantityMultiplier: 1,
        unitId: null,
        barcode: product.barcode ?? null,
      });
    },
    [addCartLine],
  );

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const adjustQuantity = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCheckoutError(null);
    setReceipt(null);
  }, []);

  const addBarcodeToCart = useCallback(
    async (rawBarcode: string): Promise<boolean> => {
      const barcode = rawBarcode.trim();
      if (!barcode || scanning || checkingOut) return false;

      setScanning(true);
      setScanError(null);
      setScanSuccess(null);

      try {
        const result = await lookupBarcode(barcode);

        if (!result.inStock) {
          setScanError(
            `${result.product.name} is out of stock at this branch (${result.stock} base units).`,
          );
          return false;
        }

        const unitsAlreadyInCart = cart
          .filter((item) => item.productId === result.product.id)
          .reduce(
            (sum, item) => sum + item.quantity * item.quantityMultiplier,
            0,
          );

        if (
          unitsAlreadyInCart + result.packaging.quantityMultiplier >
          result.stock
        ) {
          setScanError(
            `Only ${result.stock} base units of ${result.product.name} are in stock.`,
          );
          return false;
        }

        addCartLine({
          productId: result.product.id,
          productName: result.product.name,
          price: Number(result.price),
          quantityMultiplier: result.packaging.quantityMultiplier,
          unitId:
            result.packaging.unitId === "each"
              ? null
              : result.packaging.unitId,
          barcode: result.barcode,
        });

        const pack =
          result.packaging.quantityMultiplier > 1
            ? ` (${result.packaging.unitId} × ${formatMultiplier(result.packaging.quantityMultiplier)})`
            : "";

        setScanSuccess(`Added ${result.product.name}${pack}.`);
        return true;
      } catch (err) {
        setScanError(
          err instanceof Error ? err.message : "Barcode lookup failed.",
        );
        return false;
      } finally {
        setScanning(false);
      }
    },
    [addCartLine, cart, checkingOut, scanning],
  );

  const handleScan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const added = await addBarcodeToCart(scanValue);
    if (added) {
      setScanValue("");
      requestAnimationFrame(() => scanInputRef.current?.focus());
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutError("Add at least one item before checkout.");
      return;
    }
    if (!customer.email || !customer.fullName || !customer.phone) {
      setCheckoutError("Customer name, email, and phone are required.");
      return;
    }

    // Snapshot the cart so a scan during checkout cannot change the totals.
    const cartSnapshot = cart;
    const snapshotSubtotal = cartSnapshot.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const snapshotTax = snapshotSubtotal * taxRate;
    const snapshotTotal = snapshotSubtotal + snapshotTax;

    setCheckingOut(true);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: cartSnapshot.map((i) => ({
            productId: i.productId,
            // The API stores base stock units; it prices the line from the DB.
            quantity: i.quantity * i.quantityMultiplier,
            price: Number((i.price / i.quantityMultiplier).toFixed(2)),
          })),
          customerFullName: customer.fullName,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Checkout failed." }));
        setCheckoutError(err.detail || "Checkout failed.");
        return;
      }

      const result = await res.json();
      const serverSubtotal = Number(result.sale?.subtotal ?? snapshotSubtotal);
      const serverTax = Number(result.sale?.taxAmount ?? snapshotTax);
      const serverTotal = Number(result.sale?.grandTotal ?? snapshotTotal);

      setReceipt({
        saleId: result.sale?.id ?? result.id ?? "",
        controlNumber:
          result.sale?.controlNumber ??
          result.payment?.control_number ??
          result.controlNumber ??
          "",
        customerFullName: customer.fullName,
        customerEmail: customer.email,
        subtotal: serverSubtotal,
        taxAmount: serverTax,
        grandTotal: serverTotal,
        items: cartSnapshot.map((i) => ({
          productName: i.unitId
            ? `${i.productName} (${i.unitId})`
            : i.productName,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        })),
        paymentMethod,
        createdAt: new Date().toISOString(),
      });

      setCart([]);
      setScanValue("");
      setScanError(null);
      setScanSuccess(null);
      requestAnimationFrame(() => scanInputRef.current?.focus());
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-[40%]" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
          <div className="min-h-56 rounded-lg border border-border bg-background shadow-sm xl:col-span-2 xl:h-[600px]">
            <SkeletonText lines={6} className="p-6" />
          </div>
          <div className="min-h-56 rounded-lg border border-border bg-background p-6 shadow-sm xl:h-[600px]">
            <SkeletonText lines={8} className="space-y-4" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Point of Sale</h1>
        <EmptyState
          title="Unable to load products"
          description={error.message}
          action={
            <button onClick={() => window.location.reload()} className="btn-try">
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Point of Sale</h1>
          <p className="text-muted">Scan or search products, build a cart, and complete the sale.</p>
        </div>
        <Link href="/sales" className="Button">
          View all sales →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-b border-border p-4 space-y-2">
                <label
                  htmlFor="barcode-scan"
                  className="text-sm font-medium text-foreground"
                >
                  Scan barcode
                </label>
                <form onSubmit={handleScan} className="flex min-w-0 gap-2">
                  <Input
                    id="barcode-scan"
                    ref={scanInputRef}
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="Scan or type a Code 128 label…"
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    disabled={scanning || checkingOut}
                  />
                  <Button
                    type="submit"
                    disabled={!scanValue.trim() || scanning || checkingOut}
                  >
                    {scanning ? "Looking…" : "Add"}
                  </Button>
                </form>
                <p className="text-xs text-muted">
                  Code 128 supports letters, numbers and symbols. USB/Bluetooth
                  scanners send the code and Enter automatically, or use the
                  device camera below.
                </p>
                <BarcodeCameraScanner
                  continuous
                  disabled={checkingOut}
                  startLabel="Scan with device camera"
                  onScan={async (barcode) => {
                    await addBarcodeToCart(barcode);
                  }}
                />
                {scanError && (
                  <div
                    role="alert"
                    className="rounded-md border border-danger/20 bg-danger/10 p-2.5 text-sm text-danger"
                  >
                    {scanError}
                  </div>
                )}
                {scanSuccess && (
                  <div
                    role="status"
                    className="rounded-md border border-success/20 bg-success/10 p-2.5 text-sm text-success"
                  >
                    {scanSuccess}
                  </div>
                )}
              </div>

              <div className="border-b border-border p-4">
                <Input
                  placeholder="Search by name or barcode…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="p-4 overflow-auto max-h-[400px]">
                {filteredProducts.length === 0 ? (
                  <EmptyState title="No products found" description="Try a different search term." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[1/3]">Product</TableHead>
                        <TableHead className="w-[1/4] text-right">Price</TableHead>
                        <TableHead className="w-[1/6] text-right">Stock</TableHead>
                        <TableHead className="w-[1/3]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            <p className="text-xs text-muted">{p.category?.name ?? "Uncategorized"}</p>
                            {p.barcode && (
                              <p className="font-mono text-[11px] text-muted">{p.barcode}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatMoney(p.price)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <Badge variant={p.quantity < 10 ? "danger" : "success"}>
                              {p.quantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => addToCart(p)}
                              disabled={p.quantity <= 0}
                            >
                              Add
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
        </div>

        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Shopping Cart</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 overflow-auto max-h-[420px]">
                {cart.length === 0 ? (
                  <EmptyState title="Empty cart" description="Scan a barcode or add products to start a sale." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[2/5]">Item</TableHead>
                        <TableHead className="w-[1/5] text-right">Price</TableHead>
                        <TableHead className="w-[1/5] text-right">Qty</TableHead>
                        <TableHead className="w-[1/5] text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            {item.unitId && item.quantityMultiplier > 1 && (
                              <Badge variant="secondary" className="mt-1">
                                {item.unitId} · {formatMultiplier(item.quantityMultiplier)} units
                              </Badge>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Button variant="ghost" size="sm" onClick={() => adjustQuantity(item.key, -1)} className="h-7 w-7 p-0">−</Button>
                              <span className="text-xs font-medium">{item.quantity}</span>
                              <Button variant="ghost" size="sm" onClick={() => adjustQuantity(item.key, 1)} className="h-7 w-7 p-0">+</Button>
                              <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.key)} className="h-7 w-7 p-0 text-danger">×</Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatMoney(item.price)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {item.quantity}
                            {item.quantityMultiplier > 1 && (
                              <div className="text-[11px] text-muted">
                                {formatMultiplier(item.quantity * item.quantityMultiplier)} base units
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatMoney(item.price * item.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="border-t border-border p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Subtotal</span>
                  <span className="font-medium">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Tax (15%)</span>
                  <span className="font-medium">{formatMoney(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatMoney(grandTotal)}</span>
                </div>
              </div>
            </CardContent>

            <div className="border-t border-border bg-background/50 p-4 space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Customer Details</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Full name"
                    value={customer.fullName}
                    onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Phone"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  />
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "cash" | "mobile_money" | "card")}
                  >
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="card">Card</option>
                  </Select>
                </div>
                <Input
                  placeholder="Address (optional)"
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                />
              </div>

              {checkoutError && (
                <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-danger text-sm">
                  {checkoutError}
                </div>
              )}

              <Button
                variant="success"
                className="w-full py-3 font-semibold"
                disabled={cart.length === 0 || checkingOut || scanning}
                onClick={handleCheckout}
              >
                {checkingOut ? "Processing…" : `Complete Sale — ${formatMoney(grandTotal)}`}
              </Button>

              <Button
                variant="ghost"
                className="w-full py-2 text-sm text-muted"
                disabled={cart.length === 0}
                onClick={clearCart}
              >
                Clear Cart
              </Button>
            </div>
          </Card>
          {receipt && (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Receipt</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧾</span>
                    <h3 className="font-display font-bold text-foreground">Supermarket Zanzibar</h3>
                  </div>
                  <p className="text-xs text-muted">{formatDate(receipt.createdAt)}</p>
                  <p className="text-xs text-muted">Sale #{receipt.saleId} · Control: {receipt.controlNumber}</p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[1/2]">Item</TableHead>
                      <TableHead className="w-[1/6] text-right">Qty</TableHead>
                      <TableHead className="w-[1/3] text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipt.items.map((item, index) => (
                      <TableRow key={`${item.productName}-${index}`}>
                        <TableCell className="text-sm">{item.productName}</TableCell>
                        <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{formatMoney(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="border-t border-border pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span className="text-right">{formatMoney(receipt.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span className="text-right">{formatMoney(receipt.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-1">
                    <span>Total</span>
                    <span className="text-right">{formatMoney(receipt.grandTotal)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted italic">
                  Payment: {receipt.paymentMethod.replace("_", " ")} · Thank you for shopping with us!
                </p>

                <Button variant="secondary" className="w-full" onClick={() => setReceipt(null)}>
                  New Sale
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
