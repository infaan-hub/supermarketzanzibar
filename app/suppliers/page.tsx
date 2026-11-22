// Suppliers directory (`/suppliers`).
//
// Vendor list with supplied product & low-stock counts, creation form for
// manager/admin, and drill-down to `/suppliers/[id]`.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useAuth } from "@/components/auth/auth-provider";
import { isManagerRole } from "@/lib/auth/roles";
import { createSupplier } from "@/lib/api";

export default function SuppliersPage() {
  const { user } = useAuth();
  const canManage = isManagerRole(user?.role);

  const [search, setSearch] = useState("");
  const { data, loading, error, refresh } = useSuppliers({
    search: search.trim() || undefined,
  });

  const [showForm, setShowForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !companyName.trim() || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      await createSupplier({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
      setCompanyName("");
      setContactName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setShowForm(false);
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to create supplier.",
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-[40%]" />
        <div className="h-80 rounded-lg border border-border bg-background p-6">
          <SkeletonText lines={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Suppliers
        </h1>
        <EmptyState
          title="Unable to load suppliers"
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

  const suppliers = data?.suppliers ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Suppliers"
        description="Vendors, supplied catalogues, and low-stock reorder queues."
        actions={
          <>
            <Input
              placeholder="Search suppliers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            {canManage && (
              <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Cancel" : "+ New Supplier"}
              </Button>
            )}
          </>
        }
      />

      {showForm && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <Input
                placeholder="Company name *"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
              <Input
                placeholder="Contact person *"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
              <Input
                placeholder="Phone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="Address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Button type="submit" isLoading={creating}>
                Save Supplier
              </Button>
            </form>
            {formError && (
              <p className="mt-2 text-sm text-danger">{formError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers found"
          description="No vendors match your search."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Needs Reorder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="text-primary hover:underline"
                    >
                      {s.companyName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{s.contactName}</TableCell>
                  <TableCell className="text-sm text-muted">{s.phone}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {s.productsCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={s.lowStockCount > 0 ? "warning" : "success"}
                    >
                      {s.lowStockCount} low
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "success" : "secondary"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
