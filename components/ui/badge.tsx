"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "danger" | "warning";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ className, variant = "default", ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4",
          {
            default:
              "border-primary/20 bg-primary-soft text-primary",
            secondary:
              "border-border bg-surface-subtle text-foreground",
            success:
              "border-emerald-200 bg-emerald-50 text-emerald-800",
            danger:
              "border-red-200 bg-red-50 text-red-700",
            warning:
              "border-amber-200 bg-amber-50 text-amber-800",
          }[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
