"use client";

import * as React from "react";
import {
  GuestBasketDrawer,
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

export default function PublicStore3DPage() {
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
      if (reconcileTimerRef.current) window.clearTimeout(reconcileTimerRef.current);
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

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <StorefrontHeader
        activePage="3d"
        cartCount={basket.count}
        onOpenCart={() => setCartOpen(true)}
      />

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
        fullHeight
      />

      <GuestBasketDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={basket.cart}
        count={basket.count}
        subtotal={basket.subtotal}
        onAdjustItem={(productId, delta) => basket.adjustItem(productId, delta)}
        onClear={basket.clearBasket}
      />
    </div>
  );
}
