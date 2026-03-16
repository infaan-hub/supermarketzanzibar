import { useEffect } from "react";
import { useCart } from "../context/CartContext.jsx";

const CART_NOTICE_LIFETIME_MS = 2400;

function CartNoticeCenter() {
  const { notice, dismissNotice } = useCart();

  useEffect(() => {
    if (!notice?.id || !notice.message) return undefined;

    const timeoutId = window.setTimeout(() => dismissNotice(), CART_NOTICE_LIFETIME_MS);
    return () => window.clearTimeout(timeoutId);
  }, [dismissNotice, notice]);

  if (!notice?.id || !notice.message) return null;

  return (
    <div className={`cart-notice cart-notice-${notice.kind}`} role="status" aria-live="polite">
      <p>{notice.message}</p>
      <button type="button" className="cart-notice-dismiss" aria-label="Dismiss cart notice" onClick={dismissNotice}>
        x
      </button>
    </div>
  );
}

export default CartNoticeCenter;
