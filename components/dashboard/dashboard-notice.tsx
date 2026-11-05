"use client";

import { AlertIcon } from "./icons";

export function DashboardNotice({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Couldn&apos;t refresh the dashboard
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {error.message} Showing the last loaded figures.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-warning/60 hover:bg-surface-subtle"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}
