import { describe, expect, it } from "vitest";
import {
  addZonedDays,
  getZonedParts,
  startOfZonedDay,
  startOfZonedWeek,
  zonedTimeToUtc,
} from "../lib/timezone";
import {
  buildDashboardBuckets,
  buildDashboardPeriod,
} from "../lib/dashboard-range";
import { metricDelta } from "../lib/dashboard-metrics";

describe("business timezone boundaries", () => {
  it("reads wall-clock parts in Africa/Dar_es_Salaam", () => {
    const parts = getZonedParts(new Date("2026-11-05T20:24:00Z"));
    expect(parts).toMatchObject({
      year: 2026,
      month: 11,
      day: 5,
      hour: 23,
      minute: 24,
      second: 0,
    });
  });

  it("starts the day at 21:00 UTC on the previous UTC day", () => {
    expect(
      startOfZonedDay(new Date("2026-11-05T20:24:00Z")).toISOString(),
    ).toBe("2026-11-04T21:00:00.000Z");
  });

  it("starts the week on Monday 00:00 local time", () => {
    expect(
      startOfZonedWeek(new Date("2026-11-05T20:24:00Z")).toISOString(),
    ).toBe("2026-11-01T21:00:00.000Z");
  });

  it("round-trips wall-clock parts through UTC", () => {
    const instant = zonedTimeToUtc({
      year: 2026,
      month: 11,
      day: 5,
      hour: 23,
      minute: 24,
    });
    expect(instant.toISOString()).toBe("2026-11-05T20:24:00.000Z");
  });

  it("adds calendar days without changing wall-clock time", () => {
    const start = new Date("2026-11-05T20:24:00Z");
    const next = addZonedDays(start, 1);
    expect(getZonedParts(next).hour).toBe(23);
    expect(next.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("dashboard periods", () => {
  it("compares today so far with the same elapsed time yesterday", () => {
    const now = new Date("2026-11-05T20:24:00Z");
    const period = buildDashboardPeriod("today", now);

    expect(period.start.toISOString()).toBe("2026-11-04T21:00:00.000Z");
    expect(period.end).toBe(now);
    expect(period.previousStart.toISOString()).toBe("2026-11-03T21:00:00.000Z");
    expect(period.previousEnd.toISOString()).toBe("2026-11-04T20:24:00.000Z");
  });

  it("only includes elapsed buckets in the chart", () => {
    const now = new Date("2026-11-05T07:00:00Z");
    const period = buildDashboardPeriod("today", now);
    const buckets = buildDashboardBuckets(period);

    expect(buckets).toHaveLength(11);
    expect(buckets[0].label).toBe("00:00");
    expect(buckets[10].label).toBe("10:00");
    expect(buckets[0].start.toISOString()).toBe("2026-11-04T21:00:00.000Z");
  });

  it("builds one bucket per elapsed day in a month", () => {
    const now = new Date("2026-11-15T09:00:00Z");
    const period = buildDashboardPeriod("month", now);
    const buckets = buildDashboardBuckets(period);

    expect(buckets).toHaveLength(15);
    expect(buckets[0].label).toBe("1");
    expect(buckets[14].label).toBe("15");
  });

  it("builds one bucket per elapsed month in a year", () => {
    const now = new Date("2026-11-15T09:00:00Z");
    const period = buildDashboardPeriod("year", now);
    const buckets = buildDashboardBuckets(period);

    expect(buckets).toHaveLength(11);
  });
});

describe("metric deltas", () => {
  it("reports an increase", () => {
    const delta = metricDelta(120, 100);
    expect(delta.direction).toBe("up");
    expect(delta.change).toBe(20);
    expect(delta.changePercent).toBe(20);
  });

  it("reports a decrease", () => {
    const delta = metricDelta(80, 100);
    expect(delta.direction).toBe("down");
    expect(delta.change).toBe(-20);
    expect(delta.changePercent).toBe(-20);
  });

  it("reports no change", () => {
    const delta = metricDelta(100, 100);
    expect(delta.direction).toBe("flat");
    expect(delta.change).toBe(0);
    expect(delta.changePercent).toBe(0);
  });

  it("marks growth from zero as new", () => {
    const delta = metricDelta(4, 0);
    expect(delta.direction).toBe("new");
    expect(delta.changePercent).toBeNull();
    expect(delta.change).toBe(4);
  });

  it("treats zero against zero as flat", () => {
    const delta = metricDelta(0, 0);
    expect(delta.direction).toBe("flat");
  });
});
