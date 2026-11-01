// Categories page.
//
// Browse product categories, powered by the typed API client.

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCategories } from "@/hooks/useCategories";
import { formatDate } from "@/lib/format";

export default function CategoriesPage() {
  const { data, loading, error } = useCategories();

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Categories</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="h-40">
              <Skeleton className="h-full w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Categories</h1>
        <EmptyState
          title="Unable to load categories"
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

  const categories = data?.categories ?? [];

  if (categories.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Categories</h1>
        <EmptyState title="No categories" description="No product categories defined yet." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-muted">Product categories used across the catalogue.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-lg">🏷️</span>
                <Badge variant="secondary">
                  {c.image_available ? "Has image" : "No image"}
                </Badge>
              </div>
              <h3 className="font-display font-semibold text-foreground mt-2">
                {c.name}
              </h3>
              <p className="text-sm text-muted">{c.description}</p>
              <p className="mt-3 text-xs text-muted">
                Created {formatDate(c.createdAt)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
