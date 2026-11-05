// Business-timezone conversion helpers.
//
// The database stores timestamps in UTC. Reporting periods ("today", "this
// week") must be evaluated in the store's local timezone instead of the
// server's timezone, otherwise sales after 21:00 local time fall into the next
// UTC day. Tanzania has no daylight saving, but the conversion below remains
// correct for zones that do.

export const BUSINESS_TIME_ZONE = "Africa/Dar_es_Salaam";

export interface ZonedDateTimeParts {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Read a UTC instant's wall-clock parts in `timeZone`. */
export function getZonedParts(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): ZonedParts {
  const values: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour ?? 0),
    minute: Number(values.minute ?? 0),
    second: Number(values.second ?? 0),
  };
}

/** The zone's offset from UTC at a given instant, in milliseconds (east positive). */
function offsetMilliseconds(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert wall-clock parts in `timeZone` to the matching UTC instant. */
export function zonedTimeToUtc(
  parts: ZonedDateTimeParts,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    parts.millisecond ?? 0,
  );

  const firstOffset = offsetMilliseconds(new Date(utcGuess), timeZone);
  let timestamp = utcGuess - firstOffset;
  const secondOffset = offsetMilliseconds(new Date(timestamp), timeZone);
  if (secondOffset !== firstOffset) timestamp = utcGuess - secondOffset;

  return new Date(timestamp);
}

export function startOfZonedDay(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const parts = getZonedParts(date, timeZone);
  return zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day },
    timeZone,
  );
}

/** Add calendar days while keeping the local wall-clock time. */
export function addZonedDays(
  date: Date,
  days: number,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const parts = getZonedParts(date, timeZone);
  return zonedTimeToUtc({ ...parts, day: parts.day + days }, timeZone);
}

/** Monday 00:00 in the store's timezone. */
export function startOfZonedWeek(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const dayStart = startOfZonedDay(date, timeZone);
  const parts = getZonedParts(dayStart, timeZone);
  const weekday = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return addZonedDays(dayStart, -daysSinceMonday, timeZone);
}

export function startOfZonedMonth(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const parts = getZonedParts(date, timeZone);
  return zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: 1 },
    timeZone,
  );
}

export function startOfZonedYear(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const parts = getZonedParts(date, timeZone);
  return zonedTimeToUtc({ year: parts.year, month: 1, day: 1 }, timeZone);
}

export function daysInZonedMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
