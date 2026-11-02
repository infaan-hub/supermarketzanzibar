"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export interface ShellProps {
  title: string;
  children: React.ReactNode;
}

export function Shell({ title, children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);

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
    if (!sidebarOpen || isDesktop) return;

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
  }, [sidebarOpen, isDesktop]);

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-background">
      {sidebarOpen && !isDesktop && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[1px] lg:hidden"
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
        className={`relative flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ${sidebarOpen ? "lg:ml-64" : "lg:ml-0"}`}
      >
        <Header
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <main className="safe-main min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
