// Customers page.
//
// List and manage customer records.

"use client";

import { useState, useEffect } from "react";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  is_active: boolean;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadCustomers = async () => {
    const params = new URLSearchParams({ take: "100" });
    if (search) params.set("search", search);
    const res = await fetch(
      "http://localhost:3000/api/customers?" + params.toString(),
    );
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.customers ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Phone</th>
              <th className="px-6 py-3">Joined</th>
              <th className="px-6 py-3">Status</th>
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
              : customers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{c.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {c.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {c.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          c.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {c.is_active ? "Active" : "Inactive"}
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
