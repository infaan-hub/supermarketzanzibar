import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useCart } from "../context/CartContext.jsx";

function formatCardNumber(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function cardBrand(cardNumber) {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.startsWith("5")) return "mastercard";
  return "visa";
}

function PaymentPage() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    cardNumber: "",
    cardHolder: "",
    expiry: "",
    cvv: "",
    deliveryLocation: "",
  });
  const [status, setStatus] = useState("unpaid");
  const [paymentResult, setPaymentResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const brand = useMemo(() => cardBrand(form.cardNumber), [form.cardNumber]);
  const orderTotal = total.toFixed(2);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitPayment = async () => {
    if (!items.length) {
      setError("Your cart is empty.");
      return;
    }
    if (!form.cardNumber || !form.cardHolder || !form.expiry || !form.cvv) {
      setError("Fill in all payment card details.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await http.post("/api/customer/checkout/", {
        items: items.map((item) => ({ product: item.product.id, quantity: item.quantity })),
        payment_method: brand,
        delivery_location: form.deliveryLocation,
        terms_accepted: true,
      });
      setPaymentResult(response.data);
      setStatus("paid");
      clearCart();
    } catch (err) {
      setError(err.response?.data?.detail || "Payment could not be completed right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="payment-page">
      <div className="payment-phone-card">
        <header className="payment-topbar">
          <button type="button" className="payment-icon-btn" onClick={() => navigate("/cart")} aria-label="Back to cart">
            <span aria-hidden="true">←</span>
          </button>
          <h2>Payment Status</h2>
          <button type="button" className="payment-icon-btn" aria-label="Share payment">
            <span aria-hidden="true">↗</span>
          </button>
        </header>

        <div className="payment-invoice">
          <div className="invoice-printer" />
          <div className="invoice-paper">
            <p className="invoice-title">Order Invoice - Zansupermarket</p>
            <div className="invoice-row">
              <span>Total</span>
              <strong>TZS {orderTotal}</strong>
            </div>
            <div className="invoice-row">
              <span>Items</span>
              <strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
            </div>

            <div className="payment-gateway-panel">
              <div className="gateway-heading">
                <span>Payment Gateway</span>
                <strong>{brand === "mastercard" ? "Mastercard" : "Visa"}</strong>
              </div>
              <div className="gateway-card-brand-row" aria-label="Supported payment cards">
                <span className={`gateway-brand ${brand === "visa" ? "active" : ""}`}>Visa</span>
                <span className={`gateway-brand mastercard ${brand === "mastercard" ? "active" : ""}`}>Mastercard</span>
              </div>
              <label>
                Card Number
                <input
                  inputMode="numeric"
                  name="card_number"
                  placeholder="4242 4242 4242 4242"
                  value={form.cardNumber}
                  onChange={(event) => updateForm("cardNumber", formatCardNumber(event.target.value))}
                />
              </label>
              <label>
                Cardholder Name
                <input
                  name="card_holder"
                  placeholder="Full name"
                  value={form.cardHolder}
                  onChange={(event) => updateForm("cardHolder", event.target.value)}
                />
              </label>
              <div className="gateway-form-grid">
                <label>
                  Expiry
                  <input
                    name="card_expiry"
                    placeholder="MM/YY"
                    value={form.expiry}
                    onChange={(event) => updateForm("expiry", event.target.value.slice(0, 5))}
                  />
                </label>
                <label>
                  CVV
                  <input
                    inputMode="numeric"
                    name="card_cvv"
                    placeholder="123"
                    value={form.cvv}
                    onChange={(event) => updateForm("cvv", event.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </label>
              </div>
              <label>
                Delivery Location
                <input
                  name="delivery_location"
                  placeholder="Delivery location optional"
                  value={form.deliveryLocation}
                  onChange={(event) => updateForm("deliveryLocation", event.target.value)}
                />
              </label>
            </div>

            <div className="payment-progress-card">
              <div className="gateway-heading">
                <span>Payment Status</span>
                <strong>{status.toUpperCase()}</strong>
              </div>
              <div className={`payment-progress ${status}`}>
                <span />
                <span />
                <span />
                <span />
              </div>
              {paymentResult ? (
                <p className="payment-result-text">
                  Order #{paymentResult.sale?.id} created. Control Number: {paymentResult.payment?.control_number || "Pending"}.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {error ? <p className="error payment-error">{error}</p> : null}
        <div className="payment-method-row">
          <span>Payment Method</span>
          <strong>{brand === "mastercard" ? "Mastercard" : "Visa"} Ending {form.cardNumber.slice(-4) || "----"}</strong>
          <span className={`card-color-chip ${brand}`} />
        </div>
        <button type="button" className="payment-pay-btn" onClick={submitPayment} disabled={loading || status === "paid"}>
          {loading ? "Processing..." : status === "paid" ? "Paid" : "Pay Now"}
        </button>
      </div>
    </section>
  );
}

export default PaymentPage;
