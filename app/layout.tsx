import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/layout/shell";

export const metadata: Metadata = {
  title: "Supermarket Zanzibar - POS System",
  description: "Supermarket management system with point of sale support",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background">
        <Shell title="Supermarket Zanzibar">{children}</Shell>
      </body>
    </html>
  );
}
