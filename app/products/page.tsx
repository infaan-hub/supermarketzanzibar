// Products page.
//
// List and manage products (read-only for now).

import { useState, useEffect } from "react";

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  category: { id: string; name: string } | null;
  supplier: { id: string; companyName: string } | null;
  image_available: boolean;
  createdAt: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");

  const loadProducts = async () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("categoryId", categoryFilter);
    params.set("take", "100");

    const res = await fetch(
      `http://localhost:3000/api/products?${params.toString()}`,
    );
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, [categoryFilter]);

  const categories = [
    { id: "", name: "All Categories" },
    { id: "1", name: "Dairy & Eggs" },
    { id: "2", name: "Meat & Seafood" },
    { id: "3", name: "Bakery & Snacks" },
    { id: "4", name: "Beverages" },
    { id: "5", name: "Frozen Foods" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex gap-2">
          <input
            placeholder="Filter by category..."
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 animate-pulse rounded" />
            ))
          : products.map((p) => (
              <div
                key={p.id}
                className="border rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      p.image_available
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.image_available ? "🖼️" : "No Image"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {p.category?.name ?? "Uncategorized"}
                </p>
                {p.supplier && (
                  <p className="text-xs text-gray-400 mt-1">{p.supplier.companyName}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold">
                    ${p.price.toFixed(2)}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      p.quantity < 10
                        ? "text-red-600"
                        : p.quantity < 20
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {p.quantity} units
                  </span>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
