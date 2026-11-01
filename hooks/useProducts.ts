"use client";

import { useEffect, useState } from "react";
import { fetchProducts } from "@/lib/api";
import type { ProductsResponse } from "@/types/api";

export function useProducts({
  categoryId,
  page = 1,
  take = 100,
}: {
  categoryId?: string;
  page?: number;
  take?: number;
}) {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchProducts({ categoryId, page, take });
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, page, take]);

  return { data, loading, error };
}
