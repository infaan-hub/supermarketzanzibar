import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Shell } from "@/components/layout/shell";

export const metadata: Metadata = {
  title: "Marketplace — POS, 3D Store & Inventory",
  description:
    "Marketplace point of sale, 3D store, barcode inventory, and order analytics platform",
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
    <html lang="en" className="dark">
      <body className="bg-canvas text-foreground">
        <AuthProvider>
          <Shell title="Marketplace">{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
