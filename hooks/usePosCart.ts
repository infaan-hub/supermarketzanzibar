// Shared POS cart state.
//
// Persisted to localStorage so /pos, /shopping-cart, and the header badge
// stay in sync across navigations. Uses authenticated `submitCheckout()`
// and reads the live store tax rate from StoreSettings.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProductDetail, lookupBarcode, submitCheckout } from "@/lib/api";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { decodePickupCode, isPickupCode } from "@/lib/storefront/pickup-code";

export interface CartItem {
  key: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  quantityMultiplier: number;
  unitId: string | null;
  barcode?: string | null;
}

export interface PosProduct {
  id: string;
  name: string;
  price: number | string;
  barcode?: string | null;
}

export interface CustomerForm {
  customerId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

export interface Receipt {
  saleId: string;
  controlNumber: string;
  customerFullName: string;
  customerEmail: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxRatePercent: number;
  grandTotal: number;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  paymentMethod: string;
  createdAt: string;
}

export const CART_KEY = "ss_pos_cart";
export const CART_CHANGE_EVENT = "sz-cart-change";
export const POS_LOG_KEY = "sz_pos_product_log";
const CUSTOMER_KEY = "ss_pos_customer";
const PAYMENT_KEY = "ss_pos_payment";
const DISCOUNT_KEY = "ss_pos_discount";

export interface PosProductLogEntry {
  id: string;
  productId: string;
  productName: string;
  barcode: string | null;
  price: number;
  quantity: number;
  source: "card_tap" | "barcode_scan" | "pickup_qr" | "checkout";
  timestamp: string;
}

const EMPTY_CUSTOMER: CustomerForm = {
  customerId: null,
  fullName: "",
  email: "",
  phone: "",
  address: "",
};

function playBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
    oscillator.onended = () => {
      context.close().catch(() => undefined);
    };
  } catch {
    // Audio is progressive enhancement; ignore errors.
  }
}

