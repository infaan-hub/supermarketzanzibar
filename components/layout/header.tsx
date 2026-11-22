"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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

function pageLabelForPath(pathname: string): string {
  const clean = pathname.replace(/^\/admin(?=\/|$)/, "") || "/";
  if (clean === "/" || clean === "/dashboard") return "Overview";
  if (clean.startsWith("/digital-twin")) return "3D Digital Twin";
  if (clean.startsWith("/pos")) return "Point of Sale";
  if (clean.startsWith("/shopping-cart")) return "Shopping Cart";
  if (clean.startsWith("/sales")) return "Sales Orders";
  if (clean.startsWith("/receipt")) return "Receipt Studio";
  if (clean.startsWith("/payments")) return "Payments";
  if (clean.startsWith("/departments")) return "Departments";
  if (clean.startsWith("/shelves")) return "Shelves & Locations";
  if (clean.startsWith("/warehouse")) return "3D Warehouse";
  if (clean.startsWith("/products")) return "Products";
  if (clean.startsWith("/categories")) return "Categories";
  if (clean.startsWith("/stock/movements")) return "Stock Movements";
  if (clean.startsWith("/stock")) return "Inventory & Batches";
  if (clean.startsWith("/purchase-orders")) return "Purchase Orders";
  if (clean.startsWith("/goods-received")) return "Goods Received";
  if (clean.startsWith("/barcodes")) return "Barcode Print Studio";
  if (clean.startsWith("/reports")) return "Reports & Z-Report";
  if (clean.startsWith("/customers")) return "Customers";
  if (clean.startsWith("/suppliers")) return "Suppliers";
  if (clean.startsWith("/supplier")) return "Supplier Portal";
  if (clean.startsWith("/users")) return "Users & Permissions";
  if (clean.startsWith("/settings")) return "Store Settings";
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
    <header className="app-header sticky top-0 z-30 shrink-0 border-b border-border bg-white/85 shadow-[0_4px_20px_-10px_rgba(15,62,66,0.12)] backdrop-blur-xl print:hidden">
      <div className="app-header-inner flex h-full min-w-0 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-muted transition-all hover:border-border hover:bg-surface-subtle hover:text-teal-900"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-xs font-medium text-muted sm:inline">
              {displayStore}
            </span>
            <span className="hidden text-teal-400 sm:inline">/</span>
            <span className="truncate font-display text-sm font-semibold text-foreground sm:text-[15px]">
              {activeSection}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {isAdminRole(user?.role) && (
            <span className="hidden items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/90 px-2.5 py-1 text-[11px] font-semibold text-teal-800 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Admin Portal
            </span>
          )}
          {isSupplierRole(user?.role) && (
            <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Supplier Portal
            </span>
          )}

          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted shadow-sm transition-all hover:border-teal-400/70 hover:bg-surface-subtle hover:text-teal-900 sm:inline-flex"
          >
            Storefront
          </Link>

          {isPosRole(user?.role) && (
            <Link
              href={portalHref(user?.role, "/pos")}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200/80 bg-surface-subtle px-3 py-1.5 font-display text-xs font-semibold text-teal-900 shadow-sm transition-all hover:border-teal-400 hover:bg-teal-50"
            >
              <span>POS</span>
              {cartCount > 0 && (
                <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
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
            className="hidden items-center gap-2.5 rounded-xl border border-transparent px-2 py-1 transition-all hover:border-border hover:bg-surface-subtle sm:flex"
          >
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold text-foreground">
                {user?.full_name || user?.username || displayStore}
              </p>
              <p className="text-[11px] text-muted">
                {user ? roleLabel(user.role) : displayStore}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 font-display text-xs font-bold text-white shadow-sm">
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
