import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useCart } from "../context/CartContext.jsx";
import { getApiErrorMessage } from "../lib/apiErrors.js";

const PAYMENT_OPTIONS = [
  { value: "mobile_money", label: "Mastercard", accent: "sunset" },
  { value: "bank_transfer", label: "Visa", accent: "ocean" },
  { value: "paypal", label: "PayPal", accent: "sky" },
  { value: "cash", label: "Cash on Delivery", accent: "stone" },
];

function BillingPage() {
  const navigate = useNavigate();
  const { checkoutDraft, clearCheckoutDraft, clearCart, setCheckoutDraft } = useCart();
  const [paymentMethod, setPaymentMethod] = useState(checkoutDraft?.payment?.payment_method || "mobile_money");
  const [cardForm, setCardForm] = useState({
    card_number: "",
    card_holder: "",
    expiry_month: "",
    expiry_year: "",
    cvv: "",
  });
  const [saveDetails, setSaveDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const draftItems = checkoutDraft?.items || [];
  const customer = checkoutDraft?.customer || null;
  const totals = useMemo(() => {
    const subtotal = draftItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
    const deliveryFee = customer?.needs_delivery ? 5 : 0;
    return {
      subtotal,
      deliveryFee,
      grandTotal: subtotal + deliveryFee,
    };
  }, [customer?.needs_delivery, draftItems]);

  const confirmPayment = async () => {
    if (!draftItems.length || !customer) {
      navigate("/buy", { replace: true });
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await http.post("/api/customer/checkout/", {
        items: draftItems.map((item) => ({ product: item.product.id, quantity: item.quantity })),
        payment_method: paymentMethod,
        customer_full_name: customer.customer_full_name,
        customer_email: customer.customer_email,
        customer_phone: customer.customer_phone,
        customer_address: customer.customer_address,
        delivery_location: customer.needs_delivery ? customer.delivery_location : "",
        terms_accepted: true,
      });

      clearCart();
      setCheckoutDraft((current) => ({
        ...(current || {}),
        payment: {
          payment_method: paymentMethod,
          save_details: saveDetails,
        },
        order: response.data,
        submittedAt: new Date().toISOString(),
      }));
      navigate("/receipt");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Payment failed."));
    } finally {
      setLoading(false);
    }
  };

  if (!draftItems.length || !customer) {
    return null;
  }

  return (
    <section className="page-wrap">
      <div className="billing-shell">
        <div className="checkout-steps">
          <span className="complete">1 Customer Details</span>
          <span className="active">2 Payment Method</span>
          <span>3 Confirmation</span>
        </div>

        <div className="billing-card">
          <div className="payment-method-grid">
            {PAYMENT_OPTIONS.map((option) => (
              <label key={option.value} className={`payment-method-option payment-method-${option.accent}`}>
                <input
                  type="radio"
                  name="payment_method"
                  value={option.value}
                  checked={paymentMethod === option.value}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                />
                <span className="payment-method-logo">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="billing-form-grid">
            <label className="auth-field">
              <span>Card number</span>
              <input
                value={cardForm.card_number}
                onChange={(event) => setCardForm((current) => ({ ...current, card_number: event.target.value }))}
                placeholder="0000 0000 0000 0000"
              />
            </label>
            <label className="auth-field">
              <span>Cardholder</span>
              <input
                value={cardForm.card_holder}
                onChange={(event) => setCardForm((current) => ({ ...current, card_holder: event.target.value }))}
                placeholder="Full name"
              />
            </label>
            <label className="auth-field">
              <span>Expiry date</span>
              <div className="billing-inline-grid">
                <input
                  value={cardForm.expiry_month}
                  onChange={(event) => setCardForm((current) => ({ ...current, expiry_month: event.target.value }))}
                  placeholder="Month"
                />
                <input
                  value={cardForm.expiry_year}
                  onChange={(event) => setCardForm((current) => ({ ...current, expiry_year: event.target.value }))}
                  placeholder="Year"
                />
              </div>
            </label>
            <label className="auth-field">
              <span>CVV</span>
              <input
                value={cardForm.cvv}
                onChange={(event) => setCardForm((current) => ({ ...current, cvv: event.target.value }))}
                placeholder="000"
              />
            </label>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={saveDetails} onChange={(event) => setSaveDetails(event.target.checked)} />
            Save my details for future purchases
          </label>

          <div className="billing-summary-table">
            <div>
              <span>Subtotal ({draftItems.length} items)</span>
              <strong>TZS {totals.subtotal.toFixed(2)}</strong>
            </div>
            <div>
              <span>Home delivery cost</span>
              <strong>TZS {totals.deliveryFee.toFixed(2)}</strong>
            </div>
            <div className="total-row">
              <span>Total amount</span>
              <strong>TZS {totals.grandTotal.toFixed(2)}</strong>
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="row">
            <button type="button" className="ghost-btn" onClick={() => navigate("/buy")}>
              Back
            </button>
            <button type="button" className="billing-confirm-btn" onClick={confirmPayment} disabled={loading}>
              {loading ? "Confirming..." : "Confirm Payment"}
            </button>
          </div>
          <button type="button" className="billing-cancel-link" onClick={() => { clearCheckoutDraft(); navigate("/customer/dashboard"); }}>
            Cancel and return to customer dashboard
          </button>
        </div>
      </div>
    </section>
  );
}

export default BillingPage;
