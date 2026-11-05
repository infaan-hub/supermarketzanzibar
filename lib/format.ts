// Formatting helpers used by the frontend. Keeps currency and date rendering
// consistent across pages without pulling in a heavy date library.
//
// All business dates are rendered in the store's timezone, not the browser's,
// so a dashboard opened abroad still shows Zanzibar trading days.

import {
  BUSINESS_TIME_ZONE,
  addZonedDays,
  getZonedParts,
} from "@/lib/timezone";

const moneyFormatter = new Intl.NumberFormat("en-TZ", {
  style: "currency",
  currency: "TZS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("en-TZ", {
  style: "currency",
  currency: "TZS",
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const compactNumberFormatter = new Intl.NumberFormat("en-TZ", {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const countFormatter = new Intl.NumberFormat("en-TZ", {
  maximumFractionDigits: 0,
});

const longDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const longDateWithoutWeekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const statusLabels: Record<string, string> = {
  completed: "Completed",
  pending: "Pending",
  pending_payment: "Pending payment",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  confirmed: "Confirmed",
  failed: "Failed",
  refunded: "Refunded",
  paid: "Paid",
  unpaid: "Unpaid",
  partial: "Partially paid",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMoney(value: number | string | null | undefined): string {
  const num =
    value === null || value === undefined
      ? 0
      : typeof value === "string"
        ? Number(value)
        : value;
  if (!Number.isFinite(num)) return "TSh 0";
  return moneyFormatter.format(num);
}

/** Compact currency for large tiles: TSh 1.2M. */
export function formatMoneyCompact(
  value: number | string | null | undefined,
): string {
  const num =
    value === null || value === undefined
      ? 0
      : typeof value === "string"
        ? Number(value)
        : value;
  if (!Number.isFinite(num)) return "TSh 0";
  return compactMoneyFormatter.format(num);
}

/**
 * Exact currency for everyday values, compact only when a full amount would
 * not fit comfortably in a KPI cell. The exact figure remains available in the
 * element's title attribute.
 */
export function formatMoneyAdaptive(
  value: number | string | null | undefined,
): string {
  const num =
    value === null || value === undefined
      ? 0
      : typeof value === "string"
        ? Number(value)
        : value;
  if (!Number.isFinite(num)) return "TSh 0";
  return Math.abs(num) >= 1_000_000
    ? formatMoneyCompact(num)
    : formatMoney(num);
}

export function formatCompactNumber(
  value: number | string | null | undefined,
): string {
  const num =
    value === null || value === undefined
      ? 0
      : typeof value === "string"
        ? Number(value)
        : value;
  if (!Number.isFinite(num)) return "0";
  return compactNumberFormatter.format(num);
}

export function formatCount(
  value: number | string | null | undefined,
): string {
  const num =
    value === null || value === undefined
      ? 0
      : typeof value === "string"
        ? Number(value)
        : value;
  if (!Number.isFinite(num)) return "0";
  return countFormatter.format(num);
}

/** Format a ratio (0.42) as a percentage. */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-TZ", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return longDateWithoutWeekdayFormatter.format(date);
}

export function formatShortDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return shortDateFormatter.format(date);
}

/** Thursday, 5 November 2026 in the store's timezone. */
export function formatBusinessDate(
  value: string | Date | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return longDateFormatter.format(date);
}

/** 23:24 in the store's timezone. */
export function formatBusinessTime(
  value: string | Date | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return timeFormatter.format(date);
}

/** 5 Nov 2026, 23:24 in the store's timezone. */
export function formatBusinessDateTime(
  value: string | Date | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return dateTimeFormatter.format(date);
}

function sameZonedDay(a: Date, b: Date): boolean {
  const left = getZonedParts(a);
  const right = getZonedParts(b);
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
}

/**
 * Human recency: "just now", "4 min ago", "Today, 14:05", "Yesterday, 14:05",
 * then a short date. `now` is injectable for tests.
 */
export function formatRelativeDateTime(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return "—";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 45_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 6 && sameZonedDay(date, now)) {
    return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`;
  }

  if (sameZonedDay(date, now)) {
    return `Today, ${formatBusinessTime(date)}`;
  }

  if (sameZonedDay(date, addZonedDays(now, -1))) {
    return `Yesterday, ${formatBusinessTime(date)}`;
  }

  return formatBusinessDateTime(date);
}

export function statusLabel(status: string): string {
  if (statusLabels[status]) return statusLabels[status];
  return String(status)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "Unknown";
  return paymentMethodLabels[method] ?? statusLabel(method);
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unpaid";
  return statusLabels[status] ?? statusLabel(status);
}

export function stockMovementLabel(type: string): string {
  if (type === "IN") return "Stock in";
  if (type === "OUT") return "Stock out";
  return statusLabel(type);
}

export type StatusTone = "success" | "warning" | "danger" | "secondary";

export function saleStatusTone(status: string): StatusTone {
  switch (status) {
    case "completed":
    case "paid":
    case "confirmed":
      return "success";
    case "pending":
    case "pending_payment":
      return "warning";
    case "cancelled":
    case "canceled":
    case "failed":
    case "refunded":
      return "danger";
    default:
      return "secondary";
  }
}

export function paymentStatusTone(
  status: string | null | undefined,
): StatusTone {
  if (!status) return "secondary";
  return saleStatusTone(status);
}
