// Categories page.
//
// List product categories.

"use client";

import { useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  description: string;
  image_available: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = async () => {
    const res = await fetch("http://localhost:3000/api/products/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Categories</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 animate-pulse rounded" />
            ))
          : categories.map((c) => (
              <div
                key={c.id}
                className="border rounded-lg p-4 hover:shadow-md transition"
              >
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{c.description}</p>
                <span
                  className={`text-xs mt-2 block px-2 py-1 rounded ${
                    c.image_available
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {c.image_available ? "Has image" : "No image"}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
