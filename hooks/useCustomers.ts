"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCustomers } from "@/lib/api";
import type { CustomersResponse } from "@/types/api";

export function useCustomers({
  search,
  page = 1,
  take = 100,
}: {
  search?: string;
  page?: number;
  take?: number;
} = {}) {
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchCustomers({ search, page, take });
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
  }, [search, page, take, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { data, loading, error, refresh };
}
