// Pure metric comparison helpers for the dashboard.
//
// Kept separate from the database service so the comparison rules can be
// tested without a Prisma connection.

import type { DashboardMetricDelta } from "@/types/api";

export function metricDelta(
  current: number,
  previous: number,
): DashboardMetricDelta {
  const change = current - previous;

  if (change === 0) {
    return {
      current,
      previous,
      change: 0,
      changePercent: 0,
      direction: "flat",
    };
  }

  if (previous === 0) {
    return {
      current,
      previous,
      change,
      changePercent: null,
      direction: "new",
    };
  }

  return {
    current,
    previous,
    change,
    changePercent: (change / previous) * 100,
    direction: change > 0 ? "up" : "down",
  };
}
