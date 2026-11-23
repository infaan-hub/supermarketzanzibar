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
          "inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-[11px] font-semibold leading-4",
          {
            default:
              "border-primary/35 bg-primary-soft text-[#ff7b72]",
            secondary:
              "border-white/10 bg-[#38383f] text-foreground",
            success:
              "border-transparent bg-[#3fb950] text-white shadow-sm",
            danger:
              "border-transparent bg-[#ef4b42] text-white shadow-sm",
            warning:
              "border-transparent bg-[#d99b43] text-white shadow-sm",
          }[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
