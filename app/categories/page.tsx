// Categories management page (`/categories`).
//
// Lists categories with product counts, search, and Manager/Admin CRUD controls.

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/components/auth/auth-provider";
import { isProductRole } from "@/lib/auth/roles";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Category } from "@/types/api";

export default function CategoriesPage() {
  const { user } = useAuth();
  const canManage = isProductRole(user?.role);

  const [search, setSearch] = useState("");
  const { data, loading, error, refresh } = useCategories(
    search.trim() || undefined,
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description);
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !name.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateCategory(editingId, {
          name: name.trim(),
          description: description.trim(),
        });
      } else {
        await createCategory({
          name: name.trim(),
          description: description.trim(),
        });
      }
      resetForm();
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to save category.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!canManage) return;
    if (
      !window.confirm(
        `Delete category "${cat.name}"? Products in this category will become uncategorized.`,
      )
    ) {
      return;
    }
    try {
      await deleteCategory(cat.id);
      if (editingId === cat.id) resetForm();
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to delete category.",
      );
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Categories
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Categories
        </h1>
        <EmptyState
          title="Unable to load categories"
          description={error.message}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const categories = data?.categories ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Categories"
        description="Organize products for POS filtering, storefront browsing, and reporting."
        actions={
          <Input
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72"
          />
        }
      />

      {canManage && (
        <Card>
          <CardContent className="p-5">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted">
                  {editingId ? "Edit Category Name" : "New Category Name"}
                </label>
                <Input
                  placeholder="e.g. Beverages, Fresh Produce, Spices"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="flex-[1.5] space-y-1">
                <label className="text-xs font-medium text-muted">
                  Description (optional)
                </label>
                <Input
                  placeholder="Short description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" isLoading={saving} disabled={!name.trim()}>
                  {editingId ? "Update" : "+ Add Category"}
                </Button>
                {editingId && (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            {formError && (
              <p className="mt-2 text-sm text-danger">{formError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {categories.length === 0 ? (
        <EmptyState
          title="No categories found"
          description="Create a category above to start grouping products."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((c) => (
            <Card key={c.id} className="flex flex-col overflow-hidden">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {c.name}
                  </h3>
                  <Badge variant="secondary">
                    {c.productCount} {c.productCount === 1 ? "item" : "items"}
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  {c.description || "No description"}
                </p>
                <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
                  <span>Added {formatDate(c.createdAt)}</span>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="font-medium text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(c)}
                        className="font-medium text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
