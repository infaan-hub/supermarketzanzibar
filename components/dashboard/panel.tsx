"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { canAccessPath, portalHref } from "@/lib/auth/roles";
import { ArrowRightIcon } from "./icons";

export function Panel({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-white shadow-card",
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
        "flex items-start justify-between gap-3 border-b border-border px-5 py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2
          id={titleId}
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
  if (user && !canAccessPath(user.role, href)) {
    return null;
  }
  return (
    <Link
      href={portalHref(user?.role, href)}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
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
