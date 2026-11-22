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
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1",
    "disabled:opacity-50 disabled:pointer-events-none",
  );
}

function variantStyles(variant: NonNullable<ButtonProps["variant"]> = "default") {
  return cn(
    {
      default:
        "bg-primary text-white shadow-sm hover:bg-primary-hover",
      secondary:
        "border border-border bg-white text-foreground shadow-sm hover:border-border-hover hover:bg-surface-subtle",
      ghost:
        "bg-transparent text-muted hover:bg-surface-subtle hover:text-foreground",
      danger:
        "bg-danger text-white shadow-sm hover:bg-red-800",
      success:
        "bg-success text-white shadow-sm hover:bg-green-800",
    }[variant],
  );
}

function sizeStyles(size: NonNullable<ButtonProps["size"]> = "md") {
  return cn(
    {
      sm: "h-8 px-2.5 text-xs",
      md: "h-9 px-3.5 text-sm",
      lg: "h-10 px-5 text-sm",
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
