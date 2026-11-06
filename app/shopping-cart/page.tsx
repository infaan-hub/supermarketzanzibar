// Shopping cart page.
//
// Dedicated basket and checkout screen. The POS terminal adds items here;
// everything (cart, customer details, payment method) is shared with /pos
// through the persisted cart state.

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePosCart } from "@/hooks/usePosCart";
import { formatMoney } from "@/lib/format";
import Link from "@/components/ui/link";

export default function ShoppingCartPage() {
  const cart = usePosCart();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Shopping Cart</h1>
          <p className="text-muted">Review the basket and complete the sale.</p>
        </div>
        <Link href="/pos" className="text-sm font-medium text-primary hover:underline">
          ← Back to POS
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Shopping Cart</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 overflow-auto max-h-[420px]">
                {cart.cart.length === 0 && !cart.receipt ? (
                  <EmptyState title="Empty cart" description="Scan a barcode or add products to start a sale." />
                ) : cart.cart.length === 0 ? null : (
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
                      {cart.cart.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            {item.unitId && item.quantityMultiplier > 1 && (
                              <Badge variant="secondary" className="mt-1">
                                {item.unitId} · {cart.formatMultiplier(item.quantityMultiplier)} units
                              </Badge>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Button variant="ghost" size="sm" onClick={() => cart.adjustQuantity(item.key, -1)} className="h-7 w-7 p-0">−</Button>
                              <span className="text-xs font-medium">{item.quantity}</span>
                              <Button variant="ghost" size="sm" onClick={() => cart.adjustQuantity(item.key, 1)} className="h-7 w-7 p-0">+</Button>
                              <Button variant="ghost" size="sm" onClick={() => cart.removeFromCart(item.key)} className="h-7 w-7 p-0 text-danger">×</Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatMoney(item.price)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {item.quantity}
                            {item.quantityMultiplier > 1 && (
                              <div className="text-[11px] text-muted">
                                {cart.formatMultiplier(item.quantity * item.quantityMultiplier)} base units
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

              {cart.cart.length > 0 && (
                <div className="border-t border-border p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal</span>
                    <span className="font-medium">{formatMoney(cart.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Tax (15%)</span>
                    <span className="font-medium">{formatMoney(cart.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>{formatMoney(cart.grandTotal)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Customer Details</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Full name"
                    value={cart.customer.fullName}
                    onChange={(e) => cart.setCustomer({ ...cart.customer, fullName: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    value={cart.customer.email}
                    onChange={(e) => cart.setCustomer({ ...cart.customer, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Phone"
                    value={cart.customer.phone}
                    onChange={(e) => cart.setCustomer({ ...cart.customer, phone: e.target.value })}
                  />
                  <Select
                    value={cart.paymentMethod}
                    onChange={(e) => cart.setPaymentMethod(e.target.value as "cash" | "mobile_money" | "card")}
                  >
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="card">Card</option>
                  </Select>
                </div>
                <Input
                  placeholder="Address (optional)"
                  value={cart.customer.address}
                  onChange={(e) => cart.setCustomer({ ...cart.customer, address: e.target.value })}
                />
              </div>

              {cart.checkoutError && (
                <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-danger text-sm">
                  {cart.checkoutError}
                </div>
              )}

              <Button
                variant="success"
                className="w-full py-3 font-semibold"
                disabled={cart.cart.length === 0 || cart.checkingOut}
                onClick={cart.handleCheckout}
              >
                {cart.checkingOut ? "Processing…" : `Complete Sale — ${formatMoney(cart.grandTotal)}`}
              </Button>

              <Button
                variant="ghost"
                className="w-full py-2 text-sm text-muted"
                disabled={cart.cart.length === 0}
                onClick={cart.clearCart}
              >
                Clear Cart
              </Button>
            </CardContent>
          </Card>

          {cart.receipt && (
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
                  <p className="text-xs text-muted">{formatMoney(cart.receipt.subtotal)} subtotal</p>
                  <p className="text-xs text-muted">Sale #{cart.receipt.saleId} · Control: {cart.receipt.controlNumber}</p>
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
                    {cart.receipt.items.map((item, index) => (
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
                    <span className="text-right">{formatMoney(cart.receipt.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span className="text-right">{formatMoney(cart.receipt.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-1">
                    <span>Total</span>
                    <span className="text-right">{formatMoney(cart.receipt.grandTotal)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted italic">
                  Payment: {cart.receipt.paymentMethod.replace("_", " ")} · Thank you for shopping with us!
                </p>

                <Button variant="secondary" className="w-full" onClick={() => cart.setReceipt(null)}>
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
