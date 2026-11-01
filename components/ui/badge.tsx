"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "danger" | "warning";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ className, variant = "default", ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-display font-semibold transition-colors",
          {
            default:
              "border-transparent bg-primary text-white shadow-[0_0_10px_rgba(31,143,58,0.3)]",
            secondary:
              "border-border bg-background text-muted hover:bg-accent/5",
            success: "border-success/20 bg-success/10 text-success",
            danger: "border-danger/20 bg-danger/10 text-danger",
            warning: "border-warning/20 bg-warning/10 text-warning",
          }[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
