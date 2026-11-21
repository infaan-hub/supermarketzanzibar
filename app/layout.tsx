import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Shell } from "@/components/layout/shell";

export const metadata: Metadata = {
  title: "Supermarket Zanzibar — POS & Inventory",
  description:
    "Supermarket Zanzibar point of sale, barcode inventory, and analytics platform",
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
        <AuthProvider>
          <Shell title="Supermarket Zanzibar">{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
