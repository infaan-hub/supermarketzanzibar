"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchProducts, invalidateApiCache } from "@/lib/api";
import type { ProductsResponse } from "@/types/api";

export function useProducts({
  search,
  categoryId,
  supplierId,
  lowStock,
  includeInactive,
  page = 1,
  take = 100,
}: {
  search?: string;
  categoryId?: string;
  supplierId?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
  page?: number;
  take?: number;
} = {}) {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchProducts({
          search,
          categoryId,
          supplierId,
          lowStock,
          includeInactive,
          page,
          take,
        });
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
  }, [search, categoryId, supplierId, lowStock, includeInactive, page, take, tick]);

  const refresh = useCallback(() => {
    invalidateApiCache();
    setTick((n) => n + 1);
  }, []);
  return { data, loading, error, refresh };
}
