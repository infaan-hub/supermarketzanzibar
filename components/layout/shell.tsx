"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  isAuthUtilityPath,
  isPublicPath,
  isStorefrontPath,
} from "@/lib/auth/roles";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export interface ShellProps {
  title: string;
  children: React.ReactNode;
}

export function Shell({ title, children }: ShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);

  const storefront = isStorefrontPath(pathname);
  const authUtility = isAuthUtilityPath(pathname);
  const hideChrome = isPublicPath(pathname);
  const isFullViewportCanvas =
    pathname === "/digital-twin" || pathname === "/admin/digital-twin";

  React.useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => {
      setIsDesktop(desktopQuery.matches);
      setSidebarOpen(desktopQuery.matches);
    };

    syncViewport();
    desktopQuery.addEventListener("change", syncViewport);
    return () => desktopQuery.removeEventListener("change", syncViewport);
  }, []);

  React.useEffect(() => {
    if (!sidebarOpen || isDesktop || hideChrome) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen, isDesktop, hideChrome]);

  if (storefront) {
    return <div className="min-h-dvh page-surface">{children}</div>;
  }

  if (authUtility || hideChrome) {
    return (
      <div className="min-h-dvh page-surface">
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-canvas print:block print:h-auto print:overflow-visible">
      {sidebarOpen && !isDesktop && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-teal-950/25 backdrop-blur-[2px] lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={() => {
          if (!isDesktop) setSidebarOpen(false);
        }}
      />
      <div
        className={`relative flex min-w-0 flex-1 flex-col transition-[margin] duration-200 print:ml-0 ${sidebarOpen ? "lg:ml-64" : "lg:ml-0"}`}
      >
        <Header
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <main
          className={
            isFullViewportCanvas
              ? "min-h-0 flex-1 overflow-hidden bg-[#f2fbfa] p-0 print:overflow-visible"
              : "safe-main page-surface min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:py-6 lg:py-7 print:overflow-visible print:bg-white print:p-0"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
