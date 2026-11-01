// POS page.
//
// Point-of-sale terminal: product picker, shopping cart, customer details,
// and checkout. Powered by the typed API client.

"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/components/ui/link";
import { useProducts } from "@/hooks/useProducts";
import { formatMoney, formatDate } from "@/lib/format";

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface CustomerForm {
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

export default function PosPage() {
  const { data, loading, error } = useProducts({ take: 100 });
  const [search, setSearch] = useState("");
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
  const [receipt, setReceipt] = useState<{
    saleId: string;
    controlNumber: string;
    customerFullName: string;
    customerEmail: string;
    grandTotal: number;
    items: Array<{ productName: string; quantity: number; price: number; total: number }>;
    paymentMethod: string;
    createdAt: string;
  } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const products = data?.products ?? [];

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = 0.15;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  const addToCart = useCallback((product: typeof products[number]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          price: typeof product.price === "string" ? Number(product.price) : product.price,
          quantity: 1,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const adjustQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCheckoutError(null);
    setReceipt(null);
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setCheckoutError("Add at least one item before checkout.");
      return;
    }
    if (!customer.email || !customer.fullName || !customer.phone) {
      setCheckoutError("Customer name, email, and phone are required.");
      return;
    }

    setCheckingOut(true);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
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
      setReceipt({
        saleId: result.id ?? result.sale?.id ?? "",
        controlNumber: result.payment?.control_number ?? result.controlNumber ?? "",
        customerFullName: customer.fullName,
        customerEmail: customer.email,
        grandTotal,
        items: cart.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        })),
        paymentMethod,
        createdAt: new Date().toISOString(),
      });

      clearCart();
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          <div className="bg-background rounded-lg border border-border shadow-sm h-full">
            <SkeletonText lines={6} className="p-6" />
          </div>
          <div className="bg-background rounded-lg border border-border shadow-sm h-full p-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4">
                <Input
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="border-t border-border p-4 overflow-auto max-h-[400px]">
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
                              variant="primary"
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

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Shopping Cart</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 overflow-auto max-h-[420px]">
                {cart.length === 0 ? (
                  <EmptyState title="Empty cart" description="Add products to start a sale." />
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
                        <TableRow key={item.productId}>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Button variant="ghost" size="sm" onClick={() => adjustQuantity(item.productId, -1)} className="h-7 w-7 p-0">−</Button>
                              <span className="text-xs font-medium">{item.quantity}</span>
                              <Button variant="ghost" size="sm" onClick={() => adjustQuantity(item.productId, 1)} className="h-7 w-7 p-0">+</Button>
                              <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="h-7 w-7 p-0 text-danger">×</Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatMoney(item.price)}</TableCell>
                          <TableCell className="text-right text-sm">{item.quantity}</TableCell>
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
                disabled={cart.length === 0 || checkingOut}
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
                    {receipt.items.map((item) => (
                      <TableRow key={item.productName}>
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
                    <span className="text-right">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span className="text-right">{formatMoney(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-1">
                    <span>Total</span>
                    <span className="text-right">{formatMoney(grandTotal)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted italic">
                  Payment: {receipt.paymentMethod.replace("_", " ")} · Thank you for shopping with us!
                </p>

                <Button variant="outline" className="w-full" onClick={() => setReceipt(null)}>
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
