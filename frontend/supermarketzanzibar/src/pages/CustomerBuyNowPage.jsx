import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { applyImageFallback, productImageUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function CustomerBuyNowPage() {
  const { user } = useAuth();
  const { checkoutDraft, setCheckoutDraft, clearCheckoutDraft, startCheckoutFromCart, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_full_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    needs_delivery: false,
    delivery_location: "",
    delivery_date: "",
    delivery_time: "",
  });
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");

  const draftItems = checkoutDraft?.items?.length ? checkoutDraft.items : [];
  const total = useMemo(
    () => draftItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
    [draftItems]
  );

  useEffect(() => {
    if (!checkoutDraft?.items?.length && cartItems.length) {
      startCheckoutFromCart();
    }
  }, [cartItems.length, checkoutDraft?.items?.length, startCheckoutFromCart]);

  useEffect(() => {
    setForm((current) => ({
      customer_full_name: checkoutDraft?.customer?.customer_full_name ?? user?.full_name ?? current.customer_full_name,
      customer_email: checkoutDraft?.customer?.customer_email ?? user?.email ?? current.customer_email,
      customer_phone: checkoutDraft?.customer?.customer_phone ?? user?.phone ?? current.customer_phone,
      customer_address: checkoutDraft?.customer?.customer_address ?? user?.address ?? current.customer_address,
      needs_delivery: checkoutDraft?.customer?.needs_delivery ?? current.needs_delivery,
      delivery_location: checkoutDraft?.customer?.delivery_location ?? current.delivery_location,
      delivery_date: checkoutDraft?.customer?.delivery_date ?? current.delivery_date,
      delivery_time: checkoutDraft?.customer?.delivery_time ?? current.delivery_time,
    }));
  }, [checkoutDraft?.customer, user]);

  const saveAndContinue = (event) => {
    event.preventDefault();
    if (!draftItems.length) {
      setError("No products are ready for checkout.");
      return;
    }
    if (!form.customer_full_name || !form.customer_phone || !form.customer_address) {
      setError("Name, phone, and address are required.");
      return;
    }

    setCheckoutDraft((current) => ({
      ...(current || {}),
      items: draftItems,
      customer: {
        ...form,
        delivery_location: form.needs_delivery ? form.delivery_location : "",
        delivery_date: form.needs_delivery ? form.delivery_date : "",
        delivery_time: form.needs_delivery ? form.delivery_time : "",
      },
      order: null,
    }));
    navigate("/billing");
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setGeoLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setForm((current) => ({
          ...current,
          needs_delivery: true,
          delivery_location: `Current location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        }));
        setGeoLoading(false);
      },
      () => {
        setError("Location access was not allowed. Enter the delivery location manually.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (!draftItems.length) {
    return (
      <section className="page-wrap">
        <div className="catalog-empty">
          <h3>No products ready for buy.</h3>
          <p>Add products to purchases first, or use Buy Now from a product card.</p>
          <div className="row">
            <Link className="ghost-btn" to="/customer/dashboard">
              Back to Dashboard
            </Link>
            <Link className="showcase-primary-btn" to="/purchases">
              Open Purchases
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-wrap">
      <div className="checkout-shell">
        <div className="checkout-steps">
          <span className="active">1 Customer Details</span>
          <span>2 Payment Method</span>
          <span>3 Confirmation</span>
        </div>

        <div className="checkout-stage-grid">
          <form id="customer-buy-form" className="checkout-stage-card" onSubmit={saveAndContinue}>
            <div className="checkout-stage-header">
              <p className="home-toolbar-kicker">Customer details</p>
              <h2>Buy</h2>
              <p className="section-note">Tell us who is ordering and whether this needs delivery.</p>
            </div>

            <label className="auth-field">
              <span>Name</span>
              <input
                value={form.customer_full_name}
                onChange={(event) => setForm((current) => ({ ...current, customer_full_name: event.target.value }))}
                required
              />
            </label>
            <label className="auth-field">
              <span>Phone</span>
              <input
                value={form.customer_phone}
                onChange={(event) => setForm((current) => ({ ...current, customer_phone: event.target.value }))}
                required
              />
            </label>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={form.customer_email}
                onChange={(event) => setForm((current) => ({ ...current, customer_email: event.target.value }))}
              />
            </label>
            <label className="auth-field">
              <span>Address</span>
              <textarea
                value={form.customer_address}
                onChange={(event) => setForm((current) => ({ ...current, customer_address: event.target.value }))}
                required
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.needs_delivery}
                onChange={(event) => setForm((current) => ({ ...current, needs_delivery: event.target.checked }))}
              />
              I need delivery
            </label>

            {form.needs_delivery ? (
              <div className="delivery-panel">
                <div className="row">
                  <button type="button" className="ghost-btn" onClick={useCurrentLocation} disabled={geoLoading}>
                    {geoLoading ? "Getting location..." : "Use My Location"}
                  </button>
                </div>
                <label className="auth-field">
                  <span>Delivery Location</span>
                  <textarea
                    placeholder="Add location manually if you do not want to allow current location."
                    value={form.delivery_location}
                    onChange={(event) => setForm((current) => ({ ...current, delivery_location: event.target.value }))}
                  />
                </label>
                <div className="billing-inline-grid">
                  <label className="auth-field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={form.delivery_date}
                      onChange={(event) => setForm((current) => ({ ...current, delivery_date: event.target.value }))}
                    />
                  </label>
                  <label className="auth-field">
                    <span>Time</span>
                    <input
                      type="time"
                      value={form.delivery_time}
                      onChange={(event) => setForm((current) => ({ ...current, delivery_time: event.target.value }))}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {error ? <p className="error">{error}</p> : null}
            <div className="row">
              <button type="button" className="ghost-btn" onClick={() => { clearCheckoutDraft(); navigate("/purchases"); }}>
                Back to Purchases
              </button>
              <button type="submit" className="showcase-primary-btn">
                Continue to Billing
              </button>
            </div>
          </form>

          <aside className="checkout-stage-card checkout-order-card">
            <div className="checkout-stage-header">
              <p className="home-toolbar-kicker">Products</p>
              <h3>{draftItems.length} product{draftItems.length > 1 ? "s" : ""} selected</h3>
            </div>
            <div className="purchase-list compact">
              {draftItems.map((item) => (
                <article className="purchase-card compact" key={item.product.id}>
                  <img
                    className="cart-product-image"
                    src={productImageUrl(item.product) || PRODUCT_PLACEHOLDER}
                    alt={item.product.name}
                    data-fallback-src={PRODUCT_PLACEHOLDER}
                    onError={applyImageFallback}
                  />
                  <div className="purchase-card-copy">
                    <h3>{item.product.name}</h3>
                    <p>Qty: {item.quantity}</p>
                    <strong>TZS {(Number(item.product.price) * item.quantity).toFixed(2)}</strong>
                  </div>
                </article>
              ))}
            </div>
            <div className="purchase-summary-inline">
              <span>Total items: {draftItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
              <strong>TZS {total.toFixed(2)}</strong>
            </div>
            <button type="submit" form="customer-buy-form" className="showcase-primary-btn">
              Continue to Billing
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default CustomerBuyNowPage;
