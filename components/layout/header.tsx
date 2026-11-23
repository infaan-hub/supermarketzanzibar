"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import {
  isPosRole,
  isSupplierRole,
  portalHref,
  roleLabel,
} from "@/lib/auth/roles";
import { CART_CHANGE_EVENT, readCartItemCount } from "@/hooks/usePosCart";

function pageLabelForPath(pathname: string): string {
  const clean = pathname.replace(/^\/(?:admin|manager|market)(?=\/|$)/, "") || "/";
  if (clean === "/" || clean === "/dashboard") return "Overview";
  if (clean.startsWith("/digital-twin")) return "3D Digital Twin";
  if (clean.startsWith("/pos")) return "Point of Sale";
  if (clean.startsWith("/shopping-cart")) return "Shopping Cart";
  if (clean.startsWith("/sales")) return "Sales Orders";
  if (clean.startsWith("/receipt")) return "Receipts";
  if (clean.startsWith("/payments")) return "Payments";
  if (clean.startsWith("/departments")) return "Departments";
  if (clean.startsWith("/shelves")) return "Shelves & Locations";
  if (clean.startsWith("/warehouse")) return "Warehouse";
  if (clean.startsWith("/products")) return "Products";
  if (clean.startsWith("/categories")) return "Categories";
  if (clean.startsWith("/stock/movements")) return "Stock Movements";
  if (clean.startsWith("/stock")) return "Inventory & Batches";
  if (clean.startsWith("/purchase-orders")) return "Purchase Orders";
  if (clean.startsWith("/goods-received")) return "Goods Received";
  if (clean.startsWith("/barcodes")) return "Print Labels";
  if (clean.startsWith("/reports")) return "Reports";
  if (clean.startsWith("/customers")) return "Customers";
  if (clean.startsWith("/suppliers")) return "Suppliers";
  if (clean.startsWith("/supplier")) return "Supplier Portal";
  if (clean.startsWith("/users")) return "Users & Permissions";
  if (clean.startsWith("/settings")) return "Settings";
  if (clean.startsWith("/profile")) return "My Profile";
  return "Workspace";
}

export function Header({
  title,
  sidebarOpen,
  onToggleSidebar,
}: {
  title: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
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
  const activeSection = pageLabelForPath(pathname);

  return (
    <header className="app-header sticky top-0 z-30 shrink-0 border-b border-border bg-white print:hidden">
      <div className="app-header-inner flex h-full min-w-0 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">{displayStore}</span>
            <span className="hidden text-border-hover sm:inline">/</span>
            <span className="truncate font-semibold text-foreground">
              {activeSection}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden h-8 items-center rounded-md border border-border bg-white px-2.5 text-xs font-medium text-muted transition-colors hover:border-border-hover hover:text-foreground sm:inline-flex"
          >
            Storefront
          </Link>

          {isPosRole(user?.role) && (
            <Link
              href={portalHref(user?.role, "/pos")}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 text-xs font-medium text-foreground transition-colors hover:border-border-hover hover:bg-surface-muted"
            >
              <span>POS</span>
              {cartCount > 0 && (
                <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
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
            className="hidden items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-subtle sm:flex"
          >
            <div className="text-right leading-tight">
              <p className="text-xs font-medium text-foreground">
                {user?.full_name || user?.username || displayStore}
              </p>
              <p className="text-[11px] text-muted">
                {user ? roleLabel(user.role) : displayStore}
              </p>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-white">
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
    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  );
}
