// Stock page.
//
// List products with current stock levels and inventory alerts.

"use client";

import { useState, useEffect } from "react";

interface StockItem {
  productId: string;
  productName: string;
  category: { id: string; name: string } | null;
  quantity: number;
  lowStockThreshold: number;
  reorderLevel: number;
}

export default function StockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStock = async () => {
    const res = await fetch("http://localhost:3000/api/stock");
    if (res.ok) {
      const data = await res.json();
      setStock(data.stock ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStock();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Inventory Stock Levels</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Quantity</th>
              <th className="px-6 py-3">Low Stock</th>
              <th className="px-6 py-3">Reorder</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : stock.map((s) => {
                  const isLow = s.quantity <= s.lowStockThreshold;
                  const isCritical = s.quantity <= s.reorderLevel;
                  return (
                    <tr key={s.productId}>
                      <td className="px-6 py-4 font-medium">{s.productName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {s.category?.name ?? "—"}
                      </td>
                      <td
                        className={`px-6 py-4 font-medium ${
                          isCritical
                            ? "text-red-600"
                            : isLow
                            ? "text-yellow-600"
                            : "text-green-600"
                        }`}
                      >
                        {s.quantity}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm ${
                          isLow ? "text-yellow-600" : "text-gray-500"
                        }`}
                      >
                        {s.lowStockThreshold}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm ${
                          isCritical ? "text-red-600" : "text-gray-500"
                        }`}
                      >
                        {s.reorderLevel}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
