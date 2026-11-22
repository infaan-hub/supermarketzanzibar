"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { portalHref } from "@/lib/auth/roles";
import {
  formatCount,
  formatMoneyAdaptive,
} from "@/lib/format";
import { ArrowRightIcon, BellIcon, CloseIcon } from "./icons";

export function AlertsMenu({
  lowStock,
  outOfStock,
  pendingCount,
  pendingAmount,
  threshold,
}: {
  lowStock: number;
  outOfStock: number;
  pendingCount: number;
  pendingAmount: number;
  threshold: number;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const count = lowStock + pendingCount;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-border-hover hover:bg-surface-subtle cursor-pointer"
        aria-label={
          count > 0 ? `Notifications, ${count} alerts` : "Notifications"
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon className="h-3.5 w-3.5 text-muted" />
        <span className="hidden min-[380px]:inline">Alerts</span>
        {count > 0 ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-danger px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-white shadow-[var(--shadow-popover)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Notifications
              </h2>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-subtle hover:text-foreground cursor-pointer"
                aria-label="Close notifications"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            {count === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  No open alerts
                </p>
                <p className="mt-1 text-xs text-muted">
                  No low-stock products or pending payments need attention.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {lowStock > 0 ? (
                  <Link
                    href={portalHref(user?.role, "/stock")}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
                    onClick={() => setOpen(false)}
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        Low stock
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                        {formatCount(lowStock)}{" "}
                        {lowStock === 1 ? "product is" : "products are"} at or
                        below {threshold} units
                        {outOfStock > 0
                          ? ` · ${formatCount(outOfStock)} out of stock`
                          : ""}
                        .
                      </span>
                    </span>
                    <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-muted" />
                  </Link>
                ) : null}

                {pendingCount > 0 ? (
                  <Link
                    href={portalHref(user?.role, "/payments")}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
                    onClick={() => setOpen(false)}
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        Pending payments
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                        {formatCount(pendingCount)}{" "}
                        {pendingCount === 1 ? "payment is" : "payments are"}{" "}
                        awaiting confirmation
                        {pendingAmount > 0
                          ? ` · ${formatMoneyAdaptive(pendingAmount)}`
                          : ""}
                        .
                      </span>
                    </span>
                    <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-muted" />
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
