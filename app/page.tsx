// Dashboard page.

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboard } from "@/hooks/useDashboard";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { data, loading, error } = useDashboard();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-[60%] md:w-[40%]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-32"><Skeleton className="h-full w-full" /></Card>
          ))}
        </div>
        <div className="bg-background rounded-lg border border-border shadow-sm h-80">
          <SkeletonText lines={4} className="p-6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <EmptyState
          title="Unable to load dashboard"
          description={error.message}
          action={
            <button onClick={() => window.location.reload()} className="btn-try">Try again</button>
          }
        />
      </div>
    );
  }

  const stats = data?.stats;
  const recent = data?.recentSales ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted">Overview of today's trading and inventory.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Sales Today" value={formatMoney(stats?.totalSalesToday ?? 0)} change="+12% vs yesterday" changeVariant="success" icon="💰" />
        <StatCard title="Total Sales This Week" value={formatMoney(stats?.totalSalesWeek ?? 0)} icon="📅" />
        <StatCard title="Total Sales This Month" value={formatMoney(stats?.totalSalesMonth ?? 0)} icon="🗓️" />
        <StatCard title="Low Stock Items" value={String(stats?.lowStockCount ?? 0)} change={stats?.lowStockCount ? "needs attention" : "all clear"} changeVariant={stats?.lowStockCount ? "danger" : "success"} icon="📦" />
        <StatCard title="Pending Payments" value={String(stats?.pendingPayments ?? 0)} change="awaiting confirmation" changeVariant="warning" icon="💳" />
        <StatCard title="Total Products" value={String(stats?.totalProducts ?? 0)} icon="🏪" />
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Recent Sales</CardTitle>
            <a href="/sales" className="text-sm text-primary hover:underline font-medium">
              View all sales →
            </a>
          </div>
        </CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Order</TableHead>
                <TableHead className="w-[20%]">Customer</TableHead>
                <TableHead className="w-[18%] text-right">Total</TableHead>
                <TableHead className="w-[14%]">Status</TableHead>
                <TableHead className="w-[16%] text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 flex items-center justify-center">
                    <EmptyState title="No recent sales" description="Sales will appear here as orders are processed." />
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-sm font-medium">#{sale.id}</TableCell>
                    <TableCell className="text-sm">{sale.customer?.name ?? "Walk-in"}</TableCell>
                    <TableCell className="text-sm font-medium text-right">{formatMoney(sale.totalAmount)}</TableCell>
                    <TableCell className="text-sm"><Badge variant={sale.status === "completed" ? "success" : sale.status === "pending" ? "warning" : "danger"}>{sale.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted text-right">{formatDate(sale.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, changeVariant, icon }: { title: string; value: string; change?: string; changeVariant?: "success" | "danger" | "warning"; icon: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pb-4 pt-6">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-2"><span className="text-lg">{icon}</span></div>
          <div className="text-right">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">{title}</p>
            <p className="font-display font-bold text-2xl text-foreground">{value}</p>
            {change && <p className={cn("text-xs mt-1 font-medium", changeVariant === "success" ? "text-success" : changeVariant === "danger" ? "text-danger" : "text-warning")}>{change}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
