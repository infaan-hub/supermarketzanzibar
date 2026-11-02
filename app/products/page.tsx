// Products page.
//
// Browse the product catalogue with category filtering, powered by the typed
// API client and composable UI primitives.

"use client";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/api";

export default function ProductsPage() {
  const { data: categoriesData, loading: catsLoading, error: catsError } =
    useCategories();
  const { data, loading, error } = useProducts({});

  if (loading || catsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-[40%]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Products</h1>
        <EmptyState
          title="Unable to load products"
          description={(error || catsError)?.message}
          action={
            <button onClick={() => window.location.reload()} className="btn-try">
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const products = data?.products ?? [];
  const categories = categoriesData?.categories ?? [];

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Products</h1>
        <EmptyState
          title="No products"
          description="The catalogue is empty. Add products to get started."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted">Browse and manage the product catalogue.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select
            value=""
            onChange={() => {}}
            className="w-64 sm:w-80"
          >
            <option>All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Search products…" className="w-64 sm:w-80" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const isLow = product.quantity < 10;
  const isRunningLow = product.quantity < 20;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
          </div>
          <Badge variant={isLow ? "danger" : isRunningLow ? "warning" : "success"}>
            {product.quantity} units
          </Badge>
        </div>
        <CardTitle className="text-base">{product.name}</CardTitle>
        {product.category && (
          <p className="text-xs text-muted">{product.category.name}</p>
        )}
        {product.supplier && (
          <p className="text-xs text-muted">{product.supplier.companyName}</p>
        )}
        {product.barcode && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="break-all font-mono text-[11px] text-muted">
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
        <div className="mt-4 flex items-end justify-between gap-2">
          <span className="font-display font-bold text-lg text-foreground">
            {formatMoney(product.price)}
          </span>
          <span className={cn(
            "text-sm font-medium",
            isLow ? "text-danger" : isRunningLow ? "text-warning" : "text-success",
          )}>
            {isLow ? "Low stock" : isRunningLow ? "Running low" : "In stock"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
