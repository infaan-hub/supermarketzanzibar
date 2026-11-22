"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

function baseStyles() {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-tight transition-all duration-150 cursor-pointer",
    "active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
  );
}

function variantStyles(variant: NonNullable<ButtonProps["variant"]> = "default") {
  return cn(
    {
      default:
        "bg-gradient-to-b from-teal-600 to-teal-700 text-white shadow-[0_6px_16px_-4px_rgba(13,148,136,0.42)] hover:from-teal-500 hover:to-teal-700 hover:shadow-[0_10px_20px_-6px_rgba(13,148,136,0.52)]",
      secondary:
        "border border-border bg-white/95 text-foreground shadow-sm hover:border-teal-400/70 hover:bg-surface-subtle hover:text-teal-950",
      ghost:
        "bg-transparent text-muted hover:bg-surface-subtle hover:text-teal-900",
      danger:
        "bg-gradient-to-b from-red-600 to-red-700 text-white shadow-[0_6px_16px_-4px_rgba(220,38,38,0.38)] hover:from-red-500 hover:to-red-700",
      success:
        "bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[0_6px_16px_-4px_rgba(5,150,105,0.38)] hover:from-emerald-500 hover:to-emerald-700",
    }[variant],
  );
}

function sizeStyles(size: NonNullable<ButtonProps["size"]> = "md") {
  return cn(
    {
      sm: "h-8.5 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-6 text-base",
    }[size],
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "default", size = "md", isLoading, children, ...props },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        className={cn(
          baseStyles(),
          variantStyles(variant),
          sizeStyles(size),
          className,
        )}
        disabled={props.disabled || isLoading}
      >
        {isLoading ? (
          <>
            <span
              className="relative flex h-3.5 w-3.5"
              style={{ animation: "spin 1s linear infinite" }}
            >
              <svg
                className="h-full w-full"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-6.219 8.56" />
              </svg>
            </span>
            <span className="sr-only">Loading…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";
