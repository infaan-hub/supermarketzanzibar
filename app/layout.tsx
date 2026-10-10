import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supermarket Zanzibar - POS System",
  description: "Supermarket management system with point of sale support",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}
