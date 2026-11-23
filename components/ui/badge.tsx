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
              "border-[#4CAF50]/35 bg-[#4CAF50]/15 text-[#4CAF50]",
            secondary:
              "border-white/10 bg-[#38383f] text-foreground",
            success:
              "border-transparent bg-[#4CAF50] text-white shadow-sm",
            danger:
              "border-transparent bg-[#e53935] text-white shadow-sm",
            warning:
              "border-transparent bg-[#4CAF50] text-white shadow-sm",
          }[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";
