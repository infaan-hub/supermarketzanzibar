"use client";

import * as React from "react";

export interface GuestCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  categoryName: string | null;
}

const GUEST_CART_KEY = "sz_guest_basket";
const GUEST_CART_EVENT = "sz:guest-basket-updated";

function readGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    return raw ? (JSON.parse(raw) as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

export function useGuestBasket() {
  const [cart, setCart] = React.useState<GuestCartItem[]>([]);
  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    setCart(readGuestCart());
    hydratedRef.current = true;

    const onSync = () => setCart(readGuestCart());
    window.addEventListener("storage", onSync);
    window.addEventListener(GUEST_CART_EVENT, onSync);
    return () => {
      window.removeEventListener("storage", onSync);
      window.removeEventListener(GUEST_CART_EVENT, onSync);
    };
  }, []);

  const persist = React.useCallback((next: GuestCartItem[]) => {
    try {
      window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(GUEST_CART_EVENT));
    } catch {
      // ignore storage errors
    }
  }, []);

  const addItem = React.useCallback(
    (item: {
      productId: string;
      name: string;
      price: number;
      maxQuantity: number;
      categoryName: string | null;
      quantity?: number;
    }) => {
      if (item.maxQuantity <= 0) return;
      const step = Math.max(1, Math.floor(item.quantity ?? 1));
      setCart((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        const next = existing
          ? prev.map((i) =>
              i.productId === item.productId
                ? {
                    ...i,
                    quantity: Math.min(item.maxQuantity, i.quantity + step),
                  }
                : i,
            )
          : [
              ...prev,
              {
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: Math.min(item.maxQuantity, step),
                categoryName: item.categoryName,
              },
            ];
        if (hydratedRef.current) persist(next);
        return next;
      });
    },
    [persist],
  );

  const adjustItem = React.useCallback(
    (productId: string, delta: number, maxQuantity?: number) => {
      setCart((prev) => {
        const next = prev
          .map((i) => {
            if (i.productId !== productId) return i;
            const raw = i.quantity + delta;
            const capped =
              typeof maxQuantity === "number" ? Math.min(maxQuantity, raw) : raw;
            return { ...i, quantity: Math.max(0, capped) };
          })
          .filter((i) => i.quantity > 0);
        if (hydratedRef.current) persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearBasket = React.useCallback(() => {
    setCart([]);
    if (hydratedRef.current) persist([]);
  }, [persist]);

  const basketQuantities = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      map[item.productId] = item.quantity;
    }
    return map;
  }, [cart]);

  const count = React.useMemo(
    () => cart.reduce((sum, i) => sum + i.quantity, 0),
    [cart],
  );

  const subtotal = React.useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart],
  );

  return {
    cart,
    basketQuantities,
    count,
    subtotal,
    addItem,
    adjustItem,
    clearBasket,
  };
}
