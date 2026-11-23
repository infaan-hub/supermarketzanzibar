"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCategories, invalidateApiCache } from "@/lib/api";
import type { CategoriesResponse } from "@/types/api";

export function useCategories(search?: string) {
  const [data, setData] = useState<CategoriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchCategories({ search, take: 100 });
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
  }, [search, tick]);

  const refresh = useCallback(() => {
    invalidateApiCache();
    setTick((n) => n + 1);
  }, []);
  return { data, loading, error, refresh };
}
