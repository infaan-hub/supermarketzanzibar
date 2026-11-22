"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import {
  isAdminRole,
  isPosRole,
  isSupplierRole,
  portalHref,
  roleLabel,
} from "@/lib/auth/roles";
import { CART_CHANGE_EVENT, readCartItemCount } from "@/hooks/usePosCart";

export function Header({
  title,
  sidebarOpen,
  onToggleSidebar,
}: {
  title: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const sync = () => setCartCount(readCartItemCount());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CART_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CART_CHANGE_EVENT, sync);
    };
  }, []);

  const displayStore = settings.storeName || title;
  const initials = (user?.full_name || user?.username || "SZ")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="app-header sticky top-0 z-30 shrink-0 border-b border-border bg-background/90 shadow-sm backdrop-blur-md print:hidden">
      <div className="app-header-inner flex h-full min-w-0 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent/10 hover:text-foreground"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <span className="max-w-[55vw] truncate font-display font-semibold text-foreground sm:hidden">
            {displayStore}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isAdminRole(user?.role) && (
            <span className="hidden rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 md:inline-flex">
              Admin Portal
            </span>
          )}
          {isSupplierRole(user?.role) && (
            <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 md:inline-flex">
              Supplier Portal
            </span>
          )}
          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-teal-400 hover:text-foreground sm:inline-flex"
          >
            Storefront
          </Link>
          {isPosRole(user?.role) && (
            <Link
              href={portalHref(user?.role, "/pos")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-muted"
            >
              <span>POS</span>
              {cartCount > 0 && (
                <span className="rounded-full bg-primary-hover px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          <Link
            href={
              isSupplierRole(user?.role)
                ? "/supplier/profile"
                : portalHref(user?.role, "/profile")
            }
            className="hidden sm:flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-accent/5"
          >
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold text-foreground">
                {user?.full_name || user?.username || displayStore}
              </p>
              <p className="text-[11px] text-muted">
                {user ? roleLabel(user.role) : displayStore}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-subtle text-xs font-semibold text-primary-hover">
              {initials}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  );
}
