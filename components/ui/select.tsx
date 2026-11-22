"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative block w-full" style={{ minWidth: 0 }}>
        <select
          ref={ref}
          className={cn(
            "flex h-11 w-full min-w-0 appearance-none select-none rounded-xl border border-border bg-white py-2 pl-3.5 pr-9 text-base text-foreground shadow-sm transition-all duration-150 hover:border-border-hover focus-visible:border-teal-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/15 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 sm:h-10 sm:text-sm",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className="h-4 w-4 text-teal-700/70"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    );
  },
);
Select.displayName = "Select";
