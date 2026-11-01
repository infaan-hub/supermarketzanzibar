"use client";

import { useEffect, useState } from "react";
import { fetchSales } from "@/lib/api";
import type { SalesResponse } from "@/types/api";

export function useSales({
  status,
  page = 1,
  take = 50,
}: {
  status?: string;
  page?: number;
  take?: number;
}) {
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchSales({ status, page, take });
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
  }, [status, page, take]);

  return { data, loading, error };
}
