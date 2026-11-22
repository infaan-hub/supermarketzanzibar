// Customers directory (`/customers`).
//
// Search customers, view loyalty points & order counts, quick-register new
// customers, and drill down into `/customers/[id]`.

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
import { useCustomers } from "@/hooks/useCustomers";
import { createCustomer } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const { data, loading, error, refresh } = useCustomers({
    search: search.trim() || undefined,
  });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      await createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setShowForm(false);
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to register customer.",
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
          Customers
        </h1>
        <EmptyState
          title="Unable to load customers"
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

  const customers = data?.customers ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Customers"
        description="Loyalty profiles, contact records, and purchase history."
        actions={
          <>
            <Input
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "+ New Customer"}
            </Button>
          </>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Register Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <Input
                placeholder="Full name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                Save Customer
              </Button>
            </form>
            {formError && (
              <p className="mt-2 text-sm text-danger">{formError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {customers.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="No customer records match your search."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Loyalty Points</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Profile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted">{c.phone}</TableCell>
                  <TableCell className="text-sm text-muted">
                    {c.email.endsWith(".local") ? "—" : c.email}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="success">{c.loyaltyPoints} pts</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {c.ordersCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/customers/${c.id}`}
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
