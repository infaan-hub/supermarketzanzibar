"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canAccessPath,
  isAdminRole,
  isCustomerRole,
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

const CUSTOMER_SECTIONS: NavSection[] = [
  {
    title: "Marketplace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutIcon />, exact: true },
      { href: "/orders", label: "Orders", icon: <ReceiptIcon /> },
      { href: "/3d-store", label: "3D Store", icon: <CubeIcon /> },
      { href: "/history", label: "History", icon: <HistoryIcon /> },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/profile", label: "My Profile", icon: <ProfileIcon /> },
    ],
  },
];

function isActive(item: NavItem, pathname: string) {
  if (
    item.exact ||
    item.href === "/" ||
    item.href === "/admin" ||
    item.href === "/manager" ||
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
  const isCustomer = isCustomerRole(user?.role);

  const visibleSections = isSupplier
    ? SUPPLIER_SECTIONS
    : isCustomer
      ? CUSTOMER_SECTIONS
      : NAV_SECTIONS.map((section) => ({
          ...section,
          items: section.items
            .filter((item) => {
              if (
                isAdmin &&
                (item.href === "/stock" || item.href === "/goods-received")
              ) {
                return false;
              }
              return canAccessPath(user?.role, item.href);
            })
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
      className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/[0.06] bg-[#252528] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-200 print:hidden ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      aria-label="Main navigation"
    >
      <div className="flex h-full flex-col">
        {/* Top Supermarket Marketplace Emblem Header */}
        <div className="flex h-20 shrink-0 items-center gap-3 px-5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#4CAF50] text-white shadow-[0_6px_18px_rgba(76,175,80,0.4)]">
            <SupermarketLogoIcon />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-display text-base font-extrabold tracking-tight text-white">
              Marketplace
            </span>
            <span className="block truncate text-[11px] font-medium text-[#4CAF50]">
              {isAdmin
                ? "Admin Portal"
                : isSupplier
                  ? "Supplier Portal"
                  : user
                    ? `${roleLabel(user.role)} Portal`
                    : "Store Operations"}
            </span>
          </div>
          <button
            type="button"
            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Iconic Curved Left Icon Rail + Right Label Column */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden py-2">
          {/* Decorative Curved Grey Left Rail Backdrop matching reference design */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1 bottom-1 left-0 w-[60px] rounded-r-[34px] bg-[#505056] shadow-[inset_-1px_0_0_rgba(255,255,255,0.12),4px_0_16px_rgba(0,0,0,0.3)]"
          />

          <nav
            className="relative z-10 flex-1 space-y-4 overflow-y-auto py-3 pr-3"
            aria-label="Main"
          >
            {visibleSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="pl-[74px] pr-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const active = isActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className="group relative flex items-center py-1.5 text-[13px] font-medium transition-colors"
                      aria-current={active ? "page" : undefined}
                    >
                      {/* Left Rail Icon Slot (centered inside the 60px curved grey rail) */}
                      <span className="relative flex w-[60px] shrink-0 items-center justify-center">
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                            active
                              ? "bg-[#252528] text-[#4CAF50] shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                              : "text-white/90 group-hover:bg-white/10 group-hover:text-white",
                          )}
                        >
                          <span className="h-4 w-4">{item.icon}</span>
                        </span>
                        {/* Glowing #4CAF50 Dot on the Curved Rail Edge */}
                        {active && (
                          <span className="absolute -right-1 h-2.5 w-2.5 rounded-full bg-[#4CAF50] ring-2 ring-[#252528]" />
                        )}
                      </span>

                      {/* Right Label Slot */}
                      <span
                        className={cn(
                          "ml-3.5 flex-1 truncate transition-colors",
                          active
                            ? "font-semibold text-[#4CAF50]"
                            : "text-[#a1a1aa] group-hover:text-white",
                        )}
                      >
                        {item.label}
                      </span>

                      {item.badge === "cart" && cartCount > 0 && (
                        <span
                          className={cn(
                            "mr-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                            active
                              ? "bg-[#4CAF50] text-white"
                              : "bg-[#38383f] text-white",
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

            {/* Inline Logout row matching the reference sidebar */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void logout()}
                className="group relative flex w-full items-center py-1.5 text-[13px] font-medium text-[#a1a1aa] transition-colors hover:text-[#4CAF50] cursor-pointer"
              >
                <span className="flex w-[60px] shrink-0 items-center justify-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white/90 transition-all group-hover:bg-white/10 group-hover:text-[#4CAF50]">
                    <span className="h-4 w-4">
                      <LogoutIcon />
                    </span>
                  </span>
                </span>
                <span className="ml-3.5 truncate">Logout</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Bottom Circular Utility Buttons + Active User Pill */}
        <div className="shrink-0 space-y-2.5 border-t border-white/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href={
                isAdmin
                  ? "/admin/settings"
                  : profileHref
              }
              onClick={onNavigate}
              title={isAdmin ? "Store Settings" : "My Profile"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#38383f] text-white shadow-md transition-all hover:bg-[#4CAF50] hover:text-white"
            >
              <span className="h-4.5 w-4.5">
                <SettingsIcon />
              </span>
            </Link>
            <Link
              href="/"
              onClick={onNavigate}
              title="Open Public Marketplace"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#38383f] text-white shadow-md transition-all hover:bg-[#4CAF50] hover:text-white"
            >
              <span className="h-4.5 w-4.5">
                <BellIcon />
              </span>
            </Link>
            {user && (
              <Link
                href={profileHref}
                onClick={onNavigate}
                className="ml-auto flex min-w-0 items-center gap-2 rounded-full bg-[#1c1c1e] py-1 pr-3 pl-1.5 transition-colors hover:bg-[#323238]"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4CAF50] text-[10px] font-bold text-white">
                  {user.profile_image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.profile_image_url}
                      alt={user.full_name || user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (user.full_name || user.username).slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-white">
                    {user.full_name || user.username}
                  </p>
                  <p className="truncate text-[10px] text-[#9ca3af]">
                    {roleLabel(user.role)}
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SupermarketLogoIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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
