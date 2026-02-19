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
      await http.post("/api/customer/checkout/", {
        items: items.map((item) => ({ product: item.product.id, quantity: item.quantity })),
        payment_method: "mobile_money",
        delivery_location: deliveryLocation,
        terms_accepted: termsAccepted,
      });
      clearCart();
      navigate("/customer/dashboard");
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Checkout failed."));
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
      <textarea
        placeholder="Delivery location (optional)"
        value={deliveryLocation}
        onChange={(e) => setDeliveryLocation(e.target.value)}
      />
      <label className="checkbox-row">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        I accept the terms and proceed to payment.
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary-btn" type="button" disabled={loading} onClick={checkout}>
        {loading ? "Processing..." : "Checkout"}
      </button>
    </section>
  );
}

export default CartPage;
