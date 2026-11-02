// Stock page.
//
// Inventory levels, product registration by barcode, and stock IN/OUT scanning.
// The camera component feeds the same barcode fields as a USB/Bluetooth scanner.

"use client";

import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonText } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarcodeCameraScanner } from "@/components/barcode-camera-scanner";
import { useCategories } from "@/hooks/useCategories";
import { useStock } from "@/hooks/useStock";
import { adjustStockByBarcode, createProduct } from "@/lib/api";
import { cn } from "@/lib/utils";

type MovementMode = "IN" | "OUT";

interface ProductForm {
  barcode: string;
  name: string;
  categoryId: string;
  price: string;
  costPrice: string;
  quantity: string;
}

const EMPTY_PRODUCT_FORM: ProductForm = {
  barcode: "",
  name: "",
  categoryId: "",
  price: "",
  costPrice: "",
  quantity: "0",
};

function Feedback({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  if (!error && !message) return null;

  return error ? (
    <div
      role="alert"
      className="rounded-md border border-danger/20 bg-danger/10 p-2.5 text-sm text-danger"
    >
      {error}
    </div>
  ) : (
    <div
      role="status"
      className="rounded-md border border-success/20 bg-success/10 p-2.5 text-sm text-success"
    >
      {message}
    </div>
  );
}

export default function StockPage() {
  const { data, loading, refreshing, error, refresh } = useStock();
  const { data: categoriesData } = useCategories();

  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);

  const [movementMode, setMovementMode] = useState<MovementMode>("IN");
  const [movementBarcode, setMovementBarcode] = useState("");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [adjusting, setAdjusting] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [movementMessage, setMovementMessage] = useState<string | null>(null);

  const stock = data?.stock ?? [];
  const categories = categoriesData?.categories ?? [];
  const lowCount = stock.filter((s) => s.quantity <= s.lowStockThreshold).length;
  const criticalCount = stock.filter((s) => s.quantity <= s.reorderLevel).length;

  async function handleRegisterProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registering) return;

    setRegisterError(null);
    setRegisterMessage(null);

    if (!productForm.barcode.trim()) {
      setRegisterError("Scan a product barcode or enter one manually.");
      return;
    }
    if (!productForm.name.trim()) {
      setRegisterError("Enter a product name.");
      return;
    }
    if (!productForm.price.trim()) {
      setRegisterError("Enter a selling price.");
      return;
    }

    const quantity = Number(productForm.quantity || "0");
    if (!Number.isInteger(quantity) || quantity < 0) {
      setRegisterError("Opening stock must be a whole number.");
      return;
    }

    setRegistering(true);

    try {
      const product = await createProduct({
        name: productForm.name,
        barcode: productForm.barcode,
        categoryId: productForm.categoryId || null,
        price: productForm.price,
        costPrice: productForm.costPrice || "0",
        quantity,
      });

      setRegisterMessage(
        `Added "${product.name}" (${product.barcode}) to inventory with ${product.quantity} base unit${product.quantity === 1 ? "" : "s"}.`,
      );
      setProductForm(EMPTY_PRODUCT_FORM);
      await refresh();
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "Unable to register this product.",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function handleStockMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adjusting) return;

    setMovementError(null);
    setMovementMessage(null);

    if (!movementBarcode.trim()) {
      setMovementError("Scan a product barcode or enter one manually.");
      return;
    }

    const quantity = Number(movementQuantity || "1");
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMovementError("Quantity must be a whole number of packages.");
      return;
    }

    setAdjusting(true);

    try {
      const result = await adjustStockByBarcode({
        barcode: movementBarcode,
        movementType: movementMode,
        quantity,
      });

      const action = movementMode === "IN" ? "Received" : "Issued";
      const pack =
        result.product.quantityMultiplier > 1
          ? ` (${result.packages} × ${result.product.unitId} × ${result.product.quantityMultiplier})`
          : "";

      setMovementMessage(
        `${action} ${result.units} base unit${result.units === 1 ? "" : "s"} of "${result.product.name}"${pack}. New stock: ${result.product.quantity}.`,
      );
      setMovementBarcode("");
      setMovementQuantity("1");
      await refresh();
    } catch (err) {
      setMovementError(
        err instanceof Error ? err.message : "Unable to adjust stock.",
      );
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Inventory &amp; Stock
          </h1>
          <p className="text-muted">
            Scan a new barcode to register a product, or scan an existing product
            to receive (IN / import) or issue (OUT / export) stock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={criticalCount ? "danger" : "success"}>
            {criticalCount} critical
          </Badge>
          <Badge variant={lowCount ? "warning" : "success"}>
            {lowCount} low stock
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Register a new product</CardTitle>
            <p className="text-sm text-muted">
              Scan the barcode printed on the product, then enter its details.
              The product becomes available in the POS immediately.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegisterProduct} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="register-barcode"
                  className="text-sm font-medium text-foreground"
                >
                  Product barcode
                </label>
                <Input
                  id="register-barcode"
                  value={productForm.barcode}
                  onChange={(event) =>
                    setProductForm((form) => ({
                      ...form,
                      barcode: event.target.value,
                    }))
                  }
                  placeholder="Scan or type the barcode"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={registering}
                />
                <BarcodeCameraScanner
                  disabled={registering}
                  startLabel="Scan product barcode"
                  onScan={(barcode) => {
                    setProductForm((form) => ({ ...form, barcode }));
                    setRegisterError(null);
                    setRegisterMessage(null);
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="register-name"
                  className="text-sm font-medium text-foreground"
                >
                  Product name
                </label>
                <Input
                  id="register-name"
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm((form) => ({
                      ...form,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Coconut oil 1L"
                  disabled={registering}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="register-category"
                    className="text-sm font-medium text-foreground"
                  >
                    Category
                  </label>
                  <Select
                    id="register-category"
                    value={productForm.categoryId}
                    onChange={(event) =>
                      setProductForm((form) => ({
                        ...form,
                        categoryId: event.target.value,
                      }))
                    }
                    disabled={registering}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="register-quantity"
                    className="text-sm font-medium text-foreground"
                  >
                    Opening stock
                  </label>
                  <Input
                    id="register-quantity"
                    type="number"
                    min={0}
                    step={1}
                    value={productForm.quantity}
                    onChange={(event) =>
                      setProductForm((form) => ({
                        ...form,
                        quantity: event.target.value,
                      }))
                    }
                    disabled={registering}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="register-price"
                    className="text-sm font-medium text-foreground"
                  >
                    Selling price (TZS)
                  </label>
                  <Input
                    id="register-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={productForm.price}
                    onChange={(event) =>
                      setProductForm((form) => ({
                        ...form,
                        price: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    disabled={registering}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="register-cost"
                    className="text-sm font-medium text-foreground"
                  >
                    Cost price (TZS)
                  </label>
                  <Input
                    id="register-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={productForm.costPrice}
                    onChange={(event) =>
                      setProductForm((form) => ({
                        ...form,
                        costPrice: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    disabled={registering}
                  />
                </div>
              </div>

              <Feedback error={registerError} message={registerMessage} />

              <Button
                type="submit"
                className="w-full"
                isLoading={registering}
              >
                Add product to inventory
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock IN / OUT by scan</CardTitle>
            <p className="text-sm text-muted">
              Choose receive (import) or issue (export), scan the product, and
              confirm the number of packages. Every adjustment is recorded as a
              stock movement.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStockMovement} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={movementMode === "IN" ? "success" : "secondary"}
                  onClick={() => {
                    setMovementMode("IN");
                    setMovementError(null);
                    setMovementMessage(null);
                  }}
                  disabled={adjusting}
                >
                  Receive (IN)
                </Button>
                <Button
                  type="button"
                  variant={movementMode === "OUT" ? "danger" : "secondary"}
                  onClick={() => {
                    setMovementMode("OUT");
                    setMovementError(null);
                    setMovementMessage(null);
                  }}
                  disabled={adjusting}
                >
                  Issue (OUT)
                </Button>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="movement-barcode"
                  className="text-sm font-medium text-foreground"
                >
                  Product barcode
                </label>
                <Input
                  id="movement-barcode"
                  value={movementBarcode}
                  onChange={(event) => setMovementBarcode(event.target.value)}
                  placeholder="Scan or type the barcode"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={adjusting}
                />
                <BarcodeCameraScanner
                  disabled={adjusting}
                  startLabel="Scan stock barcode"
                  onScan={(barcode) => {
                    setMovementBarcode(barcode);
                    setMovementError(null);
                    setMovementMessage(null);
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="movement-quantity"
                  className="text-sm font-medium text-foreground"
                >
                  Packages / scans
                </label>
                <Input
                  id="movement-quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={movementQuantity}
                  onChange={(event) =>
                    setMovementQuantity(event.target.value)
                  }
                  disabled={adjusting}
                />
                <p className="text-xs text-muted">
                  If the scanned label represents a pack, its multiplier is
                  applied automatically. Example: carton × 12 with quantity 2
                  receives 24 base units.
                </p>
              </div>

              <Feedback error={movementError} message={movementMessage} />

              <Button
                type="submit"
                variant={movementMode === "IN" ? "success" : "danger"}
                className="w-full"
                isLoading={adjusting}
              >
                {movementMode === "IN" ? "Receive stock" : "Issue stock"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Current stock
            </h2>
            <p className="text-sm text-muted">
              {stock.length} product{stock.length === 1 ? "" : "s"} tracked.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void refresh()}
            isLoading={refreshing}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <SkeletonText lines={6} className="p-6" />
        ) : error ? (
          <EmptyState
            title="Unable to load stock"
            description={error.message}
            action={
              <Button type="button" variant="secondary" onClick={() => void refresh()}>
                Try again
              </Button>
            }
          />
        ) : stock.length === 0 ? (
          <EmptyState
            title="No stock items yet"
            description="Register a product above to add the first inventory item."
          />
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32%]">Product</TableHead>
                  <TableHead className="w-[18%]">Category</TableHead>
                  <TableHead className="w-[14%] text-right">Quantity</TableHead>
                  <TableHead className="w-[14%] text-right">Low Stock</TableHead>
                  <TableHead className="w-[14%] text-right">Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((item) => {
                  const isCritical = item.quantity <= item.reorderLevel;
                  const isLow = item.quantity <= item.lowStockThreshold;

                  return (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        <p className="font-mono text-[11px] text-muted">
                          {item.barcode}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted">
                        {item.category?.name ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-sm font-medium",
                          isCritical
                            ? "text-danger"
                            : isLow
                              ? "text-warning"
                              : "text-success",
                        )}
                      >
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted">
                        {item.lowStockThreshold}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted">
                        {item.reorderLevel}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
