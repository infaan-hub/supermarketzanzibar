"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboard } from "@/lib/api";
import type { DashboardOverview, DashboardRange } from "@/types/api";

export interface UseDashboardResult {
  data: DashboardOverview | null;
  /** True only while there is no data to show yet. */
  loading: boolean;
  /** True while a newer request is running over existing data. */
  refreshing: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Loads the dashboard overview for a range.
 *
 * - range changes run a fresh request and refresh the header/window;
 * - manual refreshes keep the current figures on screen (silent refresh);
 * - a second request for the same range is ignored until the first settles;
 * - responses from a superseded range are discarded;
 * - errors during a refresh keep the previous figures visible.
 */
export function useDashboard(range: DashboardRange): UseDashboardResult {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const dataRef = useRef<DashboardOverview | null>(null);
  const requestSequence = useRef(0);
  const inFlight = useRef<{ range: DashboardRange; sequence: number } | null>(
    null,
  );

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(
    async () => {
      if (inFlight.current?.range === range) return;

      const sequence = ++requestSequence.current;
      inFlight.current = { range, sequence };

      const hasData = dataRef.current !== null;
      if (!hasData) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const overview = await fetchDashboard(range);
        if (requestSequence.current !== sequence) return;

        setData(overview);
        setError(null);
        setLastUpdated(new Date(overview.generatedAt));
      } catch (caught) {
        if (requestSequence.current !== sequence) return;
        setError(
          caught instanceof Error ? caught : new Error(String(caught)),
        );
      } finally {
        if (requestSequence.current === sequence) {
          setLoading(false);
          setRefreshing(false);
          inFlight.current = null;
        }
      }
    },
    [range],
  );

  useEffect(() => {
    void load();

    return () => {
      requestSequence.current += 1;
      inFlight.current = null;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { data, loading, refreshing, error, lastUpdated, refresh };
}
