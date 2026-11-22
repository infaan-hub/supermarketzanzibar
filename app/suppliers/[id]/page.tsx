// Supplier detail & restock queue (`/suppliers/[id]`).

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { isManagerRole } from "@/lib/auth/roles";
import { fetchSupplierDetail, updateSupplier } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { SupplierDetail } from "@/types/api";

export default function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const canEdit = isManagerRole(user?.role);

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const detail = await fetchSupplierDetail(id);
      setSupplier(detail);
      setCompanyName(detail.companyName);
      setContactName(detail.contactName);
      setPhone(detail.phone);
      setEmail(detail.email);
      setAddress(detail.address);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load supplier.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || !canEdit || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateSupplier(supplier.id, {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      });
      setSupplier(updated);
      setFeedback("Supplier details updated.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Unable to update supplier.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <SkeletonText lines={2} className="w-1/3" />
        <div className="h-72 rounded-lg border border-border p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Supplier #{id}</h1>
        <EmptyState
          title="Supplier not found"
          description={error ?? "Unable to load supplier."}
          action={
            <Link
              href="/suppliers"
              className="inline-flex h-10 items-center rounded bg-primary-hover px-4 text-sm font-medium text-white"
            >
              Back to Suppliers
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="page-banner flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <Link
            href="/suppliers"
            className="text-xs font-semibold text-teal-700 hover:underline"
          >
            ← All Suppliers
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {supplier.companyName}
            </h1>
            <Badge
              variant={
                supplier.lowStockProducts.length > 0 ? "warning" : "success"
              }
            >
              {supplier.lowStockProducts.length} low-stock item(s)
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            Contact: {supplier.contactName} · Partner since{" "}
            {formatDate(supplier.createdAt)}
          </p>
        </div>
        <Link href="/goods-received">
          <Button size="sm">Receive Stock (GRN)</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-3">
              {feedback && (
                <div className="rounded-md border border-border bg-surface-subtle p-2.5 text-xs">
                  {feedback}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Company</label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Contact</label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              {canEdit && (
                <Button type="submit" className="w-full" isLoading={saving}>
                  Save Supplier
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {supplier.lowStockProducts.length > 0 && (
            <Card className="border-warning/30">
              <CardHeader>
                <CardTitle className="text-warning">
                  Reorder Queue ({supplier.lowStockProducts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplier.lowStockProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            href={`/products/${p.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {p.name}
                          </Link>
                          <p className="font-mono text-[11px] text-muted">
                            {p.barcode}
                          </p>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatMoney(p.costPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={p.quantity <= 0 ? "danger" : "warning"}>
                            {p.quantity} left
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                Supplied Products ({supplier.products.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {supplier.products.length === 0 ? (
                <div className="p-6 text-sm text-muted">
                  No products assigned to this supplier yet. Assign a supplier
                  from any Product Detail page.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplier.products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            href={`/products/${p.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {p.name}
                          </Link>
                          <p className="font-mono text-[11px] text-muted">
                            {p.barcode}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-muted">
                          {p.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatMoney(p.costPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {formatMoney(p.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              p.quantity <= 0
                                ? "danger"
                                : p.quantity <= 10
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {p.quantity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
