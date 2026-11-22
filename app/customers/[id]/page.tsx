// Customer profile, loyalty balance & purchase history (`/customers/[id]`).

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
import { fetchCustomerDetail, updateCustomer } from "@/lib/api";
import {
  formatBusinessDateTime,
  formatDate,
  formatMoney,
  paymentMethodLabel,
  saleStatusTone,
  statusLabel,
} from "@/lib/format";
import type { CustomerDetail } from "@/types/api";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const canEdit = isManagerRole(user?.role);

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState("0");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const detail = await fetchCustomerDetail(id);
      setCustomer(detail);
      setName(detail.name);
      setPhone(detail.phone);
      setEmail(detail.email);
      setAddress(detail.address);
      setLoyaltyPoints(String(detail.loyaltyPoints));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load customer profile.",
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
    if (!customer || !canEdit || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateCustomer(customer.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        loyaltyPoints: Number(loyaltyPoints),
      });
      setCustomer(updated);
      setFeedback("Customer profile updated.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Unable to update customer.",
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

  if (error || !customer) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <h1 className="font-display text-2xl font-bold">Customer #{id}</h1>
        <EmptyState
          title="Customer not found"
          description={error ?? "Unable to load customer."}
          action={
            <Link
              href="/customers"
              className="inline-flex h-10 items-center rounded bg-primary-hover px-4 text-sm font-medium text-white"
            >
              Back to Customers
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="border-b border-border pb-4">
        <Link
          href="/customers"
          className="text-xs font-medium text-muted hover:text-foreground hover:underline"
        >
          ← All customers
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {customer.name}
          </h1>
          <Badge variant="success">{customer.loyaltyPoints} pts</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          Member since {formatDate(customer.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted">Lifetime Spend</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {formatMoney(customer.totalSpent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted">Total Orders</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {customer.ordersCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted">Loyalty Balance</p>
            <p className="mt-1 font-display text-2xl font-bold text-success tabular-nums">
              {customer.loyaltyPoints} pts
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile &amp; Loyalty</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-3">
              {feedback && (
                <div className="rounded-md border border-border bg-surface-subtle p-2.5 text-xs text-foreground">
                  {feedback}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">
                  Loyalty Points
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={loyaltyPoints}
                  onChange={(e) => setLoyaltyPoints(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              {canEdit && (
                <Button type="submit" className="w-full" isLoading={saving}>
                  Save Profile
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Purchase History ({customer.sales.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {customer.sales.length === 0 ? (
              <div className="p-6 text-sm text-muted">
                No purchases linked to this customer yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-semibold">
                        <Link
                          href={`/sales/${s.id}`}
                          className="text-primary hover:underline"
                        >
                          #{s.id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{s.itemsCount}</TableCell>
                      <TableCell className="text-sm text-muted">
                        {paymentMethodLabel(s.paymentMethod)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={saleStatusTone(s.status)}>
                          {statusLabel(s.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatMoney(s.grandTotal)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted">
                        {formatBusinessDateTime(s.createdAt)}
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
  );
}
