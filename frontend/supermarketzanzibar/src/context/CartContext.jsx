import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../api/http.jsx";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "zansupermarket-cart";
const CHECKOUT_STORAGE_KEY = "zansupermarket-checkout";
const DEFAULT_NOTICE = { id: 0, kind: "info", message: "" };
const PRODUCT_FALLBACK_MARKER = "/product-fallback.svg";

function isFallbackImage(value) {
  return typeof value === "string" && value.includes(PRODUCT_FALLBACK_MARKER);
}

function mergeProductSnapshot(currentProduct, freshProduct) {
  if (!freshProduct) return currentProduct;

  const nextImageUrl =
    freshProduct.image_url && !(isFallbackImage(freshProduct.image_url) && currentProduct?.image_url)
      ? freshProduct.image_url
      : currentProduct?.image_url || freshProduct.image_url || null;

  return {
    ...currentProduct,
    ...freshProduct,
    image: freshProduct.image || currentProduct.image || null,
    image_url: nextImageUrl,
    updated_at: freshProduct.updated_at || currentProduct.updated_at,
  };
}

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
  const [checkoutDraft, setCheckoutDraftState] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(CHECKOUT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [notice, setNotice] = useState(DEFAULT_NOTICE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!checkoutDraft) {
      window.localStorage.removeItem(CHECKOUT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(checkoutDraft));
  }, [checkoutDraft]);

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
              product: mergeProductSnapshot(item.product, freshProduct),
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

  const showNotice = (message, kind = "info") => {
    setNotice({
      id: Date.now(),
      kind,
      message,
    });
  };

  const addToCart = (product, quantity = 1) => {
    const nextQuantityRequest = Math.max(1, Number(quantity) || 1);
    const stockLimit = Math.max(0, Number(product?.quantity || 0));

    if (!product?.id) {
      showNotice("Unable to add this product right now.", "warning");
      return false;
    }

    if (stockLimit <= 0) {
      showNotice("This product is out of stock.", "warning");
      return false;
    }

    let didAdd = false;
    let hitLimit = false;

    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const existingQuantity = existing ? existing.quantity : 0;
      const targetQuantity = Math.min(existingQuantity + nextQuantityRequest, stockLimit);

      if (targetQuantity <= existingQuantity) {
        hitLimit = true;
        return prev;
      }

      didAdd = true;
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, product: mergeProductSnapshot(item.product, product), quantity: targetQuantity }
            : item
        );
      }
      return [...prev, { product, quantity: targetQuantity }];
    });

    if (didAdd) {
      showNotice("Product added to purchases.", "success");
      return true;
    }

    if (hitLimit) {
      showNotice("Cart limit reached for available stock.", "warning");
    }
    return false;
  };

  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const setItemQuantity = (productId, nextQuantity) => {
    setItems((prev) =>
      prev.flatMap((item) => {
        if (item.product.id !== productId) return [item];
        const stockLimit = Math.max(0, Number(item.product?.quantity || 0));
        const safeQuantity = Math.min(Math.max(0, Number(nextQuantity) || 0), stockLimit);
        if (safeQuantity <= 0) return [];
        return [{ ...item, quantity: safeQuantity }];
      })
    );
  };

  const incrementQuantity = (productId) => {
    const item = items.find((entry) => entry.product.id === productId);
    if (!item) return;
    setItemQuantity(productId, item.quantity + 1);
  };

  const decrementQuantity = (productId) => {
    const item = items.find((entry) => entry.product.id === productId);
    if (!item) return;
    setItemQuantity(productId, item.quantity - 1);
  };

  const setCheckoutDraft = (value) => {
    setCheckoutDraftState((current) => (typeof value === "function" ? value(current) : value));
  };

  const clearCheckoutDraft = () => setCheckoutDraftState(null);

  const startCheckoutFromCart = () => {
    setCheckoutDraftState({
      mode: "cart",
      items,
      customer: null,
      submittedAt: null,
      order: null,
    });
  };

  const startCheckoutFromProduct = (product, quantity = 1) => {
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    setCheckoutDraftState({
      mode: "single",
      items: [{ product, quantity: safeQuantity }],
      customer: null,
      submittedAt: null,
      order: null,
    });
  };

  const clearCart = () => setItems([]);
  const dismissNotice = () => setNotice(DEFAULT_NOTICE);

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      setItemQuantity,
      incrementQuantity,
      decrementQuantity,
      clearCart,
      checkoutDraft,
      setCheckoutDraft,
      clearCheckoutDraft,
      startCheckoutFromCart,
      startCheckoutFromProduct,
      notice,
      dismissNotice,
      count: items.reduce((total, item) => total + item.quantity, 0),
      total: items.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0),
    }),
    [items, checkoutDraft, notice]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
