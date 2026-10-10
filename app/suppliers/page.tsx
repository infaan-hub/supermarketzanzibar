// Suppliers page.
//
// List and manage supplier (vendor) records.

"use client";

import { useState, useEffect } from "react";

interface Supplier {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  createdAt: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadSuppliers = async () => {
    const params = new URLSearchParams({ take: "100" });
    if (search) params.set("search", search);
    const res = await fetch(
      "http://localhost:3000/api/suppliers?" + params.toString(),
    );
    if (res.ok) {
      const data = await res.json();
      setSuppliers(data.suppliers ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="px-6 py-3">Company</th>
              <th className="px-6 py-3">Contact</th>
              <th className="px-6 py-3">Phone</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Joined</th>
              <th className="px-6 py-3">Status</th>
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
              : suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 font-medium">{s.companyName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {s.contactName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {s.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {s.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          s.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
