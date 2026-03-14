import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../api/http.jsx";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "zansupermarket-cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const cartProductIdsKey = items
    .map((item) => item?.product?.id)
    .filter(Boolean)
    .sort((left, right) => left - right)
    .join(",");

  useEffect(() => {
    if (!cartProductIdsKey) return;

    let isCancelled = false;

    const syncCartProducts = async () => {
      try {
        const response = await http.get("/api/products/");
        const freshProducts = new Map(response.data.map((product) => [product.id, product]));

        if (isCancelled) return;

        setItems((currentItems) =>
          currentItems.map((item) => {
            const freshProduct = freshProducts.get(item.product.id);
            if (!freshProduct) return item;
            return {
              ...item,
              product: {
                ...item.product,
                ...freshProduct,
              },
            };
          })
        );
      } catch {
        // Keep the stored cart payload if the product refresh request fails.
      }
    };

    syncCartProducts();

    return () => {
      isCancelled = true;
    };
  }, [cartProductIdsKey]);

  const addToCart = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, product: { ...item.product, ...product }, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setItems([]);

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      clearCart,
      count: items.reduce((total, item) => total + item.quantity, 0),
      total: items.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0),
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
