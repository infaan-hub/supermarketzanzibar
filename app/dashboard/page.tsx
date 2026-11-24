"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { DashboardPageView } from "@/components/dashboard/dashboard-page-view";
import { MarketplaceStorefrontContent } from "@/components/storefront/guest-storefront";
import { isCustomerRole } from "@/lib/auth/roles";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading && !user) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="h-32 animate-pulse rounded-[24px] bg-[#2a2a2e]" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-56 animate-pulse rounded-[26px] bg-[#2a2a2e]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isCustomerRole(user?.role)) {
    return (
      <div className="mx-auto max-w-[1440px]">
        <MarketplaceStorefrontContent showCustomerSummary />
      </div>
    );
  }

  return <DashboardPageView />;
}
