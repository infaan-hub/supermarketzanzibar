// Products catalogue page (`/products`, `/market/products`, `/admin/products`).
//
// Live search, category & low-stock filtering, inline product registration with
// photo upload and shelf department/column/row assignment, card-level photo
// preview & quick upload, and drill-down into product detail.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  createProduct,
  fetchShelves,
  uploadProductImage,
} from "@/lib/api";
import { isProductRole, portalHref } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product, ShelfRecord } from "@/types/api";

export default function ProductsPage() {
  const { user } = useAuth();
  const canManageProducts = isProductRole(user?.role);
  const { settings } = useStoreSettings();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");

  // Register Product state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("0");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);

  // Optional shelf placement during registration
  const [shelves, setShelves] = useState<ShelfRecord[]>([]);
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newShelfId, setNewShelfId] = useState("");
  const [newPositionId, setNewPositionId] = useState("");
  const [newRowNumber, setNewRowNumber] = useState("1");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [imageBustByProductId, setImageBustByProductId] = useState<
    Record<string, string>
  >({});

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

  useEffect(() => {
    let cancelled = false;
    fetchShelves()
      .then((res) => {
        if (!cancelled) setShelves(res.shelves ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    };
  }, [newImagePreview]);

  const categories = useMemo(
    () => categoriesData?.categories ?? [],
    [categoriesData],
  );
  const suppliers = useMemo(
    () => suppliersData?.suppliers ?? [],
    [suppliersData],
  );
  const allProducts = useMemo(() => data?.products ?? [], [data]);

  const shelfDepartments = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const shelf of shelves) {
      if (shelf.department && !map.has(shelf.department.id)) {
        map.set(shelf.department.id, shelf.department);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [shelves]);

  const shelvesInDepartment = useMemo(() => {
    if (!newDepartmentId) return [];
    return shelves.filter((s) => s.department.id === newDepartmentId);
  }, [shelves, newDepartmentId]);

  const selectedShelf = useMemo(
    () => shelvesInDepartment.find((s) => s.id === newShelfId) ?? null,
    [shelvesInDepartment, newShelfId],
  );

  const handleSelectNewImage = (file: File | null) => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    if (!file) {
      setNewImageFile(null);
      setNewImagePreview(null);
      return;
    }
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts || creating) return;
    setCreating(true);
    setCreateError(null);
    setCreateNotice(null);
    try {
      const hasShelfPlacement = Boolean(newShelfId && newPositionId);
      const created = await createProduct({
        name: newName.trim(),
        price: newPrice.trim(),
        costPrice: newCostPrice.trim() || undefined,
        quantity: Math.max(0, Number.parseInt(newQuantity || "0", 10) || 0),
        categoryId: newCategoryId || null,
        supplierId: newSupplierId || null,
        sourceBarcode: newBarcode.trim() || undefined,
        description: newDescription.trim() || undefined,
        shelfPlacement: hasShelfPlacement
          ? {
              shelfId: newShelfId,
              positionId: newPositionId,
              rowNumber: Number.parseInt(newRowNumber || "1", 10) || 1,
            }
          : undefined,
      });

      let imageUploaded = false;
      if (newImageFile) {
        try {
          const imgRes = await uploadProductImage(created.id, newImageFile);
          imageUploaded = imgRes.image_available;
          setImageBustByProductId((prev) => ({
            ...prev,
            [created.id]: imgRes.updatedAt || String(Date.now()),
          }));
        } catch (imgErr) {
          setCreateError(
            `Product "${created.name}" was created, but image upload failed: ${
              imgErr instanceof Error ? imgErr.message : "upload error"
            }`,
          );
        }
      }

      setNewName("");
      setNewPrice("");
      setNewCostPrice("");
      setNewQuantity("0");
      setNewCategoryId("");
      setNewSupplierId("");
      setNewBarcode("");
      setNewDescription("");
      handleSelectNewImage(null);
      setNewDepartmentId("");
      setNewShelfId("");
      setNewPositionId("");
      setNewRowNumber("1");
      setShowCreate(false);
      setCreateNotice(
        `Product "${created.name}" registered${imageUploaded ? " with photo" : ""} (Barcode: ${created.barcode ?? "assigned"}).`,
      );
      refresh();
      fetchShelves()
        .then((res) => setShelves(res.shelves ?? []))
        .catch(() => undefined);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Unable to register product.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCardImageUpload = async (product: Product, file: File) => {
    if (!canManageProducts) return;
    setUploadingCardId(product.id);
    setCreateError(null);
    setCreateNotice(null);
    try {
      const res = await uploadProductImage(product.id, file);
      setImageBustByProductId((prev) => ({
        ...prev,
        [product.id]: res.updatedAt || String(Date.now()),
      }));
      setCreateNotice(`Photo updated for "${product.name}".`);
      refresh();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Unable to upload product photo.",
      );
    } finally {
      setUploadingCardId(null);
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
      const placementMatch = (p.shelfPlacements ?? []).some(
        (sp) =>
          sp.departmentName.toLowerCase().includes(q) ||
          sp.departmentCode.toLowerCase().includes(q) ||
          sp.shelfCode.toLowerCase().includes(q) ||
          sp.positionCode.toLowerCase().includes(q),
      );
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q) ||
        (p.supplier?.companyName ?? "").toLowerCase().includes(q) ||
        placementMatch
      );
    });
  }, [allProducts, search, stockFilter, settings.lowStockThreshold]);

  if ((loading || catsLoading) && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-[40%]" />
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="h-72">
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
        description={`${filteredProducts.length} of ${allProducts.length} active products. Upload product photos, manage pricing, or assign shelf department, column, and rows.`}
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
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              </div>

              {/* Product Image Picker */}
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                    {newImagePreview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={newImagePreview}
                        alt="New product preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <PhotoPlaceholderIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      Product Image (shown on product cards &amp; 3D store)
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {newImageFile
                        ? `${newImageFile.name} (${Math.round(newImageFile.size / 1024)} KB)`
                        : "JPG, PNG, WebP, or GIF up to 5 MB."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted">
                    {newImageFile ? "Change Image" : "Add Product Image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) =>
                        handleSelectNewImage(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  {newImageFile && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSelectNewImage(null)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Optional Shelf Department, Shelf, Column & Row Placement */}
              {shelfDepartments.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-surface-subtle/60 p-3.5">
                  <p className="text-xs font-semibold text-foreground">
                    Shelf Placement (optional — Department, Shelf, Column &amp; Row)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Select
                      value={newDepartmentId}
                      onChange={(e) => {
                        setNewDepartmentId(e.target.value);
                        setNewShelfId("");
                        setNewPositionId("");
                      }}
                      aria-label="Shelf department"
                    >
                      <option value="">Select department…</option>
                      {shelfDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={newShelfId}
                      disabled={!newDepartmentId}
                      onChange={(e) => {
                        setNewShelfId(e.target.value);
                        setNewPositionId("");
                      }}
                      aria-label="Shelf fixture"
                    >
                      <option value="">Select shelf…</option>
                      {shelvesInDepartment.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shelfCode} — {s.shelfName}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={newPositionId}
                      disabled={!newShelfId}
                      onChange={(e) => setNewPositionId(e.target.value)}
                      aria-label="Shelf column"
                    >
                      <option value="">Select column…</option>
                      {(selectedShelf?.positions ?? []).map((pos) => {
                        const occupied =
                          Boolean(pos.product) && pos.quantity > 0;
                        return (
                          <option
                            key={pos.id}
                            value={pos.id}
                            disabled={occupied}
                          >
                            Col {pos.slotIndex + 1} ({pos.positionCode}) —{" "}
                            {occupied
                              ? `Occupied: ${pos.product?.name}`
                              : pos.product
                                ? `Empty (${pos.product.name})`
                                : "Available"}
                          </option>
                        );
                      })}
                      {selectedShelf && selectedShelf.positions.length < 12 && (
                        <option value="__NEW_COLUMN__">
                          + Add New Column (Col{" "}
                          {selectedShelf.positions.length + 1})
                        </option>
                      )}
                    </Select>

                    <Select
                      value={newRowNumber}
                      disabled={!newPositionId}
                      onChange={(e) => setNewRowNumber(e.target.value)}
                      aria-label="Shelf rows"
                    >
                      <option value="1">Row 1 (Bottom row)</option>
                      <option value="2">Rows 1–2 (2 rows)</option>
                      <option value="3">Rows 1–3 (3 rows)</option>
                      <option value="4">Rows 1–4 (All 4 rows)</option>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
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
          placeholder="Search by name, barcode, category, supplier, or shelf…"
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
              <Button size="sm" onClick={() => setShowCreate(true)}>
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
              canManage={canManageProducts}
              uploading={uploadingCardId === p.id}
              imageVersion={imageBustByProductId[p.id] ?? p.updatedAt ?? ""}
              onUploadImage={(file) => void handleCardImageUpload(p, file)}
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
  canManage,
  uploading,
  imageVersion,
  onUploadImage,
}: {
  product: Product;
  detailHref: string;
  lowThreshold: number;
  reorderLevel: number;
  canManage: boolean;
  uploading: boolean;
  imageVersion: string;
  onUploadImage: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [imageVersion, product.image_available]);

  const isOut = product.quantity <= 0;
  const isLow = product.quantity <= lowThreshold;
  const isRunningLow = product.quantity <= reorderLevel;
  const showImage = product.image_available && !imgFailed;
  const primaryPlacement = product.shelfPlacements?.[0] ?? null;
  const extraPlacements = Math.max(0, (product.shelfPlacements?.length ?? 0) - 1);

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {/* Expanded Studio Product Image Header */}
      <div className="group/media relative h-56 w-full overflow-hidden border-b border-border bg-gradient-to-b from-white to-slate-50">
        <Link
          href={detailHref}
          className="flex h-full w-full items-center justify-center p-3"
        >
          {showImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/products/${product.id}/image?v=${encodeURIComponent(imageVersion)}`}
              alt={product.name}
              onError={() => setImgFailed(true)}
              className="max-h-full max-w-full rounded object-contain transition-transform duration-300 group-hover/media:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <PhotoPlaceholderIcon className="h-9 w-9 opacity-60" />
              <span className="text-[11px] font-medium">No photo yet</span>
            </div>
          )}
        </Link>

        <div className="pointer-events-none absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm">
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

        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onUploadImage(f);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-white/95 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white disabled:opacity-60"
            >
              {uploading
                ? "Uploading…"
                : showImage
                  ? "Change Photo"
                  : "+ Add Photo"}
            </button>
          </>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        <Link href={detailHref} className="block group">
          <CardTitle className="text-base transition-colors group-hover:text-primary">
            {product.name}
          </CardTitle>
        </Link>

        {product.supplier && (
          <p className="mt-0.5 text-xs text-muted">
            Supplier: {product.supplier.companyName}
          </p>
        )}

        {primaryPlacement && (
          <div className="mt-2 rounded-md border border-primary/15 bg-primary-soft/45 px-2.5 py-1.5 text-[11px] text-foreground">
            <span className="font-semibold text-primary">
              {primaryPlacement.departmentName}
            </span>
            <span className="text-muted">
              {" "}
              · {primaryPlacement.shelfCode} · Col{" "}
              {primaryPlacement.columnNumber} · {primaryPlacement.activeRowLabel}
              {extraPlacements > 0 ? ` (+${extraPlacements})` : ""}
            </span>
          </div>
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
            {product.costPrice !== undefined &&
              Number(product.costPrice) > 0 && (
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

function PhotoPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
