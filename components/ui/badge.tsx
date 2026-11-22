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
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-display text-[11px] font-semibold tracking-tight transition-colors",
          {
            default:
              "border-teal-600/20 bg-teal-600 text-white shadow-[0_2px_8px_rgba(13,148,136,0.28)]",
            secondary:
              "border-border bg-surface-subtle text-teal-900",
            success:
              "border-emerald-600/20 bg-emerald-50 text-emerald-800",
            danger:
              "border-red-600/20 bg-red-50 text-red-700",
            warning:
              "border-amber-500/25 bg-amber-50 text-amber-800",
          }[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
