"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutIcon /> },
  { href: "/pos", label: "Point of Sale", icon: <PosIcon /> },
  { href: "/shopping-cart", label: "Shopping Cart", icon: <CartIcon /> },
  { href: "/receipt", label: "Receipt", icon: <CartIcon /> },
  { href: "/products", label: "Products", icon: <BoxIcon /> },
  { href: "/categories", label: "Categories", icon: <TagIcon /> },
  { href: "/stock", label: "Inventory", icon: <PackageIcon /> },
  { href: "/sales", label: "Sales", icon: <CartIcon /> },
  { href: "/customers", label: "Customers", icon: <UsersIcon /> },
  { href: "/suppliers", label: "Suppliers", icon: <TruckIcon /> },
  { href: "/users", label: "Users", icon: <UserIcon /> },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
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
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const sync = () => setLoggedIn(Boolean(localStorage.getItem("ss_access_token")));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function handleSignOut() {
    try {
      localStorage.removeItem("ss_access_token");
    } catch {
      // ignore
    }
    setLoggedIn(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      id="app-sidebar"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-sidebar/[0.98] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl backdrop-blur-md transition-transform duration-200 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      aria-label="Main navigation"
    >
      <div className="flex h-full flex-col">
        <div className="h-14 shrink-0 border-b border-border bg-background/60 backdrop-blur px-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-hover font-display text-sm font-bold text-white shadow-[0_0_12px_rgba(21,114,45,0.30)]">
            SZ
          </div>
          <span className="font-display font-bold text-xl text-foreground tracking-tight">
            Supermarket
          </span>
          <button
            type="button"
            className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent/10 hover:text-foreground lg:hidden"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-hover text-white shadow-[0_0_10px_rgba(21,114,45,0.24)]"
                    : "text-muted hover:bg-accent/5 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="h-5 w-5 shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-border px-3 py-3 space-y-1">
          {loggedIn ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <span className="h-5 w-5 shrink-0">
                <LogoutIcon />
              </span>
              Sign out
            </button>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent/5 hover:text-foreground"
              >
                <span className="h-5 w-5 shrink-0">
                  <LoginIcon />
                </span>
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-accent/5 hover:text-foreground"
              >
                <span className="h-5 w-5 shrink-0">
                  <RegisterIcon />
                </span>
                Sign up
              </Link>
            </>
          )}
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
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function PosIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 14v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6" />
      <path d="M3 10h18" />
      <path d="M16 14H8" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 16 11 12 19" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 1.99 1.82h7.12a2 2 0 0 0 1.99-1.82L19.73 4.05H21" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 19h2l4-6H5l4 6z" />
      <path d="M5 17h14" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function RegisterIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
