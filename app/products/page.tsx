// Products catalogue page (`/products`, `/market/products`, `/admin/products`).
//
// Live search, category & low-stock filtering, inline product registration with
// photo upload and shelf department/column/row assignment, card-level photo
// preview & quick upload, and drill-down into product detail.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  PRODUCT_ASSET_GROUPS,
  getAssetEntry,
  resolveProductAsset,
} from "@/lib/digital-twin/asset-manifest";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product, ShelfRecord } from "@/types/api";

const Product3DPreview = dynamic(
  () =>
    import("@/components/digital-twin/products/Product3DPreview").then(
      (m) => m.Product3DPreview,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-border bg-surface-subtle text-xs text-muted">
        Loading interactive 3D product preview…
      </div>
    ),
  },
);

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
  const [newAssetKey, setNewAssetKey] = useState("");
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

  const selectedNewCategoryName = useMemo(
    () => categories.find((c) => c.id === newCategoryId)?.name ?? null,
    [categories, newCategoryId],
  );

  const autoDetectedNewShape = useMemo(
    () =>
      resolveProductAsset(newName || "Product", selectedNewCategoryName),
    [newName, selectedNewCategoryName],
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
        assetKey: newAssetKey || null,
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
      setNewAssetKey("");
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
            <CardTitle>Register New Product (With Live 3D Shape Preview)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Left: Product Fields, 3D Product Type Selector, Image Picker & Shelf Placement */}
                <div className="space-y-4 lg:col-span-7">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

                  {/* Product Type / 3D Shelf Shape Selector */}
                  <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary-soft/30 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-foreground">
                        Product Type / 3D Shelf Shape
                      </label>
                      <span className="text-[11px] text-primary">
                        Every product type has its own real 3D shape on shelf
                      </span>
                    </div>
                    <Select
                      value={newAssetKey}
                      onChange={(e) => setNewAssetKey(e.target.value)}
                      aria-label="Product Type 3D Shelf Shape"
                    >
                      <option value="">
                        Auto-detect from name &amp; category (Currently:{" "}
                        {autoDetectedNewShape.name})
                      </option>
                      {PRODUCT_ASSET_GROUPS.map((group) => (
                        <optgroup
                          key={group.departmentCode}
                          label={`${group.departmentLabel} (${group.departmentCode})`}
                        >
                          {group.assets.map((asset) => (
                            <option key={asset.key} value={asset.key}>
                              {asset.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    <p className="text-[11px] text-muted">
                      Choose the exact physical shape (bottle, can, fruit basket, banana bunch, bread loaf, cake dome, butcher meat tray, detergent jug, spray cleaner, kettle, egg carton, etc.) and inspect it live on the right before uploading.
                    </p>
                  </div>

                  {/* Product Image Picker (Stages Locally for Live 3D Preview Before Upload) */}
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                        {newImagePreview ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={newImagePreview}
                            alt="New product preview"
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <PhotoPlaceholderIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          Product Image (previewed live on 3D shape before upload)
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {newImageFile
                            ? `${newImageFile.name} (${Math.round(newImageFile.size / 1024)} KB) — ready to upload`
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
                </div>

                {/* Right: Live 360° Interactive 3D Product Preview Before Upload */}
                <div className="lg:col-span-5">
                  <Product3DPreview
                    name={newName}
                    categoryName={selectedNewCategoryName}
                    price={newPrice}
                    barcode={newBarcode}
                    description={newDescription}
                    imageUrl={newImagePreview}
                    assetKey={newAssetKey || null}
                    pendingUploadLabel={
                      newImageFile ? "Preview Before Upload" : null
                    }
                    heightClassName="h-[320px] lg:h-[340px]"
                  />
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
                  {newImageFile
                    ? "Upload Photo & Save Product"
                    : "Save Product"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Top Pill Search Bar & Filters matching Marketplace reference */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 items-center">
          <Input
            placeholder="Search Marketplace products, categories, barcode, or shelf…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-full border-white/10 bg-[#141416] pr-12 pl-5 text-sm text-white placeholder:text-[#71717a]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#48484f] text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
        </div>
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-11 w-full sm:w-56"
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
          className="h-11 w-full sm:w-44"
          aria-label="Filter by stock level"
        >
          <option value="all">All Stock Levels</option>
          <option value="low">
            Low Stock (≤ {settings.lowStockThreshold})
          </option>
          <option value="out">Out of Stock (0)</option>
        </Select>
      </div>

      {/* Circular Categories Medallions Section matching reference */}
      {categories.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Categories
              </h2>
              <p className="text-xs text-muted">
                <span className="font-semibold text-[#4CAF50]">
                  {categories.length}+ New
                </span>{" "}
                Categories available in Marketplace
              </p>
            </div>
            <Link
              href={portalHref(user?.role, "/categories")}
              className="group inline-flex items-center gap-2 text-xs font-semibold text-white transition-colors hover:text-[#4CAF50]"
            >
              <span>View More</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#48484f] text-white transition-colors group-hover:bg-[#4CAF50]">
                ›
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3.5 overflow-x-auto pb-1.5">
            <button
              type="button"
              onClick={() => setCategoryId("")}
              className="group flex shrink-0 flex-col items-center gap-1.5 cursor-pointer"
            >
              <span
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-lg transition-all",
                  categoryId === ""
                    ? "ring-2 ring-[#4CAF50] text-[#4CAF50] scale-105"
                    : "opacity-85 hover:opacity-100 hover:scale-105",
                )}
              >
                <SupermarketGridIcon className="h-6 w-6" />
              </span>
              <span
                className={cn(
                  "max-w-[76px] truncate text-[11px] font-semibold",
                  categoryId === "" ? "text-[#4CAF50]" : "text-[#d4d4d8]",
                )}
              >
                All Items
              </span>
            </button>
            {categories.map((cat, idx) => {
              const active = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(active ? "" : cat.id)}
                  className="group flex shrink-0 flex-col items-center gap-1.5 cursor-pointer"
                >
                  <span
                    className={cn(
                      "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-lg transition-all",
                      active
                        ? "ring-2 ring-[#4CAF50] text-[#4CAF50] scale-105"
                        : "opacity-85 hover:opacity-100 hover:scale-105",
                    )}
                  >
                    {cat.image_available ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/categories/${cat.id}/image`}
                        alt={cat.name}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <SupermarketCategoryIcon index={idx} className="h-6 w-6" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "max-w-[82px] truncate text-[11px] font-semibold",
                      active ? "text-[#4CAF50]" : "text-[#d4d4d8]",
                    )}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Popular Products Section Header */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="font-display text-lg font-bold text-white">
            Popular Products
          </h2>
          <p className="text-xs text-muted">
            <span className="font-semibold text-[#4CAF50]">
              {filteredProducts.length}+ New
            </span>{" "}
            products stocked across Marketplace shelves
          </p>
        </div>
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
        <div className="grid grid-cols-1 gap-x-5 gap-y-14 pt-10 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  const shapeEntry = product.assetKey
    ? getAssetEntry(product.assetKey)
    : resolveProductAsset(product.name, product.category?.name);

  // Deterministic 4.5 - 4.9 star rating matching the reference product card footer
  const rating = (4.5 + ((Number(product.id) || 3) % 5) * 0.1).toFixed(1);

  return (
    <div className="group relative flex flex-col rounded-[28px] border border-white/[0.07] bg-[#2a2a2e] px-5 pt-20 pb-4 text-center shadow-[0_18px_38px_-12px_rgba(0,0,0,0.65)] transition-all duration-200 hover:-translate-y-1 hover:border-white/15">
      {/* Floating Pop-Out Top Product Image matching reference design */}
      <Link
        href={detailHref}
        className="absolute -top-11 left-1/2 flex h-28 w-28 -translate-x-1/2 items-center justify-center"
      >
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/products/${product.id}/image?v=${encodeURIComponent(imageVersion)}`}
            alt={product.name}
            onError={() => setImgFailed(true)}
            className="max-h-28 max-w-28 rounded-2xl object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.68)] transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#38383f] via-[#2e2e34] to-[#222226] text-white shadow-[0_14px_24px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-105">
            <PhotoPlaceholderIcon className="h-7 w-7 text-[#4CAF50]" />
            <span className="mt-0.5 text-[9px] font-semibold text-[#d4d4d8]">
              {product.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </Link>

      {/* Top Left Category Pill & Top Right Quick Photo Upload */}
      <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-1">
        <span className="max-w-[110px] truncate rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-[#d4d4d8]">
          {product.category?.name ?? "General"}
        </span>

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
              className="rounded-full bg-[#38383f] px-2.5 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#4CAF50] disabled:opacity-60 cursor-pointer"
            >
              {uploading ? "…" : showImage ? "Photo" : "+ Photo"}
            </button>
          </>
        )}
      </div>

      {/* Centered Product Title, "Starting From" & Bold White Price */}
      <Link href={detailHref} className="block">
        <h3 className="line-clamp-1 font-display text-base font-bold text-white transition-colors group-hover:text-[#4CAF50]">
          {product.name}
        </h3>
      </Link>

      <p className="mt-1 text-[11px] font-medium text-[#71717a]">
        Starting From
      </p>

      <p className="mt-0.5 font-display text-lg font-extrabold text-white tabular-nums">
        {formatMoney(product.price)}
      </p>

      {/* Compact 3D Shape & Shelf Location Pill */}
      <div className="mt-2.5 space-y-1.5 text-left">
        {shapeEntry && (
          <div className="truncate rounded-full bg-white/[0.04] px-2.5 py-1 text-center text-[10px] text-muted">
            3D: <span className="font-semibold text-[#e4e4e7]">{shapeEntry.name}</span>
          </div>
        )}

        {primaryPlacement && (
          <div className="truncate rounded-full border border-[#4CAF50]/25 bg-[#4CAF50]/10 px-2.5 py-1 text-center text-[10px] text-white">
            <span className="font-semibold text-[#4CAF50]">
              {primaryPlacement.departmentCode}
            </span>{" "}
            · {primaryPlacement.shelfCode} · Col {primaryPlacement.columnNumber} ·{" "}
            {primaryPlacement.activeRowLabel}
            {extraPlacements > 0 ? ` (+${extraPlacements})` : ""}
          </div>
        )}

        {product.barcode && (
          <div className="flex items-center justify-between gap-2 rounded-full bg-[#1c1c1e] px-3 py-1">
            <span className="truncate font-mono text-[10px] text-[#a1a1aa]">
              {product.barcode}
            </span>
            <a
              href={`/api/barcodes/label?value=${encodeURIComponent(product.barcode)}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[10px] font-semibold text-[#4CAF50] hover:underline"
              title="Print Code 128 label"
            >
              Label
            </a>
          </div>
        )}
      </div>

      {/* Bottom Footer Row matching reference: Star Rating on left, Total Sale/Stock on right */}
      <div className="mt-auto flex items-end justify-between border-t border-white/[0.06] pt-3 text-xs">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-1 font-bold text-white">
            <span className="text-sm text-[#4CAF50]">★</span>
            <span>{rating}</span>
          </div>
          <Link
            href={detailHref}
            className="text-[11px] font-semibold text-[#4CAF50] hover:underline"
          >
            Manage →
          </Link>
        </div>

        <div className="text-right leading-tight">
          <span
            className={cn(
              "block font-mono text-xs font-bold tabular-nums",
              isOut || isLow
                ? "text-[#e53935]"
                : isRunningLow
                  ? "text-[#4CAF50]"
                  : "text-[#a1a1aa]",
            )}
          >
            {product.quantity}
          </span>
          <span className="text-[11px] font-bold text-white">Total Stock</span>
        </div>
      </div>
    </div>
  );
}

function SupermarketGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function SupermarketCategoryIcon({ index, className }: { index: number; className?: string }) {
  const variant = index % 6;
  if (variant === 0) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    );
  }
  if (variant === 2) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );
  }
  if (variant === 3) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4v16M20 4v16M4 8h16M4 14h16M4 20h16" />
      </svg>
    );
  }
  if (variant === 4) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5" />
      <path d="M12 22V12" />
    </svg>
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
