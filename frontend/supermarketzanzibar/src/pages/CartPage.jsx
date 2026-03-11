import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

function CartPage() {
  const { items, removeFromCart, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checkout = async () => {
    if (user?.role !== "customer") {
      setError("Only customers can checkout.");
      return;
    }
    if (!items.length) {
      setError("Cart is empty.");
      return;
    }
    if (!termsAccepted) {
      setError("Accept terms to continue.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await http.post("/api/customer/checkout/", {
        items: items.map((item) => ({ product: item.product.id, quantity: item.quantity })),
        payment_method: paymentMethod,
        delivery_location: deliveryLocation,
        terms_accepted: termsAccepted,
      });
      setCheckoutInfo(response.data);
      clearCart();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        const missingMatch = detail.match(/^Product\s+(\d+)\s+not found\.$/i);
        if (missingMatch) {
          removeFromCart(Number(missingMatch[1]));
          setError(`Product ${missingMatch[1]} was removed or deleted. It has been removed from your cart.`);
        } else {
          setError(detail);
        }
      } else {
        setError("Checkout failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-wrap">
      <h2>Your Cart</h2>
      {!items.length ? <p>No items in cart.</p> : null}
      <div className="order-list">
        {items.map((item) => (
          <article className="order-card" key={item.product.id}>
            <div>
              <h4>{item.product.name}</h4>
              <p className="muted">
                Qty: {item.quantity} x TZS {item.product.price}
              </p>
            </div>
            <button type="button" className="ghost-btn" onClick={() => removeFromCart(item.product.id)}>
              Remove
            </button>
          </article>
        ))}
      </div>
      <p className="price">Total: TZS {total.toFixed(2)}</p>
      <select name="payment_method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
        <option value="mobile_money">Mobile Money</option>
        <option value="cash">Cash</option>
        <option value="bank_transfer">Bank Transfer</option>
      </select>
      <textarea
        name="delivery_location"
        placeholder="Delivery location (optional)"
        value={deliveryLocation}
        onChange={(e) => setDeliveryLocation(e.target.value)}
      />
      <label className="checkbox-row">
        <input name="terms_accepted" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        I accept the terms and proceed to payment.
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary-btn" type="button" disabled={loading} onClick={checkout}>
        {loading ? "Processing..." : "Checkout"}
      </button>
      {checkoutInfo ? (
        <div className="order-card checkout-result">
          <div>
            <h4>Order Created Successfully</h4>
            <p>Order ID: #{checkoutInfo.sale?.id}</p>
            <p>Control Number: {checkoutInfo.payment?.control_number}</p>
            <p className="pending">Payment Status: {checkoutInfo.payment?.status}</p>
            <p>Payment is pending admin confirmation. A request has been sent to admin and details were sent to your email.</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => navigate("/customer/dashboard")}>
            View My Orders
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default CartPage;
