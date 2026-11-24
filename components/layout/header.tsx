"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import {
  isCustomerRole,
  isPosRole,
  isSupplierRole,
  portalHref,
  roleLabel,
} from "@/lib/auth/roles";
import { CART_CHANGE_EVENT, readCartItemCount } from "@/hooks/usePosCart";

function pageLabelForPath(pathname: string): string {
  const clean = pathname.replace(/^\/(?:admin|manager|market)(?=\/|$)/, "") || "/";
  if (clean === "/" || clean === "/dashboard") return "Dashboard";
  if (clean.startsWith("/orders")) return "My Orders";
  if (clean.startsWith("/history")) return "Purchase History";
  if (clean.startsWith("/3d-store") || clean.startsWith("/store-3d")) return "3D Store";
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
    <header className="app-header sticky top-0 z-30 shrink-0 border-b border-white/[0.06] bg-[#1c1c1e]/95 backdrop-blur-md print:hidden">
      <div className="app-header-inner flex h-full min-w-0 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2a2a2e] text-muted transition-colors hover:bg-[#38383f] hover:text-white cursor-pointer"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {/* Pill Search / Workspace Bar matching the top of the reference design */}
          <Link
            href={
              isCustomerRole(user?.role)
                ? "/dashboard"
                : portalHref(user?.role, "/products")
            }
            className="flex h-10 max-w-md flex-1 items-center justify-between gap-2 rounded-full border border-white/10 bg-[#141416] pl-4 pr-1.5 text-xs text-muted transition-colors hover:border-white/20"
          >
            <span className="truncate">
              <strong className="font-semibold text-white">
                {displayStore}
              </strong>{" "}
              · {activeSection} — Search products, categories, or shelves…
            </span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#48484f] text-white">
              <SearchIcon />
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={isCustomerRole(user?.role) ? "/3d-store" : "/"}
            className="hidden h-9 items-center rounded-full border border-white/10 bg-[#2a2a2e] px-3.5 text-xs font-semibold text-[#e4e4e7] transition-colors hover:border-white/20 hover:bg-[#38383f] sm:inline-flex"
          >
            {isCustomerRole(user?.role) ? "3D Store" : "Marketplace"}
          </Link>

          {isPosRole(user?.role) && (
            <Link
              href={portalHref(user?.role, "/pos")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#4CAF50] px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#43A047]"
            >
              <span>Cart / POS</span>
              {cartCount > 0 && (
                <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
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
            className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-[#2a2a2e] py-1 pr-2.5 pl-3 transition-colors hover:bg-[#38383f] sm:flex"
          >
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold text-white">
                {user?.full_name || user?.username || displayStore}
              </p>
              <p className="text-[10px] text-[#4CAF50]">
                {user ? roleLabel(user.role) : displayStore}
              </p>
            </div>
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#4CAF50] text-[11px] font-bold text-white">
              {user?.profile_image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.profile_image_url}
                  alt={user.full_name || user.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
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
