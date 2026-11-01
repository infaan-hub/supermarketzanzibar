"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Header({ title }: { title: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur-md transition-colors",
        scrolled ? "shadow-sm" : "shadow-sm",
      )}
    >
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button
            className="-ml-1 inline-flex items-center justify-center h-10 w-10 rounded-lg border border-transparent bg-background/80 hover:bg-accent/5 text-muted hover:text-foreground transition-colors"
            aria-label="Toggle navigation"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          <span className="font-display font-semibold text-foreground sm:hidden">
            {title}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-4">
          <button
            className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-transparent bg-background/80 text-muted hover:bg-accent/5 hover:text-foreground transition-colors"
            aria-label="Notifications"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden md:block text-sm text-muted">
              Supermarket Zanzibar
            </span>
            <div className="h-8 w-8 rounded-full border border-border bg-background flex items-center justify-center text-xs font-semibold text-primary overflow-hidden">
              SZ
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
