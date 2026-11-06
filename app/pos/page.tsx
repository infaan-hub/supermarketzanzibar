// POS page.
//
// Point-of-sale terminal: barcode scanner input and product picker.
// Scanning or adding a product sends the shopper to the dedicated
// shopping-cart page, where the basket and checkout live.

"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarcodeCameraScanner } from "@/components/barcode-camera-scanner";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import { usePosCart } from "@/hooks/usePosCart";
import { formatMoney } from "@/lib/format";

export default function PosPage() {
  const { data, loading, error } = useProducts({ take: 100 });
  const router = useRouter();
  const cart = usePosCart();
  const scanInputRef = cart.scanInputRef;
  const [search, setSearch] = useState("");

  const products = data?.products ?? [];

  const searchTerm = search.trim().toLowerCase();
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm) ||
      (p.barcode ?? "").toLowerCase().includes(searchTerm),
  );

  const handleAdd = useCallback(
    (product: typeof products[number]) => {
      cart.addToCart(product);
      router.push("/shopping-cart");
    },
    [cart, router],
  );

  const handleScanSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const added = await cart.addBarcodeToCart(cart.scanValue);
      if (added) {
        cart.setScanValue("");
        router.push("/shopping-cart");
      }
    },
    [cart, router],
  );

  const handleCameraScan = useCallback(
    async (barcode: string) => {
      const added = await cart.addBarcodeToCart(barcode);
      if (added) router.push("/shopping-cart");
    },
    [cart, router],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-[40%]" />
        </div>
        <div className="min-h-56 rounded-lg border border-border bg-background shadow-sm xl:h-[600px]">
          <SkeletonText lines={6} className="p-6" />
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
          <p className="text-muted">Scan or search products, then complete the sale in the shopping cart.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/shopping-cart" className="text-sm font-medium text-primary hover:underline">
            View cart →
          </Link>
          <Link href="/sales" className="text-sm font-medium text-primary hover:underline">
            View all sales →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Products</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b border-border p-4 space-y-2">
            <label htmlFor="barcode-scan" className="text-sm font-medium text-foreground">
              Scan barcode
            </label>
            <form onSubmit={handleScanSubmit} className="flex min-w-0 gap-2">
              <Input
                id="barcode-scan"
                ref={scanInputRef}
                value={cart.scanValue}
                onChange={(e) => cart.setScanValue(e.target.value)}
                placeholder="Scan or type a Code 128 label…"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                disabled={cart.scanning || cart.checkingOut}
              />
              <Button
                type="submit"
                disabled={!cart.scanValue.trim() || cart.scanning || cart.checkingOut}
              >
                {cart.scanning ? "Looking…" : "Add"}
              </Button>
            </form>
            <p className="text-xs text-muted">
              Code 128 supports letters, numbers and symbols. USB/Bluetooth
              scanners send the code and Enter automatically, or use the device
              camera below.
            </p>
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
                          onClick={() => handleAdd(p)}
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
  );
}
