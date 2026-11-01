"use client";

import { useEffect, useState } from "react";
import { fetchSuppliers } from "@/lib/api";
import type { SuppliersResponse } from "@/types/api";

export function useSuppliers({
  search,
  page = 1,
  take = 100,
}: {
  search?: string;
  page?: number;
  take?: number;
}) {
  const [data, setData] = useState<SuppliersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchSuppliers({ search, page, take });
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
  }, [search, page, take]);

  return { data, loading, error };
}
