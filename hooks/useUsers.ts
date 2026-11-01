"use client";

import { useEffect, useState } from "react";
import { fetchUsers } from "@/lib/api";
import type { UsersResponse } from "@/types/api";

export function useUsers({
  search,
  role,
  page = 1,
  take = 100,
}: {
  search?: string;
  role?: string;
  page?: number;
  take?: number;
}) {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchUsers({ search, role, page, take });
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
  }, [search, role, page, take]);

  return { data, loading, error };
}
