"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canAccessPath,
  isAdminRole,
  isSupplierRole,
  portalHref,
  roleLabel,
} from "@/lib/auth/roles";
import { CART_CHANGE_EVENT, readCartItemCount } from "@/hooks/usePosCart";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: "cart";
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Overview", icon: <LayoutIcon />, exact: true },
      { href: "/digital-twin", label: "3D Digital Twin", icon: <CubeIcon /> },
      { href: "/reports", label: "Reports & Z-Report", icon: <ChartIcon /> },
    ],
  },
  {
    title: "Sell",
    items: [
      { href: "/pos", label: "Point of Sale", icon: <PosIcon />, badge: "cart" },
      { href: "/sales", label: "Sales", icon: <ReceiptIcon /> },
      { href: "/payments", label: "Payments", icon: <WalletIcon /> },
    ],
  },
  {
    title: "Store & Spatial",
    items: [
      { href: "/departments", label: "Departments", icon: <GridIcon /> },
      { href: "/shelves", label: "Shelves & Locations", icon: <ShelfIcon /> },
      { href: "/warehouse", label: "3D Warehouse", icon: <WarehouseIcon /> },
    ],
  },
  {
    title: "Inventory & Supply",
    items: [
      { href: "/products", label: "Products", icon: <BoxIcon /> },
      { href: "/categories", label: "Categories", icon: <TagIcon /> },
      { href: "/stock", label: "Inventory & Batches", icon: <PackageIcon />, exact: true },
      { href: "/purchase-orders", label: "Purchase Orders", icon: <ClipboardIcon /> },
      { href: "/goods-received", label: "Goods Received", icon: <ReceiveIcon /> },
      { href: "/stock/movements", label: "Stock Movements", icon: <HistoryIcon /> },
      { href: "/barcodes", label: "Print Labels", icon: <BarcodeIcon /> },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/customers", label: "Customers", icon: <UsersIcon /> },
      { href: "/suppliers", label: "Suppliers", icon: <TruckIcon /> },
      { href: "/users", label: "Users & Permissions", icon: <UserIcon /> },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/profile", label: "My Profile", icon: <ProfileIcon /> },
      { href: "/settings", label: "Settings", icon: <SettingsIcon /> },
    ],
  },
];

const SUPPLIER_SECTIONS: NavSection[] = [
  {
    title: "Supplier Portal",
    items: [
      { href: "/supplier", label: "Portal Overview", icon: <LayoutIcon />, exact: true },
      { href: "/supplier/products", label: "My Products", icon: <BoxIcon /> },
      { href: "/supplier/orders", label: "Purchase Orders", icon: <ClipboardIcon /> },
      { href: "/supplier/deliveries", label: "Deliveries & GRN", icon: <ReceiveIcon /> },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/supplier/profile", label: "My Profile", icon: <ProfileIcon /> },
      { href: "/", label: "Public Storefront", icon: <CubeIcon />, exact: true },
    ],
  },
];

function isActive(item: NavItem, pathname: string) {
  if (
    item.exact ||
    item.href === "/" ||
    item.href === "/admin" ||
    item.href === "/market"
  ) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar({
  isOpen,
  onClose,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
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

  const isSupplier = isSupplierRole(user?.role);
  const isAdmin = isAdminRole(user?.role);

  const visibleSections = isSupplier
    ? SUPPLIER_SECTIONS
    : NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items
          .filter((item) => canAccessPath(user?.role, item.href))
          .map((item) => ({
            ...item,
            href: portalHref(user?.role, item.href),
          })),
      })).filter((section) => section.items.length > 0);

  const profileHref = isSupplier
    ? "/supplier/profile"
    : portalHref(user?.role, "/profile");

  return (
    <aside
      id="app-sidebar"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-border bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-200 print:hidden ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      aria-label="Main navigation"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold tracking-tight text-white">
            SZ
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
              Supermarket
            </span>
            <span className="block truncate text-[11px] text-muted">
              {isAdmin
                ? "Administration"
                : isSupplier
                  ? "Supplier Portal"
                  : user
                    ? roleLabel(user.role)
                    : "Store Operations"}
            </span>
          </div>
          <button
            type="button"
            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-subtle hover:text-foreground lg:hidden"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3.5" aria-label="Main">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[11px] font-medium text-muted-foreground">
                {section.title}
              </p>
              {section.items.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-primary font-semibold"
                        : "text-muted hover:bg-surface-subtle hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge === "cart" && cartCount > 0 && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                          active
                            ? "bg-primary text-white"
                            : "bg-surface-muted text-foreground",
                        )}
                      >
                        {cartCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-border p-2.5">
          {user && (
            <Link
              href={profileHref}
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-subtle"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-[11px] font-semibold text-foreground">
                {(user.full_name || user.username).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {user.full_name || user.username}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {roleLabel(user.role)}
                </p>
              </div>
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <span className="h-4 w-4 shrink-0">
              <LogoutIcon />
            </span>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  );
}
function LayoutIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
function PosIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function ReceiptIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function PackageIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M3 9h18M3 15h18" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function BarcodeIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M18 5v14M21 5v14" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function CubeIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function ShelfIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4v16M20 4v16M4 8h16M4 14h16M4 20h16" />
    </svg>
  );
}
function WarehouseIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M9 21v-8h6v8" />
      <path d="M9 17h6" />
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}
function ReceiveIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}
