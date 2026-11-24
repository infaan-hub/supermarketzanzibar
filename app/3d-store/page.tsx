"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  GuestBasketDrawer,
  GuestPublicSidebar,
  StorefrontHeader,
} from "@/components/storefront/guest-storefront";
import { Interactive3DStorefront } from "@/components/storefront/interactive-3d-storefront";
import { useGuestBasket } from "@/hooks/useGuestBasket";
import {
  applyPublicShelfEventToSnapshot,
  usePublicStorefrontRealtime,
  type PublicShelfEvent,
} from "@/hooks/usePublicStorefrontRealtime";
import { fetchPublicCatalog, fetchPublicDigitalTwin } from "@/lib/api";
import type { PublicCatalogProduct } from "@/types/api";
import type { DigitalTwinSnapshot } from "@/types/digital-twin";

function Store3DContent() {
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const focusProductId = searchParams.get("product");

  const [snapshot, setSnapshot] = React.useState<DigitalTwinSnapshot | null>(
    null,
  );
  const [catalogById, setCatalogById] = React.useState<
    Map<string, PublicCatalogProduct>
  >(() => new Map());
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cartOpen, setCartOpen] = React.useState(false);

  const basket = useGuestBasket();

  const focusProductRequest = React.useMemo(() => {
    if (!focusProductId) return null;
    return { productId: focusProductId, nonce: 1 };
  }, [focusProductId]);

  const loadStore = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [twin, cat] = await Promise.all([
        fetchPublicDigitalTwin(),
        fetchPublicCatalog({ take: 120 }).catch(() => null),
      ]);
      setSnapshot(twin);
      if (cat) {
        setCatalogById(new Map(cat.products.map((p) => [p.id, p])));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load 3D store.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const reconcileTimerRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    return () => {
      if (reconcileTimerRef.current) {
        window.clearTimeout(reconcileTimerRef.current);
      }
    };
  }, []);

  const { connected: realtimeConnected } = usePublicStorefrontRealtime(
    React.useCallback(
      (event: PublicShelfEvent) => {
        setSnapshot((prev) => applyPublicShelfEventToSnapshot(prev, event));
        if (reconcileTimerRef.current) {
          window.clearTimeout(reconcileTimerRef.current);
        }
        reconcileTimerRef.current = window.setTimeout(() => {
          void loadStore(true);
        }, 450);
      },
      [loadStore],
    ),
    true,
  );

  React.useEffect(() => {
    void loadStore(false);
  }, [loadStore]);

  const storeView = (
    <Interactive3DStorefront
      snapshot={snapshot}
      loading={loading}
      error={error}
      onRefresh={() => void loadStore(true)}
      refreshing={refreshing}
      realtimeConnected={realtimeConnected}
      catalogById={catalogById}
      basketQuantities={basket.basketQuantities}
      basketCount={basket.count}
      onAddItem={basket.addItem}
      onAdjustItem={basket.adjustItem}
      onOpenBasket={() => setCartOpen(true)}
      focusProductRequest={focusProductRequest}
      fullHeight
    />
  );

  const basketDrawer = (
    <GuestBasketDrawer
      open={cartOpen}
      onClose={() => setCartOpen(false)}
      cart={basket.cart}
      count={basket.count}
      subtotal={basket.subtotal}
      onAdjustItem={(productId, delta) => basket.adjustItem(productId, delta)}
      onClear={basket.clearBasket}
      onOrderSuccess={() => void loadStore(true)}
    />
  );

  if (isAuthenticated) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-canvas">
        {storeView}
        {basketDrawer}
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas lg:flex-row">
      <div className="lg:hidden">
        <StorefrontHeader
          activePage="3d"
          cartCount={basket.count}
          onOpenCart={() => setCartOpen(true)}
        />
      </div>
      <GuestPublicSidebar activePage="3d" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{storeView}</div>
      {basketDrawer}
    </div>
  );
}

export default function Dedicated3DStorePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-canvas">
          <div className="rounded-2xl border border-white/10 bg-[#2a2a2e] px-5 py-3 text-center shadow-card">
            <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-[#4CAF50] border-t-transparent" />
            <p className="text-xs font-medium text-muted">Loading 3D Store…</p>
          </div>
        </div>
      }
    >
      <Store3DContent />
    </React.Suspense>
  );
}
