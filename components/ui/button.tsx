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
    "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-all duration-150 cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1",
    "disabled:opacity-50 disabled:pointer-events-none",
  );
}

function variantStyles(variant: NonNullable<ButtonProps["variant"]> = "default") {
  return cn(
    {
      default:
        "bg-primary text-white shadow-sm hover:bg-primary-hover",
      secondary:
        "border border-white/10 bg-[#38383f] text-foreground shadow-sm hover:border-white/20 hover:bg-[#46464f]",
      ghost:
        "bg-transparent text-muted hover:bg-white/[0.06] hover:text-foreground",
      danger:
        "bg-danger text-white shadow-sm hover:bg-red-700",
      success:
        "bg-[#141416] text-white border border-white/10 shadow-sm hover:bg-black",
    }[variant],
  );
}

function sizeStyles(size: NonNullable<ButtonProps["size"]> = "md") {
  return cn(
    {
      sm: "h-8 px-3.5 text-xs",
      md: "h-9 px-4 text-sm",
      lg: "h-11 px-6 text-sm",
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
