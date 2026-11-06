// Shared POS cart state.
//
// The cart, customer details and payment method are persisted to localStorage
// so the point-of-sale terminal and the dedicated shopping-cart page can
// share one basket across navigations.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lookupBarcode } from "@/lib/api";

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
  taxAmount: number;
  grandTotal: number;
  items: Array<{ productName: string; quantity: number; price: number; total: number }>;
  paymentMethod: string;
  createdAt: string;
}

const CART_KEY = "ss_pos_cart";
const CUSTOMER_KEY = "ss_pos_customer";
const PAYMENT_KEY = "ss_pos_payment";

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

export function usePosCart() {
  const [cart, setCart] = useState<CartItem[]>(() => readJson(CART_KEY, []));
  const [customer, setCustomer] = useState<CustomerForm>(() =>
    readJson(CUSTOMER_KEY, { fullName: "", email: "", phone: "", address: "" }),
  );
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "card">(
    () => readJson(PAYMENT_KEY, "cash"),
  );
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanValue, setScanValue] = useState("");

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
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

  const taxRate = 0.15;
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

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
      addCartLine({
        productId: product.id,
        productName: product.name,
        price:
          typeof product.price === "string" ? Number(product.price) : product.price,
        quantityMultiplier: 1,
        unitId: null,
        barcode: product.barcode ?? null,
      });
    },
    [addCartLine],
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
    setCheckoutError(null);
    setReceipt(null);
    try {
      window.localStorage.removeItem(CART_KEY);
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
        const result = await lookupBarcode(barcode);

        if (!result.inStock) {
          setScanError(
            `${result.product.name} is out of stock at this branch (${result.stock} base units).`,
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

        const pack =
          result.packaging.quantityMultiplier > 1
            ? ` (${result.packaging.unitId} × ${formatMultiplier(result.packaging.quantityMultiplier)})`
            : "";

        setScanSuccess(`Added ${result.product.name}${pack}.`);
        return true;
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Barcode lookup failed.");
        return false;
      } finally {
        setScanning(false);
      }
    },
    [addCartLine, cart, checkingOut, scanning],
  );

  const handleScan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const added = await addBarcodeToCart(scanValue);
    if (added) {
      setScanValue("");
      requestAnimationFrame(() => scanInputRef.current?.focus());
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutError("Add at least one item before checkout.");
      return;
    }
    if (!customer.email || !customer.fullName || !customer.phone) {
      setCheckoutError("Customer name, email, and phone are required.");
      return;
    }

    const cartSnapshot = cart;
    const snapshotSubtotal = cartSnapshot.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const snapshotTax = snapshotSubtotal * taxRate;
    const snapshotTotal = snapshotSubtotal + snapshotTax;

    setCheckingOut(true);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: cartSnapshot.map((i) => ({
            productId: i.productId,
            quantity: i.quantity * i.quantityMultiplier,
            price: Number((i.price / i.quantityMultiplier).toFixed(2)),
          })),
          customerFullName: customer.fullName,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Checkout failed." }));
        setCheckoutError(err.detail || "Checkout failed.");
        return;
      }

      const result = await res.json();
      const serverSubtotal = Number(result.sale?.subtotal ?? snapshotSubtotal);
      const serverTax = Number(result.sale?.taxAmount ?? snapshotTax);
      const serverTotal = Number(result.sale?.grandTotal ?? snapshotTotal);

      setReceipt({
        saleId: result.sale?.id ?? result.id ?? "",
        controlNumber:
          result.sale?.controlNumber ??
          result.payment?.control_number ??
          result.controlNumber ??
          "",
        customerFullName: customer.fullName,
        customerEmail: customer.email,
        subtotal: serverSubtotal,
        taxAmount: serverTax,
        grandTotal: serverTotal,
        items: cartSnapshot.map((i) => ({
          productName: i.unitId ? `${i.productName} (${i.unitId})` : i.productName,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        })),
        paymentMethod,
        createdAt: new Date().toISOString(),
      });

      setCart([]);
      setScanValue("");
      setScanError(null);
      setScanSuccess(null);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setCheckingOut(false);
    }
  };

  return {
    cart,
    setCart,
    customer,
    setCustomer,
    paymentMethod,
    setPaymentMethod,
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
