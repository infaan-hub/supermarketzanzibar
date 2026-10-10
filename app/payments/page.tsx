// Payments page.
//
// Process and manage payments (cash, mobile money, card).

"use client";

import { useState, useEffect } from "react";

interface Payment {
  id: string;
  saleId: string;
  amount: number;
  paymentMethod: string;
  status: string;
  referenceNumber: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = async () => {
    const res = await fetch("http://localhost:3000/api/payments");
    if (res.ok) {
      const data = await res.json();
      setPayments(data.payments ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPayments();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Payments</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">Sale</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Method</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Reference</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 font-mono text-sm">{p.id}</td>
                    <td className="px-6 py-4 font-medium">{p.saleId}</td>
                    <td className="px-6 py-4 font-medium">
                      ${p.amount?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                      {p.paymentMethod}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          p.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {p.referenceNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
