// Root dashboard page.
//
// Shows key metrics: total sales today, total sales week, low stock count,
// pending payments, and recent orders.

"use client";

import { useState, useEffect } from "react";

interface DashboardStats {
  totalSalesToday: number;
  totalSalesWeek: number;
  totalSalesMonth: number;
  lowStockCount: number;
  pendingPayments: number;
  totalCustomers: number;
  totalProducts: number;
}

interface Sale {
  id: string;
  customer: { name: string } | null;
  totalAmount: number;
  status: string;
  createdAt: string;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("http://localhost:3000/api/dashboard/stats", {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchRecentSales(limit = 5): Promise<Sale[]> {
  const res = await fetch(
    `http://localhost:3000/api/sales?take=${limit}&page=1`,
    { next: { revalidate: 30 } },
  );
  if (!res.ok) throw new Error("Failed to fetch sales");
  const data = await res.json();
  return data.sales ?? [];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, salesData] = await Promise.all([
          fetchDashboardStats(),
          fetchRecentSales(5),
        ]);
        setStats(statsData);
        setSales(salesData);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Sales Today</p>
          <p className="text-2xl font-bold">
            {stats?.totalSalesToday ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Sales (Week)</p>
          <p className="text-2xl font-bold">
            {stats?.totalSalesWeek ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Low Stock Items</p>
          <p className="text-2xl font-bold text-red-600">
            {stats?.lowStockCount ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Pending Payments</p>
          <p className="text-2xl font-bold text-yellow-600">
            {stats?.pendingPayments ?? 0}
          </p>
        </div>
      </div>

      {/* Recent sales */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Recent Sales</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-4 text-sm">{s.id}</td>
                <td className="px-6 py-4 text-sm">{s.customer?.name ?? "—"}</td>
                <td className="px-6 py-4 text-sm font-medium">
                  ${s.totalAmount?.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      s.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : s.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
