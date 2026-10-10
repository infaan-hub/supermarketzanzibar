// Scheduled access-window enforcement, ported from the Django CustomUser model.
//
// Supplier and driver accounts require an active access window
// (access_window_start <= now < access_window_end) to log in and to use their
// role-scoped endpoints. Admin and customer accounts are not gated.

const SCHEDULED_ACCESS_ROLES = new Set(["supplier", "driver"]);

export interface ScheduleUser {
  role: string;
  accessWindowStart: Date | null;
  accessWindowEnd: Date | null;
}

export function requiresScheduledAccess(user: ScheduleUser | null): boolean {
  return Boolean(user && SCHEDULED_ACCESS_ROLES.has(user.role));
}

export type ScheduleStatus =
  | "not_required"
  | "not_scheduled"
  | "upcoming"
  | "active"
  | "expired";

export function scheduleStatus(
  user: ScheduleUser | null,
  at: Date = new Date(),
): ScheduleStatus {
  if (!user || !requiresScheduledAccess(user)) return "not_required";
  const start = user.accessWindowStart;
  const end = user.accessWindowEnd;
  if (!start || !end) return "not_scheduled";
  if (at < start) return "upcoming";
  if (at >= end) return "expired";
  return "active";
}

export function hasActiveScheduledAccess(
  user: ScheduleUser | null,
  at: Date = new Date(),
): boolean {
  if (!user || !requiresScheduledAccess(user)) return true;
  const start = user.accessWindowStart;
  const end = user.accessWindowEnd;
  if (!start || !end) return false;
  return start <= at && at < end;
}

function formatLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

export function scheduledAccessDenialDetail(
  user: ScheduleUser,
  at: Date = new Date(),
): string {
  if (!requiresScheduledAccess(user)) {
    return "Access schedule is not required for this account.";
  }
  const start = user.accessWindowStart;
  const end = user.accessWindowEnd;
  if (!start || !end) {
    return (
      `Admin has not scheduled access for this ${user.role} account yet. ` +
      "Please contact admin to set your date and time."
    );
  }
  if (at < start) {
    return (
      `Your ${user.role} access starts at ${formatLocal(start)}. ` +
      "You cannot login before that time."
    );
  }
  if (at >= end) {
    return (
      `Your ${user.role} access ended at ${formatLocal(end)}. ` +
      "Ask admin to schedule a new date and time."
    );
  }
  return "";
}
