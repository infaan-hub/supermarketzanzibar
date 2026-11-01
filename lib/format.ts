// Formatting helpers used by the frontend. Keeps currency and date rendering
// consistent across pages without pulling in a heavy date library.

export function formatMoney(value: number | string | null | undefined): string {
  const num =
    value === null || value === undefined ? 0 : typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "0.00";
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function statusLabel(status: string): string {
  return String(status)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
