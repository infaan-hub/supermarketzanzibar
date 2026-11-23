// Product detail, edit & pack barcode manager (`/products/[id]`).

"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import { isInventoryRole, isProductRole, portalHref } from "@/lib/auth/roles";
import {
  archiveProduct,
  createProductBarcodeLabel,
  deleteProductBarcodeLabel,
  deleteProductImage,
  fetchProductDetail,
  fetchShelves,
  updateProduct,
  uploadProductImage,
} from "@/lib/api";
import { useCategories } from "@/hooks/useCategories";
import { useSuppliers } from "@/hooks/useSuppliers";
import { formatBusinessDateTime, formatMoney } from "@/lib/format";
import type { ProductDetail, ShelfRecord } from "@/types/api";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = isProductRole(user?.role);
  const canArchive = isProductRole(user?.role);
  const canAdjustStock = isInventoryRole(user?.role);
  const productsHref = portalHref(user?.role, "/products");

  const { data: categoriesData } = useCategories();
  const { data: suppliersData } = useSuppliers();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");

  // Shelf Department, Shelf, Column & Row placement state
  const [shelves, setShelves] = useState<ShelfRecord[]>([]);
  const [placementDepartmentId, setPlacementDepartmentId] = useState("");
  const [placementShelfId, setPlacementShelfId] = useState("");
  const [placementPositionId, setPlacementPositionId] = useState("");
  const [placementRowNumber, setPlacementRowNumber] = useState("");
  const [originalPositionId, setOriginalPositionId] = useState("");
  const [placementDirty, setPlacementDirty] = useState(false);

  // Product photo upload state
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [imageVersion, setImageVersion] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pack barcode form state
  const [newBarcode, setNewBarcode] = useState("");
  const [newUnit, setNewUnit] = useState("carton");
  const [newMultiplier, setNewMultiplier] = useState("12");
  const [addingBarcode, setAddingBarcode] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [detail, shelvesRes] = await Promise.all([
        fetchProductDetail(id),
        fetchShelves().catch(() => ({ shelves: [] as ShelfRecord[] })),
      ]);
      setProduct(detail);
      setShelves(shelvesRes.shelves ?? []);
      setName(detail.name);
      setPrice(String(detail.price));
      setCostPrice(String(detail.costPrice));
      setCategoryId(detail.category?.id ?? "");
      setSupplierId(detail.supplier?.id ?? "");
      setDescription(detail.description ?? "");
      setImageVersion(detail.updatedAt || String(Date.now()));
      setImgFailed(false);

      const primary = detail.shelfPlacements?.[0] ?? null;
      if (primary) {
        setPlacementDepartmentId(primary.departmentId);
        setPlacementShelfId(primary.shelfId);
        setPlacementPositionId(primary.positionId);
        setOriginalPositionId(primary.positionId);
        setPlacementRowNumber(
          primary.filledRows > 0 ? String(primary.filledRows) : "",
        );
      } else {
        setPlacementDepartmentId("");
        setPlacementShelfId("");
        setPlacementPositionId("");
        setOriginalPositionId("");
        setPlacementRowNumber("");
      }
      setPlacementDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load product.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!placementDepartmentId) return [];
    return shelves.filter((s) => s.department.id === placementDepartmentId);
  }, [shelves, placementDepartmentId]);

  const selectedShelf = useMemo(
    () => shelvesInDepartment.find((s) => s.id === placementShelfId) ?? null,
    [shelvesInDepartment, placementShelfId],
  );

  const handleImageUpload = async (file: File) => {
    if (!product || !canEdit || uploadingImage) return;
    setUploadingImage(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await uploadProductImage(product.id, file);
      setImageVersion(res.updatedAt || String(Date.now()));
      setImgFailed(false);
      await load();
      setSaveMessage("Product image uploaded.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to upload product image.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageRemove = async () => {
    if (!product || !canEdit || uploadingImage) return;
    setUploadingImage(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await deleteProductImage(product.id);
      await load();
      setSaveMessage("Product image removed.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to remove product image.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !canEdit || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const parsedRow =
        placementRowNumber && /^[1-4]$/.test(placementRowNumber)
          ? Number.parseInt(placementRowNumber, 10)
          : null;

      await updateProduct(product.id, {
        name: name.trim(),
        price,
        costPrice,
        categoryId: categoryId || null,
        supplierId: supplierId || null,
        description,
        ...(placementDirty
          ? {
              shelfPlacement: {
                shelfId: placementShelfId || null,
                positionId: placementPositionId || null,
                previousPositionId: originalPositionId || null,
                rowNumber: parsedRow,
              },
            }
          : {}),
      });
      await load();
      setSaveMessage("Product information & shelf placement updated.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to save product.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!product || !canArchive) return;
    if (!window.confirm(`Archive "${product.name}"? It will be hidden from POS.`)) {
      return;
    }
    try {
      await archiveProduct(product.id);
      router.push(productsHref);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to archive product.",
      );
    }
  };

  const handleAddBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !canEdit || addingBarcode) return;
    setAddingBarcode(true);
    setBarcodeError(null);
    setBarcodeMsg(null);
    try {
      await createProductBarcodeLabel({
        productId: product.id,
        barcode: newBarcode.trim(),
        unitId: newUnit.trim() || "pack",
        quantityMultiplier: Number(newMultiplier),
      });
      setNewBarcode("");
      setBarcodeMsg("Pack barcode added.");
      await load();
    } catch (err) {
      setBarcodeError(
        err instanceof Error ? err.message : "Unable to add barcode.",
      );
    } finally {
      setAddingBarcode(false);
    }
  };

  const handleDeleteBarcode = async (barcodeId: string) => {
    if (!canEdit) return;
    setBarcodeError(null);
    setBarcodeMsg(null);
    try {
      await deleteProductBarcodeLabel(barcodeId);
      setBarcodeMsg("Barcode removed.");
      await load();
    } catch (err) {
      setBarcodeError(
        err instanceof Error ? err.message : "Unable to remove barcode.",
      );
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6">
        <SkeletonText lines={2} className="w-1/3" />
        <div className="h-80 rounded-lg border border-border p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Product #{id}</h1>
        <EmptyState
          title="Product not found"
          description={error ?? "Unable to load product details."}
          action={
            <Link
              href={productsHref}
              className="inline-flex h-10 items-center rounded bg-primary-hover px-4 text-sm font-medium text-white"
            >
              Back to Products
            </Link>
          }
        />
      </div>
    );
  }

  const unitPrice = Number(product.price);
  const unitCost = Number(product.costPrice);
  const unitProfit = unitPrice - unitCost;
  const marginPct = unitPrice > 0 ? (unitProfit / unitPrice) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={productsHref}
            className="text-xs font-medium text-muted hover:text-foreground hover:underline"
          >
            ← All products
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {product.name}
            </h1>
            <Badge variant={product.isActive ? "success" : "secondary"}>
              {product.isActive ? "Active" : "Archived"}
            </Badge>
            <Badge
              variant={
                product.quantity <= 0
                  ? "danger"
                  : product.quantity <= 10
                    ? "warning"
                    : "success"
              }
            >
              {product.quantity} in stock
            </Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted">
            Barcode: {product.barcode ?? "—"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {product.barcode && (
            <a
              href={`/api/barcodes/label?value=${encodeURIComponent(product.barcode)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="secondary">
                Print Shelf Label
              </Button>
            </a>
          )}
          {canAdjustStock && (
            <Link
              href={portalHref(user?.role, "/stock")}
              className="inline-flex h-10 items-center justify-center rounded bg-primary-hover px-4 text-sm font-medium text-white hover:bg-[#0f5c23]"
            >
              Adjust Stock (IN / OUT)
            </Link>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Selling Price</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">
              {formatMoney(unitPrice)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Cost Price</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">
              {formatMoney(unitCost)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Unit Profit / Margin</p>
            <p className="mt-1 font-display text-xl font-bold text-success tabular-nums">
              {formatMoney(unitProfit)}{" "}
              <span className="text-xs font-medium text-muted">
                ({marginPct.toFixed(1)}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted">Inventory Value (Cost)</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">
              {formatMoney(unitCost * product.quantity)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Product Details Form */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {saveError && (
                <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                  {saveError}
                </div>
              )}
              {saveMessage && (
                <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">
                  {saveMessage}
                </div>
              )}

              {/* Product Photo */}
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                    {product.image_available && !imgFailed ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/products/${product.id}/image?v=${encodeURIComponent(imageVersion)}`}
                        alt={product.name}
                        onError={() => setImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-2 text-center text-[11px] text-muted">
                        No photo
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Product Image
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Displayed on product cards, storefront, and 3D shelf packaging.
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void handleImageUpload(f);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      isLoading={uploadingImage}
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {product.image_available ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {product.image_available && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={uploadingImage}
                        onClick={() => void handleImageRemove()}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Product Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Selling Price (TZS)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Cost Price (TZS)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={!canEdit}
                  >
                    <option value="">Uncategorized</option>
                    {(categoriesData?.categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Supplier</label>
                  <Select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    disabled={!canEdit}
                  >
                    <option value="">No supplier assigned</option>
                    {(suppliersData?.suppliers ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Optional product notes…"
                />
              </div>

              {/* Shelf Placement (Department, Shelf, Column & Row) */}
              <div className="space-y-3 rounded-lg border border-border bg-surface-subtle/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Shelf Placement (Department, Column &amp; Row)
                    </p>
                    <p className="text-xs text-muted">
                      Each column holds one product stacked across 4 vertical rows (Row 1 bottom to Row 4 top).
                    </p>
                  </div>
                  {(product.shelfPlacements?.length ?? 0) > 0 ? (
                    <Badge variant="success">
                      {product.shelfPlacements.length}{" "}
                      {product.shelfPlacements.length === 1
                        ? "Column Placed"
                        : "Columns Placed"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Placed on Shelf</Badge>
                  )}
                </div>

                {/* Current Placed Locations Summary */}
                {(product.shelfPlacements?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    {product.shelfPlacements.map((sp) => (
                      <div
                        key={sp.positionId}
                        className="rounded-md border border-border bg-white p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="default">
                              {sp.departmentName} ({sp.departmentCode})
                            </Badge>
                            <span className="font-semibold text-foreground">
                              Shelf {sp.shelfCode}
                            </span>
                            <span className="text-muted">({sp.shelfName})</span>
                            <span className="text-muted">·</span>
                            <span className="font-semibold text-primary">
                              Column {sp.columnNumber} ({sp.positionCode})
                            </span>
                            <span className="text-muted">·</span>
                            <span className="font-medium text-foreground">
                              {sp.activeRowLabel}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-muted tabular-nums">
                            {sp.quantity}/{sp.maximumCapacity} units
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {sp.rowPlan.map((row) => (
                            <div
                              key={row.rowIndex}
                              className="rounded border border-border bg-surface-subtle px-2 py-1 text-center"
                            >
                              <p className="text-[10px] font-semibold text-foreground">
                                {row.rowLabel}
                              </p>
                              <p className="font-mono text-[10px] text-muted tabular-nums">
                                {row.quantity}/{row.capacity}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Editable Department / Shelf / Column / Row selectors */}
                {shelfDepartments.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted">
                        Shelf Department
                      </label>
                      <Select
                        value={placementDepartmentId}
                        disabled={!canEdit}
                        onChange={(e) => {
                          setPlacementDepartmentId(e.target.value);
                          setPlacementShelfId("");
                          setPlacementPositionId("");
                          setPlacementDirty(true);
                        }}
                        aria-label="Shelf Department"
                      >
                        <option value="">Not assigned to shelf</option>
                        {shelfDepartments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted">
                        Shelf Fixture
                      </label>
                      <Select
                        value={placementShelfId}
                        disabled={!canEdit || !placementDepartmentId}
                        onChange={(e) => {
                          setPlacementShelfId(e.target.value);
                          setPlacementPositionId("");
                          setPlacementDirty(true);
                        }}
                        aria-label="Shelf Fixture"
                      >
                        <option value="">Select shelf…</option>
                        {shelvesInDepartment.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.shelfCode} — {s.shelfName}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted">
                        Column
                      </label>
                      <Select
                        value={placementPositionId}
                        disabled={!canEdit || !placementShelfId}
                        onChange={(e) => {
                          setPlacementPositionId(e.target.value);
                          setPlacementDirty(true);
                        }}
                        aria-label="Shelf Column"
                      >
                        <option value="">Select column…</option>
                        {(selectedShelf?.positions ?? []).map((pos) => {
                          const isSameProduct = pos.product?.id === product.id;
                          const occupiedByOther =
                            Boolean(pos.product) &&
                            !isSameProduct &&
                            pos.quantity > 0;
                          return (
                            <option
                              key={pos.id}
                              value={pos.id}
                              disabled={occupiedByOther}
                            >
                              Col {pos.slotIndex + 1} ({pos.positionCode}) —{" "}
                              {isSameProduct
                                ? `Current (${pos.quantity}/${pos.maximumCapacity})`
                                : occupiedByOther
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
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted">
                        Row (4-Row Column Plan)
                      </label>
                      <Select
                        value={placementRowNumber}
                        disabled={!canEdit || !placementPositionId}
                        onChange={(e) => {
                          setPlacementRowNumber(e.target.value);
                          setPlacementDirty(true);
                        }}
                        aria-label="Shelf Row"
                      >
                        <option value="">Keep current row fill</option>
                        <option value="1">Row 1 (Bottom row)</option>
                        <option value="2">Rows 1–2 (2 rows)</option>
                        <option value="3">Rows 1–3 (3 rows)</option>
                        <option value="4">Rows 1–4 (Full 4-row column)</option>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <Button type="submit" isLoading={saving}>
                    Save Changes
                  </Button>
                  {canArchive && product.isActive && (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => void handleArchive()}
                    >
                      Archive Product
                    </Button>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Pack & Shelf Barcodes */}
        <Card>
          <CardHeader>
            <CardTitle>Code 128 Barcodes &amp; Pack Multipliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {product.barcode && (
              <div className="flex flex-col items-center rounded-lg border border-border bg-surface-subtle p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/barcodes/label?value=${encodeURIComponent(product.barcode)}&format=svg&height=12&scale=2`}
                  alt={`Primary barcode ${product.barcode}`}
                  className="max-h-16 w-auto"
                />
              </div>
            )}

            {barcodeError && (
              <div className="rounded-md border border-danger/20 bg-danger/10 p-2.5 text-sm text-danger">
                {barcodeError}
              </div>
            )}
            {barcodeMsg && (
              <div className="rounded-md border border-success/20 bg-success/10 p-2.5 text-sm text-success">
                {barcodeMsg}
              </div>
            )}

            <div className="divide-y divide-border rounded-lg border border-border">
              {product.barcodes.length === 0 ? (
                <div className="p-3 text-sm text-muted">
                  Primary barcode:{" "}
                  <span className="font-mono">{product.barcode}</span> (1 unit)
                </div>
              ) : (
                product.barcodes.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-mono font-semibold text-foreground">
                        {b.barcode}
                      </p>
                      <p className="text-xs text-muted">
                        {b.unitId || "each"} · ×
                        {Number(b.quantityMultiplier)} base units
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.isPrimary && <Badge variant="success">Primary</Badge>}
                      <a
                        href={`/api/barcodes/label?value=${encodeURIComponent(b.barcode)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Label
                      </a>
                      {canEdit && !b.isPrimary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          onClick={() => void handleDeleteBarcode(b.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {canEdit && (
              <form
                onSubmit={handleAddBarcode}
                className="space-y-3 rounded-lg border border-border bg-surface-subtle/60 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Attach Pack / Carton Barcode
                </p>
                <Input
                  placeholder="Barcode value (e.g. ZN-10001-CTN12)"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Unit (carton, pack)"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                  />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Base units"
                    value={newMultiplier}
                    onChange={(e) => setNewMultiplier(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={addingBarcode}
                  disabled={!newBarcode.trim()}
                >
                  + Attach Pack Label
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Stock History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Stock Movements</CardTitle>
          <Link
            href={`/stock/movements?productId=${product.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Full audit log →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {product.recentMovements.length === 0 ? (
            <div className="p-6 text-sm text-muted">
              No stock movements recorded yet for this product.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.recentMovements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge
                        variant={m.movementType === "IN" ? "success" : "warning"}
                      >
                        {m.movementType === "IN" ? "Stock IN" : "Stock OUT"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {m.movementType === "IN" ? "+" : "−"}
                      {m.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-muted">
                      {m.saleId ? (
                        <Link
                          href={`/sales/${m.saleId}`}
                          className="text-primary hover:underline"
                        >
                          Sale #{m.saleId}
                        </Link>
                      ) : (
                        "Inventory adjustment"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted">
                      {formatBusinessDateTime(m.date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
