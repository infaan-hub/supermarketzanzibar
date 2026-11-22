"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { portalHref } from "@/lib/auth/roles";
import { ArrowRightIcon } from "./icons";

export function Panel({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-white/95 shadow-card backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
  titleId,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border/70 bg-surface-subtle/50 px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2
          id={titleId}
          className="font-display text-[15px] font-semibold tracking-tight text-foreground sm:text-base"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </div>
  );
}

export function PanelLink({
  href,
  children = "View all",
}: {
  href: string;
  children?: ReactNode;
}) {
  const { user } = useAuth();
  return (
    <Link
      href={portalHref(user?.role, href)}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 hover:text-teal-900"
    >
      {children}
      <ArrowRightIcon className="h-3.5 w-3.5" />
    </Link>
  );
}

export function PanelEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
