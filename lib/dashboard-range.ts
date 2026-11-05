// Dashboard reporting periods and chart buckets.
//
// Periods are calendar-based in the store's timezone. The comparison window
// covers the same elapsed part of the previous period (for example, today so
// far versus the same hours yesterday), so a partial day is never compared
// with a complete one.

import type { DashboardRange } from "@/types/api";
import {
  BUSINESS_TIME_ZONE,
  addZonedDays,
  daysInZonedMonth,
  getZonedParts,
  startOfZonedDay,
  startOfZonedMonth,
  startOfZonedWeek,
  startOfZonedYear,
  zonedTimeToUtc,
} from "@/lib/timezone";

export const DASHBOARD_RANGE_OPTIONS: ReadonlyArray<{
  key: DashboardRange;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export function isDashboardRange(value: unknown): value is DashboardRange {
  return (
    value === "today" ||
    value === "week" ||
    value === "month" ||
    value === "year"
  );
}

export interface DashboardPeriod {
  key: DashboardRange;
  label: string;
  contextLabel: string;
  comparisonLabel: string;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  granularity: "hour" | "day" | "month";
}

export interface DashboardBucket {
  start: Date;
  label: string;
  fullLabel: string;
}

const shortWeekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "short",
});

const longDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  month: "short",
});

const longMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  month: "long",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const monthYearFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  month: "long",
  year: "numeric",
});

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
});

const dayMonthYearFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

function previousRangeStart(
  key: DashboardRange,
  start: Date,
  timeZone: string,
): Date {
  switch (key) {
    case "today":
      return startOfZonedDay(addZonedDays(start, -1, timeZone), timeZone);
    case "week":
      return addZonedDays(start, -7, timeZone);
    case "month":
      return startOfZonedMonth(addZonedDays(start, -1, timeZone), timeZone);
    case "year":
      return startOfZonedYear(addZonedDays(start, -1, timeZone), timeZone);
  }
}

export function buildDashboardPeriod(
  key: DashboardRange,
  now: Date = new Date(),
  timeZone = BUSINESS_TIME_ZONE,
): DashboardPeriod {
  let start: Date;
  let label: string;
  let contextLabel: string;
  let comparisonLabel: string;
  let granularity: DashboardPeriod["granularity"];

  switch (key) {
    case "today":
      start = startOfZonedDay(now, timeZone);
      label = "Today";
      contextLabel = fullDateFormatter.format(start);
      comparisonLabel = "vs same time yesterday";
      granularity = "hour";
      break;
    case "week": {
      start = startOfZonedWeek(now, timeZone);
      const weekEnd = addZonedDays(start, 6, timeZone);
      label = "This week";
      contextLabel = `${dayMonthFormatter.format(start)} – ${dayMonthYearFormatter.format(weekEnd)}`;
      comparisonLabel = "vs same time last week";
      granularity = "day";
      break;
    }
    case "month":
      start = startOfZonedMonth(now, timeZone);
      label = "This month";
      contextLabel = monthYearFormatter.format(start);
      comparisonLabel = "vs same period last month";
      granularity = "day";
      break;
    case "year":
      start = startOfZonedYear(now, timeZone);
      label = "This year";
      contextLabel = String(getZonedParts(start, timeZone).year);
      comparisonLabel = "vs same period last year";
      granularity = "month";
      break;
  }

  const previousStart = previousRangeStart(key, start, timeZone);
  const elapsed = Math.max(0, now.getTime() - start.getTime());
  const previousEnd = new Date(
    Math.min(previousStart.getTime() + elapsed, start.getTime()),
  );

  return {
    key,
    label,
    contextLabel,
    comparisonLabel,
    start,
    end: now,
    previousStart,
    previousEnd,
    granularity,
  };
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Buckets from the start of the period through the current bucket. Future
 * buckets are omitted so the chart never pretends a future hour/day has zero
 * sales.
 */
export function buildDashboardBuckets(
  period: DashboardPeriod,
  timeZone = BUSINESS_TIME_ZONE,
): DashboardBucket[] {
  const buckets: DashboardBucket[] = [];
  const parts = getZonedParts(period.start, timeZone);

  if (period.granularity === "hour") {
    for (let hour = 0; hour < 24; hour += 1) {
      const start = zonedTimeToUtc(
        {
          year: parts.year,
          month: parts.month,
          day: parts.day,
          hour,
        },
        timeZone,
      );
      if (start.getTime() > period.end.getTime()) break;

      const nextHour = hour === 23 ? 0 : hour + 1;
      buckets.push({
        start,
        label: hourLabel(hour),
        fullLabel: `${longDateFormatter.format(start)} · ${hourLabel(hour)}–${hourLabel(nextHour)}`,
      });
    }
    return buckets;
  }

  if (period.granularity === "day" && period.key === "week") {
    for (let index = 0; index < 7; index += 1) {
      const start = addZonedDays(period.start, index, timeZone);
      if (start.getTime() > period.end.getTime()) break;
      buckets.push({
        start,
        label: shortWeekdayFormatter.format(start),
        fullLabel: longDateFormatter.format(start),
      });
    }
    return buckets;
  }

  if (period.granularity === "day") {
    const days = daysInZonedMonth(parts.year, parts.month);
    for (let day = 1; day <= days; day += 1) {
      const start = zonedTimeToUtc(
        { year: parts.year, month: parts.month, day },
        timeZone,
      );
      if (start.getTime() > period.end.getTime()) break;
      buckets.push({
        start,
        label: String(day),
        fullLabel: longDateFormatter.format(start),
      });
    }
    return buckets;
  }

  for (let month = 1; month <= 12; month += 1) {
    const start = zonedTimeToUtc(
      { year: parts.year, month, day: 1 },
      timeZone,
    );
    if (start.getTime() > period.end.getTime()) break;
    buckets.push({
      start,
      label: shortMonthFormatter.format(start),
      fullLabel: `${longMonthFormatter.format(start)} ${parts.year}`,
    });
  }

  return buckets;
}