function formatMultiplier(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readCartItemCount(): number {
  const items = readJson<CartItem[]>(CART_KEY, []);
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function usePosCart() {
  const { settings } = useStoreSettings();
  const [cart, setCart] = useState<CartItem[]>(() => readJson(CART_KEY, []));
  const [customer, setCustomer] = useState<CustomerForm>(() =>
    readJson(CUSTOMER_KEY, EMPTY_CUSTOMER),
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "mobile_money" | "card" | "bank_transfer"
  >(() => readJson(PAYMENT_KEY, "cash"));
  const [discountInput, setDiscountInput] = useState<string>(() =>
    readJson(DISCOUNT_KEY, ""),
  );
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [posLog, setPosLog] = useState<PosProductLogEntry[]>(() =>
    readJson(POS_LOG_KEY, []),
  );

  const appendPosLog = useCallback(
    (entry: Omit<PosProductLogEntry, "id" | "timestamp">) => {
      const item: PosProductLogEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };
      setPosLog((prev) => {
        const next = [item, ...prev].slice(0, 120);
        try {
          window.localStorage.setItem(POS_LOG_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
      window.dispatchEvent(new Event(CART_CHANGE_EVENT));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    } catch {
      // ignore
    }
  }, [customer]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PAYMENT_KEY, JSON.stringify(paymentMethod));
    } catch {
      // ignore
    }
  }, [paymentMethod]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DISCOUNT_KEY, JSON.stringify(discountInput));
    } catch {
      // ignore
    }
  }, [discountInput]);

  const taxRatePercent = settings.taxRatePercent;
  const taxRate = taxRatePercent / 100;
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const parsedDiscount = Math.max(0, Number(discountInput) || 0);
  const discount = Math.min(parsedDiscount, subtotal);
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = taxableAmount * taxRate;
  const grandTotal = taxableAmount + taxAmount;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addCartLine = useCallback((line: Omit<CartItem, "key" | "quantity">) => {
    const key = `${line.productId}:${line.unitId ?? "each"}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...line, key, quantity: 1 }];
    });
  }, []);

  const addToCart = useCallback(
    (product: PosProduct) => {
      const numericPrice =
        typeof product.price === "string" ? Number(product.price) : product.price;
      addCartLine({
        productId: product.id,
        productName: product.name,
        price: numericPrice,
        quantityMultiplier: 1,
        unitId: null,
        barcode: product.barcode ?? null,
      });
      appendPosLog({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode ?? null,
        price: numericPrice,
        quantity: 1,
        source: "card_tap",
      });
      setScanError(null);
      setScanSuccess(`Added ${product.name} to cart.`);
    },
    [addCartLine, appendPosLog],
  );

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const adjustQuantity = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountInput("");
    setCheckoutError(null);
    setReceipt(null);
    try {
      window.localStorage.removeItem(CART_KEY);
      window.localStorage.removeItem(DISCOUNT_KEY);
      window.dispatchEvent(new Event(CART_CHANGE_EVENT));
    } catch {
      // ignore
    }
  }, []);

  const addBarcodeToCart = useCallback(
    async (rawBarcode: string): Promise<boolean> => {
      const barcode = rawBarcode.trim();
      if (!barcode || scanning || checkingOut) return false;

      setScanning(true);
      setScanError(null);
      setScanSuccess(null);

      try {
        // Express Storefront 3D Pickup QR Code (`SZPICK1:12x2,45x1`):
        // loads all picked products directly using authoritative live DB prices.
        if (isPickupCode(barcode)) {
          const entries = decodePickupCode(barcode);
          if (entries.length === 0) {
            setScanError("Pickup basket code is empty or invalid.");
            return false;
          }
          let loadedUnits = 0;
          let loadedLines = 0;
          for (const entry of entries) {
            try {
              const product = await fetchProductDetail(entry.productId);
              if (!product || !product.isActive) continue;
              const key = `${product.id}:each`;
              const unitPrice = Number(product.price);
              setCart((prev) => {
                const existing = prev.find((i) => i.key === key);
                if (existing) {
                  return prev.map((i) =>
                    i.key === key
                      ? { ...i, quantity: i.quantity + entry.quantity }
                      : i,
                  );
                }
                return [
                  ...prev,
                  {
                    key,
                    productId: product.id,
                    productName: product.name,
                    price: unitPrice,
                    quantity: entry.quantity,
                    quantityMultiplier: 1,
                    unitId: null,
                    barcode: product.barcode ?? null,
                  },
                ];
              });
              loadedLines += 1;
              loadedUnits += entry.quantity;
            } catch {
              // Skip unavailable product IDs without blocking the rest of the basket.
            }
          }
          if (loadedLines === 0) {
            setScanError("No active products matched this pickup basket code.");
            return false;
          }
          playBeep();
          setScanSuccess(
            `Loaded 3D Pickup Basket (${loadedLines} ${loadedLines === 1 ? "item" : "items"}, ${loadedUnits} units).`,
          );
          return true;
        }

        const result = await lookupBarcode(barcode);

        if (!result.inStock) {
          setScanError(
            `${result.product.name} is out of stock (${result.stock} base units).`,
          );
          return false;
        }

        const unitsAlreadyInCart = cart
          .filter((item) => item.productId === result.product.id)
          .reduce((sum, item) => sum + item.quantity * item.quantityMultiplier, 0);

        if (unitsAlreadyInCart + result.packaging.quantityMultiplier > result.stock) {
          setScanError(
            `Only ${result.stock} base units of ${result.product.name} are in stock.`,
          );
          return false;
        }

        addCartLine({
          productId: result.product.id,
          productName: result.product.name,
          price: Number(result.price),
          quantityMultiplier: result.packaging.quantityMultiplier,
          unitId:
            result.packaging.unitId === "each" ? null : result.packaging.unitId,
          barcode: result.barcode,
        });
        appendPosLog({
          productId: result.product.id,
          productName: result.product.name,
          barcode: result.barcode,
          price: Number(result.price),
          quantity: result.packaging.quantityMultiplier,
          source: "barcode_scan",
        });

        const pack =
          result.packaging.quantityMultiplier > 1
            ? ` (${result.packaging.unitId} × ${formatMultiplier(result.packaging.quantityMultiplier)})`
            : "";

        setScanSuccess(`Added ${result.product.name}${pack}.`);
        playBeep();
        return true;
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Barcode lookup failed.");
        return false;
      } finally {
        setScanning(false);
      }
    },
    [addCartLine, appendPosLog, cart, checkingOut, scanning],
  );

  const handleScan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const added = await addBarcodeToCart(scanValue);
    if (added) {
      setScanValue("");
      requestAnimationFrame(() => scanInputRef.current?.focus());
    }
  };

  const handleCheckout = async (): Promise<Receipt | null> => {
    if (cart.length === 0) {
      setCheckoutError("Add at least one item before checkout.");
      return null;
    }

    const cartSnapshot = cart;
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `pos-${crypto.randomUUID()}`
        : `pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setCheckingOut(true);
    setCheckoutError(null);

    try {
      const result = await submitCheckout({
        items: cartSnapshot.map((i) => ({
          productId: i.productId,
          quantity: i.quantity * i.quantityMultiplier,
          price: Number((i.price / i.quantityMultiplier).toFixed(2)),
        })),
        customerId: customer.customerId ?? null,
        customerFullName: customer.fullName.trim() || "Walk-in Customer",
        customerEmail: customer.email.trim() || undefined,
        customerPhone: customer.phone.trim() || undefined,
        customerAddress: customer.address.trim() || undefined,
        paymentMethod,
        taxRatePercent,
        discount,
        idempotencyKey,
      });

      const newReceipt: Receipt = {
        saleId: result.sale.id,
        controlNumber: result.sale.controlNumber,
        customerFullName: result.sale.customerFullName,
        customerEmail: result.sale.customerEmail,
        subtotal: result.sale.subtotal,
        discount: result.sale.discount,
        taxAmount: result.sale.taxAmount,
        taxRatePercent,
        grandTotal: result.sale.grandTotal,
        items: cartSnapshot.map((i) => ({
          productName: i.unitId ? `${i.productName} (${i.unitId})` : i.productName,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        })),
        paymentMethod: result.sale.paymentMethod,
        createdAt: result.sale.createdAt,
      };

      setReceipt(newReceipt);
      try {
        window.localStorage.setItem("ss_receipt", JSON.stringify(newReceipt));
      } catch {
        // ignore
      }

      for (const line of cartSnapshot) {
        appendPosLog({
          productId: line.productId,
          productName: line.productName,
          barcode: line.barcode ?? null,
          price: line.price,
          quantity: line.quantity,
          source: "checkout",
        });
      }

      setCart([]);
      setCustomer(EMPTY_CUSTOMER);
      setDiscountInput("");
      setScanValue("");
      setScanError(null);
      setScanSuccess(null);
      return newReceipt;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed.");
      return null;
    } finally {
      setCheckingOut(false);
    }
  };

  return {
    cart,
    setCart,
    posLog,
    itemCount,
    customer,
    setCustomer,
    paymentMethod,
    setPaymentMethod,
    discountInput,
    setDiscountInput,
    discount,
    taxRatePercent,
    checkingOut,
    receipt,
    setReceipt,
    checkoutError,
    scanError,
    setScanError,
    scanSuccess,
    setScanSuccess,
    scanning,
    scanInputRef,
    scanValue,
    setScanValue,
    handleScan,
    subtotal,
    taxAmount,
    grandTotal,
    addCartLine,
    addToCart,
    removeFromCart,
    adjustQuantity,
    clearCart,
    addBarcodeToCart,
    handleCheckout,
    formatMultiplier,
  };
}
