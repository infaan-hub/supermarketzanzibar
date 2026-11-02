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

interface CountForm {
  name: string;
  categoryId: string;
  price: string;
  costPrice: string;
}

const EMPTY_COUNT_FORM: CountForm = {
  name: "",
  categoryId: "",
  price: "",
  costPrice: "",
};

interface FinalizedProduct {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  sourceBarcode: string | null;
}

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

  const [countForm, setCountForm] = useState<CountForm>(EMPTY_COUNT_FORM);
  const [countedUnits, setCountedUnits] = useState(0);
  const [countAnnouncement, setCountAnnouncement] = useState("");
  const [lockedBarcode, setLockedBarcode] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);
  const [finalizedProduct, setFinalizedProduct] =
    useState<FinalizedProduct | null>(null);

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

  function resetCountSession() {
    setCountForm(EMPTY_COUNT_FORM);
    setCountedUnits(0);
    setCountAnnouncement("");
    setLockedBarcode(null);
    setFinalizedProduct(null);
    setCountError(null);
    // Remounting the scanner releases the camera and starts a fresh session.
    setScannerKey((key) => key + 1);
  }

  function handleCountScan(barcode: string): boolean {
    if (finalizing) return false;

    setCountError(null);
    setFinalizedProduct(null);

    if (!countForm.name.trim()) {
      setCountError("Enter the product name before opening the camera.");
      return false;
    }

    if (lockedBarcode && barcode !== lockedBarcode) {
      setCountError(
        `This count is for barcode ${lockedBarcode}. Finalize or reset before counting a different product.`,
      );
      return false;
    }

    if (!lockedBarcode) setLockedBarcode(barcode);
    const nextCount = countedUnits + 1;
    setCountedUnits(nextCount);
    setCountAnnouncement(`Scan accepted. ${nextCount} ${nextCount === 1 ? "unit" : "units"} counted for ${countForm.name.trim()}.`);
    return true;
  }

  async function handleFinalizeProduct() {
    if (finalizing) return;

    setCountError(null);
    setFinalizedProduct(null);

    if (!countForm.name.trim()) {
      setCountError("Enter the product name before counting.");
      return;
    }
    if (!countForm.price.trim()) {
      setCountError("Enter a selling price before finalizing.");
      return;
    }
    if (!lockedBarcode || countedUnits < 1) {
      setCountError("Scan at least one unit with the camera before finalizing.");
      return;
    }

    setFinalizing(true);

    try {
      const product = await createProduct({
        name: countForm.name,
        sourceBarcode: lockedBarcode,
        categoryId: countForm.categoryId || null,
        price: countForm.price,
        costPrice: countForm.costPrice || "0",
        quantity: countedUnits,
      });

      const finalized: FinalizedProduct = {
        id: product.id,
        name: product.name,
        barcode: product.barcode ?? "",
        quantity: product.quantity,
        sourceBarcode: product.sourceBarcode ?? lockedBarcode,
      };

      // Finalizing renews the form for the next product and releases the camera.
      resetCountSession();
      setFinalizedProduct(finalized);
      await refresh();
    } catch (err) {
      setCountError(
        err instanceof Error ? err.message : "Unable to finalize this product.",
      );
    } finally {
      setFinalizing(false);
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
            Enter the product name, scan every unit with the camera, then
            finalize. The system assigns each product its own unique barcode.
            Scan existing products under IN / OUT for later stock changes.
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
            <CardTitle>Count &amp; register a product</CardTitle>
            <p className="text-sm text-muted">
              Enter the product name first, then open the camera and scan every
              unit. Each accepted scan beeps and raises the count. Finalizing
              saves the counted stock and generates the product&apos;s own
              unique barcode.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="count-name"
                  className="text-sm font-medium text-foreground"
                >
                  Product name
                </label>
                <Input
                  id="count-name"
                  value={countForm.name}
                  onChange={(event) =>
                    setCountForm((form) => ({
                      ...form,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Coconut oil 1L"
                  autoComplete="off"
                  disabled={finalizing}
                  autoFocus
                />
                <p className="text-xs text-muted">
                  Required before the camera can start counting.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="count-category"
                    className="text-sm font-medium text-foreground"
                  >
                    Category
                  </label>
                  <Select
                    id="count-category"
                    value={countForm.categoryId}
                    onChange={(event) =>
                      setCountForm((form) => ({
                        ...form,
                        categoryId: event.target.value,
                      }))
                    }
                    disabled={finalizing}
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
                    htmlFor="count-price"
                    className="text-sm font-medium text-foreground"
                  >
                    Selling price (TZS)
                  </label>
                  <Input
                    id="count-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={countForm.price}
                    onChange={(event) =>
                      setCountForm((form) => ({
                        ...form,
                        price: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    disabled={finalizing}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="count-cost"
                    className="text-sm font-medium text-foreground"
                  >
                    Cost price (TZS)
                  </label>
                  <Input
                    id="count-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={countForm.costPrice}
                    onChange={(event) =>
                      setCountForm((form) => ({
                        ...form,
                        costPrice: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    disabled={finalizing}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-accent/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Counted units
                    </p>
                    <p className="font-display text-3xl font-bold text-foreground" aria-live="polite" aria-atomic="true">
                      {countedUnits}
                    </p>
                    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                      {countAnnouncement}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Scanned code
                    </p>
                    {lockedBarcode ? (
                      <Badge variant="success" className="font-mono">
                        {lockedBarcode}
                      </Badge>
                    ) : (
                      <p className="text-sm text-muted">Not scanned yet</p>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  The first scan locks this session to one barcode. Scan the same
                  code for every unit, or finalize / reset before counting a
                  different product.
                </p>
              </div>

              <BarcodeCameraScanner
                key={scannerKey}
                continuous
                beepOnScan
                disabled={finalizing || !countForm.name.trim()}
                startLabel="Open camera & count units"
                activeHint="Scan each unit. The count updates and beeps on every accepted scan."
                onScan={handleCountScan}
              />

              {!countForm.name.trim() && (
                <p className="text-xs text-muted">
                  Enter the product name to enable the camera.
                </p>
              )}

              <Feedback error={countError} message={null} />

              {finalizedProduct && (
                <div
                  role="status"
                  className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success"
                >
                  <p className="font-medium">
                    {finalizedProduct.name} registered with{" "}
                    {finalizedProduct.quantity} unit
                    {finalizedProduct.quantity === 1 ? "" : "s"}.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide">
                      System barcode
                    </span>
                    <span className="font-mono font-semibold">
                      {finalizedProduct.barcode}
                    </span>
                    <a
                      href={`/api/barcodes/label?value=${encodeURIComponent(finalizedProduct.barcode)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium underline underline-offset-2"
                      title="Print Code 128 label"
                    >
                      Print label
                    </a>
                  </div>
                  {finalizedProduct.sourceBarcode && (
                    <p className="mt-1 text-xs">
                      Scanned label stored as an alias:{" "}
                      <span className="font-mono">
                        {finalizedProduct.sourceBarcode}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => void handleFinalizeProduct()}
                  isLoading={finalizing}
                  disabled={countedUnits < 1}
                >
                  Finalize &amp; save to stock
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetCountSession}
                  disabled={finalizing}
                >
                  Reset count
                </Button>
              </div>

              <p className="text-xs text-muted">
                Finalizing inserts the product, records the counted units as a
                stock movement, and renews this form for the next product.
              </p>
            </div>
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
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <p className="font-mono text-[11px] text-muted">
                            {item.barcode || "—"}
                          </p>
                          {item.barcode && (
                            <a
                              href={`/api/barcodes/label?value=${encodeURIComponent(item.barcode)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-medium text-primary hover:underline"
                              title="Print Code 128 label"
                            >
                              Print label
                            </a>
                          )}
                        </div>
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
