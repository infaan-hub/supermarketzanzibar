"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export interface ShellProps {
  title: string;
  children: React.ReactNode;
}

export function Shell({ title, children }: ShellProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col relative sm:ml-64">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto bg-background p-6 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
