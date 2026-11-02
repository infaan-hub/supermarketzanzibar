// Customers page.
//
// Browse and search customer records, powered by the typed API client.

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomers } from "@/hooks/useCustomers";
import { formatDate } from "@/lib/format";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const { data, loading, error } = useCustomers({ search });

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
        <h1 className="font-display text-2xl font-bold text-foreground">Customers</h1>
        <EmptyState
          title="Unable to load customers"
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

  const customers = data?.customers ?? [];

  if (customers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-muted">Customer records for look-up and order history.</p>
          </div>
          <Input
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80"
          />
        </div>
        <EmptyState title="No customers" description="No customer records match your search." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted">Customer records for look-up and order history.</p>
        </div>
        <Input
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80"
        />
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">Name</TableHead>
              <TableHead className="w-[25%]">Email</TableHead>
              <TableHead className="w-[15%]">Phone</TableHead>
              <TableHead className="w-[15%]">Joined</TableHead>
              <TableHead className="w-[20%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted">{c.email}</TableCell>
                <TableCell className="text-sm text-muted">{c.phone}</TableCell>
                <TableCell className="text-sm text-muted">{formatDate(c.createdAt)}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant={c.is_active ? "success" : "secondary"}>
                    {c.is_active ? "Active" : "Inactive"}
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
