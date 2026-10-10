// Sales page.
//
// List sales/orders with status filtering.

"use client";

import { useState, useEffect } from "react";

interface SaleItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

interface Sale {
  id: string;
  customer: { id: string; name: string } | null;
  items: SaleItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const loadSales = async () => {
    const params = new URLSearchParams({ take: "50" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(
      "http://localhost:3000/api/sales?" + params.toString(),
    );
    if (res.ok) {
      const data = await res.json();
      setSales(data.sales ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSales();
  }, [statusFilter]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sales</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition">
            New Sale
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Total</th>
              <th className="px-6 py-3">Payment</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : sales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 font-mono text-sm">{s.id}</td>
                    <td className="px-6 py-4">
                      {s.customer?.name ?? "Walk-in"}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      ${s.grandTotal?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {s.paymentMethod}
                    </td>
                    <td className="px-6 py-4">
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
