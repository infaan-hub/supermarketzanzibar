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
    "inline-flex items-center justify-center gap-2 font-display font-medium rounded shadow-sm transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
  );
}

function variantStyles(variant: NonNullable<ButtonProps["variant"]> = "default") {
  return cn({
    default:
      "bg-primary-hover text-white shadow-sm hover:bg-[#0f5c23] hover:shadow-[0_0_12px_rgba(21,114,45,0.28)]",
    secondary:
      "bg-background border border-border text-foreground hover:bg-accent/5 hover:border-accent",
    ghost:
      "bg-background text-foreground hover:bg-accent/5 hover:text-primary",
    danger:
      "bg-danger text-white hover:bg-danger/90 shadow-sm",
    success:
      "bg-success text-white hover:bg-success/90 shadow-sm",
  }[variant]);
}

function sizeStyles(size: NonNullable<ButtonProps["size"]> = "md") {
  return cn({
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-6 text-base",
  }[size]);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "default", size = "md", isLoading, children, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        className={cn(baseStyles(), variantStyles(variant), sizeStyles(size), className)}
        disabled={props.disabled || isLoading}
      >
        {isLoading ? (
          <>
            <span className="relative flex h-3 w-3" style={{ animation: "spin 1s linear infinite" }}>
              <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
