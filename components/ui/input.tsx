"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-xl border border-border bg-white px-3.5 py-2 text-base text-foreground shadow-sm transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/75 hover:border-border-hover focus-visible:border-teal-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/15 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 sm:h-10 sm:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
