"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSales } from "@/lib/api";
import type { SalesResponse } from "@/types/api";

export function useSales({
  search,
  status,
  method,
  page = 1,
  take = 50,
}: {
  search?: string;
  status?: string;
  method?: string;
  page?: number;
  take?: number;
} = {}) {
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchSales({ search, status, method, page, take });
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
  }, [search, status, method, page, take, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { data, loading, error, refresh };
}
