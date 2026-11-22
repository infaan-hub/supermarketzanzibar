// Dedicated shopping cart view.
//
// Shares persisted cart state with /pos for larger basket review and checkout.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePosCart } from "@/hooks/usePosCart";
import { useCustomers } from "@/hooks/useCustomers";
import { formatMoney } from "@/lib/format";

export default function ShoppingCartPage() {
  const cart = usePosCart();
  const router = useRouter();
  const { data: customersData } = useCustomers({ take: 100 });
  const customers = customersData?.customers ?? [];

  const handleCheckout = async () => {
    const receipt = await cart.handleCheckout();
    if (receipt?.saleId) {
      router.push(`/receipt/${encodeURIComponent(receipt.saleId)}`);
    } else if (receipt) {
      router.push("/receipt");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="POS Basket Review"
        title="Shopping Cart"
        description="Review line items, attach a loyalty customer if needed, and complete checkout."
        actions={
          <Link href="/pos">
            <Button size="sm" variant="secondary">
              ← Back to POS Terminal
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Basket Items ({cart.itemCount})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[460px] overflow-auto p-4">
                {cart.cart.length === 0 ? (
                  <EmptyState
                    title="Empty cart"
                    description="Scan a barcode or add products on the POS terminal."
                    action={
                      <Link
                        href="/pos"
                        className="inline-flex h-10 items-center rounded bg-primary-hover px-4 text-sm font-medium text-white"
                      >
                        Open Point of Sale
                      </Link>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.cart.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            {item.unitId && item.quantityMultiplier > 1 && (
                              <Badge variant="secondary" className="mt-1">
                                {item.unitId} ·{" "}
                                {cart.formatMultiplier(item.quantityMultiplier)}{" "}
                                units
                              </Badge>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => cart.adjustQuantity(item.key, -1)}
                                className="h-7 w-7 p-0"
                              >
                                −
                              </Button>
                              <span className="text-xs font-medium tabular-nums">
                                {item.quantity}
                              </span>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => cart.adjustQuantity(item.key, 1)}
                                className="h-7 w-7 p-0"
                              >
                                +
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cart.removeFromCart(item.key)}
                                className="h-7 w-7 p-0 text-danger"
                              >
                                ×
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatMoney(item.price)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {item.quantity}
                            {item.quantityMultiplier > 1 && (
                              <div className="text-[11px] text-muted">
                                {cart.formatMultiplier(
                                  item.quantity * item.quantityMultiplier,
                                )}{" "}
                                base units
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums">
                            {formatMoney(item.price * item.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {cart.cart.length > 0 && (
                <div className="space-y-2 border-t border-border p-4 text-sm">
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
                    <span className="text-muted">
                      Tax ({cart.taxRatePercent}%)
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(cart.taxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatMoney(cart.grandTotal)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Checkout Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Customer (Optional)
              </label>
              <Select
                value={cart.customer.customerId ?? ""}
                onChange={(e) => {
                  const found = customers.find((c) => c.id === e.target.value);
                  if (!found) {
                    cart.setCustomer({
                      customerId: null,
                      fullName: "",
                      email: "",
                      phone: "",
                      address: "",
                    });
                    return;
                  }
                  cart.setCustomer({
                    customerId: found.id,
                    fullName: found.name,
                    email: found.email.endsWith(".local") ? "" : found.email,
                    phone: found.phone,
                    address: found.address,
                  });
                }}
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) · {c.loyaltyPoints} pts
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Full name (optional)"
                value={cart.customer.fullName}
                onChange={(e) =>
                  cart.setCustomer({ ...cart.customer, fullName: e.target.value })
                }
              />
              <Input
                placeholder="Email for receipt (optional)"
                type="email"
                value={cart.customer.email}
                onChange={(e) =>
                  cart.setCustomer({ ...cart.customer, email: e.target.value })
                }
              />
              <Input
                placeholder="Phone (optional)"
                value={cart.customer.phone}
                onChange={(e) =>
                  cart.setCustomer({ ...cart.customer, phone: e.target.value })
                }
              />
              <Input
                placeholder="Address (optional)"
                value={cart.customer.address}
                onChange={(e) =>
                  cart.setCustomer({ ...cart.customer, address: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-3">
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
                <Input
                  type="number"
                  min={0}
                  step="100"
                  placeholder="Discount (TZS)"
                  value={cart.discountInput}
                  onChange={(e) => cart.setDiscountInput(e.target.value)}
                />
              </div>
            </div>

            {cart.checkoutError && (
              <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                {cart.checkoutError}
              </div>
            )}

            <Button
              variant="success"
              size="lg"
              className="w-full font-semibold"
              disabled={cart.cart.length === 0 || cart.checkingOut}
              isLoading={cart.checkingOut}
              onClick={() => void handleCheckout()}
            >
              Complete Sale — {formatMoney(cart.grandTotal)}
            </Button>

            <Button
              variant="ghost"
              className="w-full text-sm text-muted"
              disabled={cart.cart.length === 0}
              onClick={cart.clearCart}
            >
              Clear Cart
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
