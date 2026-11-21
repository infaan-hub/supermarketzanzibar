"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPayments } from "@/lib/api";
import type { PaymentsResponse } from "@/types/api";

export function usePayments({
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
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchPayments({ search, status, method, page, take });
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
