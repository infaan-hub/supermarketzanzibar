import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { applyImageFallback, productImageUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function CustomerBuyNowPage() {
  const { user } = useAuth();
  const { items, total, clearCart, count } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_full_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    delivery_location: "",
    payment_method: "mobile_money",
    terms_accepted: false,
  });
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [submittedItems, setSubmittedItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      customer_full_name: user?.full_name || "",
      customer_email: user?.email || "",
      customer_phone: user?.phone || "",
      customer_address: user?.address || "",
    }));
  }, [user]);

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!items.length) {
      setError("Your cart is empty.");
      return;
    }
    if (!form.terms_accepted) {
      setError("Accept the terms to continue.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await http.post("/api/customer/checkout/", {
        items: items.map((item) => ({ product: item.product.id, quantity: item.quantity })),
        payment_method: form.payment_method,
        customer_full_name: form.customer_full_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address,
        delivery_location: form.delivery_location,
        terms_accepted: form.terms_accepted,
      });
      setSubmittedItems(items);
      setCheckoutInfo(response.data);
      clearCart();
      if (response.data.whatsapp_url) {
        window.open(response.data.whatsapp_url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to place this order.");
    } finally {
      setLoading(false);
    }
  };

  if (!items.length && !checkoutInfo) {
    return (
      <section className="page-wrap">
        <div className="catalog-empty">
          <h3>No cart items available for checkout.</h3>
          <p>Add products to your cart before opening buy now.</p>
          <Link className="primary-btn" to="/customer/dashboard">
            Go to Customer Dashboard
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-wrap">
      <div className="dashboard-summary">
        <div>
          <p className="home-toolbar-kicker">Customer checkout</p>
          <h2 className="dashboard-title">Buy Now</h2>
          <p className="section-note">Fill your supermarket order form, review products, and submit the order for payment confirmation.</p>
        </div>
        <div className="dashboard-summary-actions">
          <Link className="ghost-btn" to="/customer/cart">
            My Cart ({count})
          </Link>
          <Link className="ghost-btn" to="/customer/history">
            History
          </Link>
        </div>
      </div>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submitOrder}>
          <h3>Customer Information</h3>
          <label className="auth-field">
            <span>Full Name</span>
            <input
              name="customer_full_name"
              value={form.customer_full_name}
              onChange={(event) => setForm((current) => ({ ...current, customer_full_name: event.target.value }))}
              required
            />
          </label>
          <label className="auth-field">
            <span>Email</span>
            <input
              name="customer_email"
              type="email"
              value={form.customer_email}
              onChange={(event) => setForm((current) => ({ ...current, customer_email: event.target.value }))}
              required
            />
          </label>
          <label className="auth-field">
            <span>Phone</span>
            <input
              name="customer_phone"
              value={form.customer_phone}
              onChange={(event) => setForm((current) => ({ ...current, customer_phone: event.target.value }))}
              required
            />
          </label>
          <label className="auth-field">
            <span>Address</span>
            <input
              name="customer_address"
              value={form.customer_address}
              onChange={(event) => setForm((current) => ({ ...current, customer_address: event.target.value }))}
            />
          </label>
          <label className="auth-field">
            <span>Delivery Location</span>
            <textarea
              name="delivery_location"
              placeholder="Optional delivery instructions or location"
              value={form.delivery_location}
              onChange={(event) => setForm((current) => ({ ...current, delivery_location: event.target.value }))}
            />
          </label>
          <label className="auth-field">
            <span>Payment Method</span>
            <select
              name="payment_method"
              value={form.payment_method}
              onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}
            >
              <option value="mobile_money">Mobile Money</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              name="terms_accepted"
              type="checkbox"
              checked={form.terms_accepted}
              onChange={(event) => setForm((current) => ({ ...current, terms_accepted: event.target.checked }))}
            />
            I accept the terms and want this order sent for payment confirmation.
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Order"}
          </button>
        </form>

        <aside className="checkout-summary-card checkout-sidebar">
          <div>
            <p className="home-toolbar-kicker">Order Summary</p>
            <h3>Products</h3>
          </div>
          <div className="cart-list compact">
            {(checkoutInfo ? submittedItems : items).map((item) => (
              <article className="cart-product-card compact" key={item.product.id}>
                <img
                  className="cart-product-image"
                  src={productImageUrl(item.product) || PRODUCT_PLACEHOLDER}
                  alt={item.product.name}
                  data-fallback-src={PRODUCT_PLACEHOLDER}
                  onError={applyImageFallback}
                />
                <div className="cart-product-copy">
                  <h4>{item.product.name}</h4>
                  <p className="muted">Qty: {item.quantity}</p>
                  <p className="product-price">TZS {(Number(item.product.price) * item.quantity).toFixed(2)}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="product-price">Total: TZS {(checkoutInfo?.sale?.final_amount || total).toString()}</p>
          {checkoutInfo ? (
            <div className="checkout-result-card">
              <h4>Order Submitted</h4>
              <p>Order ID: #{checkoutInfo.sale?.id}</p>
              <p>Control Number: {checkoutInfo.payment?.control_number}</p>
              <p className="pending">Status: {checkoutInfo.payment?.status}</p>
              <p>Payment is pending admin confirmation. The order details were prepared for WhatsApp delivery.</p>
              <div className="row">
                <a className="primary-btn" href={checkoutInfo.whatsapp_url} target="_blank" rel="noreferrer">
                  Open WhatsApp
                </a>
                <button type="button" className="ghost-btn" onClick={() => navigate("/customer/history")}>
                  View History
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

export default CustomerBuyNowPage;
