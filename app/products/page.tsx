// Products catalogue page (`/products`).
//
// Live search, category & low-stock filtering, margin visibility, label
// printing, and drill-down into `/products/[id]` for editing & pack barcodes.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/components/auth/auth-provider";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { createProduct } from "@/lib/api";
import { isProductRole, portalHref } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

export default function ProductsPage() {
  const { user } = useAuth();
  const canManageProducts = isProductRole(user?.role);
  const { settings } = useStoreSettings();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("0");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  const {
    data: categoriesData,
    loading: catsLoading,
    error: catsError,
  } = useCategories();
  const { data: suppliersData } = useSuppliers();
  const { data, loading, error, refresh } = useProducts({
    categoryId: categoryId || undefined,
    take: 200,
  });

  const categories = useMemo(
    () => categoriesData?.categories ?? [],
    [categoriesData],
  );
  const suppliers = useMemo(
    () => suppliersData?.suppliers ?? [],
    [suppliersData],
  );
  const allProducts = useMemo(() => data?.products ?? [], [data]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts || creating) return;
    setCreating(true);
    setCreateError(null);
    setCreateNotice(null);
    try {
      const created = await createProduct({
        name: newName.trim(),
        price: newPrice.trim(),
        costPrice: newCostPrice.trim() || undefined,
        quantity: Math.max(0, Number.parseInt(newQuantity || "0", 10) || 0),
        categoryId: newCategoryId || null,
        supplierId: newSupplierId || null,
        sourceBarcode: newBarcode.trim() || undefined,
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewPrice("");
      setNewCostPrice("");
      setNewQuantity("0");
      setNewCategoryId("");
      setNewSupplierId("");
      setNewBarcode("");
      setNewDescription("");
      setShowCreate(false);
      setCreateNotice(
        `Product "${created.name}" registered (Barcode: ${created.barcode ?? "assigned"}).`,
      );
      refresh();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Unable to register product.",
      );
    } finally {
      setCreating(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (stockFilter === "low" && p.quantity > settings.lowStockThreshold) {
        return false;
      }
      if (stockFilter === "out" && p.quantity > 0) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q) ||
        (p.supplier?.companyName ?? "").toLowerCase().includes(q)
      );
    });
  }, [allProducts, search, stockFilter, settings.lowStockThreshold]);

  if ((loading || catsLoading) && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-[40%]" />
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="h-48">
              <Skeleton className="h-full w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || catsError) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Products
        </h1>
        <EmptyState
          title="Unable to load products"
          description={(error || catsError)?.message}
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
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Products"
        description={`${filteredProducts.length} of ${allProducts.length} active products. Select any item to edit pricing, stock metadata, or carton/pack barcodes.`}
        actions={
          canManageProducts ? (
            <>
              <Link href={portalHref(user?.role, "/barcodes")}>
                <Button size="sm" variant="secondary">
                  Print Labels
                </Button>
              </Link>
              <Button
                size="sm"
                variant={showCreate ? "secondary" : "default"}
                onClick={() => {
                  setCreateError(null);
                  setShowCreate((v) => !v);
                }}
              >
                {showCreate ? "Cancel" : "+ Register Product"}
              </Button>
            </>
          ) : undefined
        }
      />

      {createNotice && (
        <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-2.5 text-sm text-success">
          {createNotice}
        </div>
      )}
      {createError && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {createError}
        </div>
      )}

      {showCreate && canManageProducts && (
        <Card>
          <CardHeader>
            <CardTitle>Register New Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateProduct}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Input
                placeholder="Product name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Selling price (TSh) *"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                required
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Cost price (TSh)"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="Opening stock qty"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
              <Select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                aria-label="Product category"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                value={newSupplierId}
                onChange={(e) => setNewSupplierId(e.target.value)}
                aria-label="Product supplier"
              >
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Scanned barcode (optional)"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
              />
              <Input
                placeholder="Short description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <Button type="submit" isLoading={creating}>
                  Save Product
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          placeholder="Search by name, barcode, category, or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full sm:w-56"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.productCount})
            </option>
          ))}
        </Select>
        <Select
          value={stockFilter}
          onChange={(e) =>
            setStockFilter(e.target.value as "all" | "low" | "out")
          }
          className="w-full sm:w-44"
          aria-label="Filter by stock level"
        >
          <option value="all">All Stock Levels</option>
          <option value="low">
            Low Stock (≤ {settings.lowStockThreshold})
          </option>
          <option value="out">Out of Stock (0)</option>
        </Select>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          title="No products match"
          description={
            canManageProducts
              ? "Try adjusting your search or filter, or register a new product."
              : "Try adjusting your search or category filter."
          }
          action={
            canManageProducts ? (
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
              >
                Register Product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              detailHref={portalHref(user?.role, `/products/${p.id}`)}
              lowThreshold={settings.lowStockThreshold}
              reorderLevel={settings.reorderLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  detailHref,
  lowThreshold,
  reorderLevel,
}: {
  product: Product;
  detailHref: string;
  lowThreshold: number;
  reorderLevel: number;
}) {
  const isOut = product.quantity <= 0;
  const isLow = product.quantity <= lowThreshold;
  const isRunningLow = product.quantity <= reorderLevel;

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary">
            {product.category?.name ?? "Uncategorized"}
          </Badge>
          <Badge
            variant={
              isOut || isLow ? "danger" : isRunningLow ? "warning" : "success"
            }
          >
            {product.quantity} units
          </Badge>
        </div>

        <Link
          href={detailHref}
          className="mt-3 block group"
        >
          <CardTitle className="text-base group-hover:text-primary transition-colors">
            {product.name}
          </CardTitle>
        </Link>

        {product.supplier && (
          <p className="mt-0.5 text-xs text-muted">
            Supplier: {product.supplier.companyName}
          </p>
        )}

        {product.barcode && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded bg-surface-subtle px-2.5 py-1.5">
            <span className="truncate font-mono text-[11px] text-foreground">
              {product.barcode}
            </span>
            <a
              href={`/api/barcodes/label?value=${encodeURIComponent(product.barcode)}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs font-medium text-primary hover:underline"
              title="Print Code 128 label"
            >
              Label
            </a>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <span className="font-display text-lg font-bold text-foreground tabular-nums">
              {formatMoney(product.price)}
            </span>
            {product.costPrice !== undefined && Number(product.costPrice) > 0 && (
              <p className="text-[11px] text-muted tabular-nums">
                Cost: {formatMoney(product.costPrice)}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "text-xs font-medium",
                isOut || isLow
                  ? "text-danger"
                  : isRunningLow
                    ? "text-warning"
                    : "text-success",
              )}
            >
              {isOut
                ? "Out of stock"
                : isLow
                  ? "Low stock"
                  : isRunningLow
                    ? "Reorder soon"
                    : "In stock"}
            </span>
            <Link
              href={detailHref}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Manage →
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
