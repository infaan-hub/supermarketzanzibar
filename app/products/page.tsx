// Products catalogue page (`/products`).
//
// Live search, category & low-stock filtering, margin visibility, label
// printing, and drill-down into `/products/[id]` for editing & pack barcodes.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

export default function ProductsPage() {
  const { settings } = useStoreSettings();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");

  const {
    data: categoriesData,
    loading: catsLoading,
    error: catsError,
  } = useCategories();
  const { data, loading, error, refresh } = useProducts({
    categoryId: categoryId || undefined,
    take: 200,
  });

  const categories = useMemo(
    () => categoriesData?.categories ?? [],
    [categoriesData],
  );
  const allProducts = useMemo(() => data?.products ?? [], [data]);

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
          <>
            <Link href="/barcodes">
              <Button size="sm" variant="secondary">
                Print Labels
              </Button>
            </Link>
            <Link href="/stock">
              <Button size="sm">+ Register Product</Button>
            </Link>
          </>
        }
      />

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
          description="Try adjusting your search or filter, or register a new product from Stock & Counting."
          action={
            <Link
              href="/stock"
              className="inline-flex h-10 items-center rounded bg-primary-hover px-4 text-sm font-medium text-white"
            >
              Register Product
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
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
  lowThreshold,
  reorderLevel,
}: {
  product: Product;
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
          href={`/products/${product.id}`}
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
              href={`/products/${product.id}`}
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
