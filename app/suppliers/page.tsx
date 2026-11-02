// Suppliers page.
//
// Browse supplier (vendor) records, powered by the typed API client.

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSuppliers } from "@/hooks/useSuppliers";
import { formatDate } from "@/lib/format";

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const { data, loading, error } = useSuppliers({ search });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-[40%]" />
        </div>
        <div className="bg-background rounded-lg border border-border shadow-sm h-80">
          <SkeletonText lines={5} className="p-6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Suppliers</h1>
        <EmptyState
          title="Unable to load suppliers"
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

  const suppliers = data?.suppliers ?? [];

  if (suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Suppliers</h1>
            <p className="text-muted">Supplier (vendor) records.</p>
          </div>
          <Input placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-80" />
        </div>
        <EmptyState title="No suppliers" description="No suppliers match your search." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted">Supplier (vendor) records.</p>
        </div>
        <Input placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-80" />
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24%]">Company</TableHead>
              <TableHead className="w-[16%]">Contact</TableHead>
              <TableHead className="w-[16%]">Phone</TableHead>
              <TableHead className="w-[18%]">Email</TableHead>
              <TableHead className="w-[14%]">Joined</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.companyName}</TableCell>
                <TableCell className="text-sm">{s.contactName}</TableCell>
                <TableCell className="text-sm text-muted">{s.phone}</TableCell>
                <TableCell className="text-sm text-muted">{s.email}</TableCell>
                <TableCell className="text-sm text-muted">{formatDate(s.createdAt)}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant={s.is_active ? "success" : "secondary"}>
                    {s.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
