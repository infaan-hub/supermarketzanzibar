"use client";

import { Button } from "@/components/ui/button";
import { AlertIcon } from "./icons";

export function DashboardError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-hover">
        Overview
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Business overview
      </h1>

      <div
        className="mt-6 flex flex-col items-center rounded-xl border border-border bg-background px-6 py-12 text-center shadow-card"
        role="alert"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger">
          <AlertIcon className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
          We couldn&apos;t load the dashboard
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-muted">{error.message}</p>
        <p className="mt-1 text-xs text-muted">
          Check the connection and try again. Your data has not been changed.
        </p>
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
