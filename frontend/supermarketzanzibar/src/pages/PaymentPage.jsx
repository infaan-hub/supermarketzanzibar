import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useCart } from "../context/CartContext.jsx";
import { toMediaUrl } from "../lib/media.jsx";

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

function downloadReceipt(receipt) {
  const barcodeImage = receipt.barcodeImageUrl
    ? `<img class="barcode" src="${receipt.barcodeImageUrl}" alt="Receipt barcode" />`
    : `<div class="barcode-fallback">${receipt.ticketId}</div>`;
  const productImage = receipt.productImageUrl
    ? `<img class="product" src="${receipt.productImageUrl}" alt="${receipt.productName}" />`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${receipt.ticketId}</title><style>body{margin:0;background:#f3f2ff;font-family:Georgia,serif}.card{width:330px;margin:40px auto;padding:34px 34px 24px;background:#fff;border-radius:28px;color:#17151d;text-align:center}.check{width:42px;height:42px;margin:auto;border-radius:50%;background:#6d5df7;color:#fff;line-height:42px;font:700 24px sans-serif}.muted{color:#8f8a99}.line{border-top:1px dashed #ddd;margin:28px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;text-align:left}.label{font-size:11px;color:#aaa;text-transform:uppercase}.value{font-weight:700}.pay{display:flex;gap:12px;align-items:center;margin:28px 0;padding:14px;background:#f6f7ff;border-radius:12px;text-align:left}.product{width:42px;height:42px;object-fit:cover;border-radius:10px}.barcode{width:190px;height:52px;object-fit:contain}.barcode-fallback{font-family:monospace;letter-spacing:3px}.id{font-size:12px;color:#8f8a99}</style></head><body><main class="card"><div class="check">&#10003;</div><h1>Thank you!</h1><p class="muted">Your booking has been issued successfully</p><div class="line"></div><section class="grid"><div><div class="label">Ticket ID</div><div class="value">${receipt.ticketId}</div></div><div><div class="label">Amount</div><div class="value">TZS ${receipt.total}</div></div><div><div class="label">Date & Time</div><div class="value">${receipt.dateTime}</div></div></section><div class="pay">${productImage}<div><strong>${receipt.productName}</strong><br><span class="muted">Zansupermarket Zanzibar</span></div></div>${barcodeImage}<p class="id">${receipt.ticketId}</p></main></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `receipt-${receipt.ticketId}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const [receipt, setReceipt] = useState(null);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const brand = useMemo(() => cardBrand(form.cardNumber), [form.cardNumber]);
  const orderTotal = total.toFixed(2);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (!receipt || autoDownloaded) return;
    downloadReceipt(receipt);
    setAutoDownloaded(true);
  }, [autoDownloaded, receipt]);

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
    const cartSnapshot = items.map((item) => ({ product: item.product, quantity: item.quantity }));
    const snapshotTotal = cartSnapshot.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
    try {
      const response = await http.post("/api/customer/checkout/", {
        items: cartSnapshot.map((item) => ({ product: item.product.id, quantity: item.quantity })),
        payment_method: brand,
        delivery_location: form.deliveryLocation,
        terms_accepted: true,
      });
      const firstProduct = cartSnapshot[0]?.product;
      const payment = response.data.payment || {};
      const sale = response.data.sale || {};
      const ticketId = payment.ticket_id || payment.control_number || String(sale.id || Date.now());
      setPaymentResult(response.data);
      setReceipt({
        ticketId,
        total: snapshotTotal.toFixed(2),
        dateTime: new Date(payment.created_at || sale.created_at || Date.now()).toLocaleString(),
        productName: firstProduct?.name || "Marketplace Product",
        productImageUrl: toMediaUrl(firstProduct?.image_url || firstProduct?.image),
        barcodeImageUrl: payment.barcode_image_url,
        receiptUrl: sale.receipt_url,
      });
      setStatus("paid");
      clearCart();
    } catch (err) {
      setError(err.response?.data?.detail || "Payment could not be completed right now.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="booking-loading-page" aria-live="polite">
        <div className="booking-loader">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <p>LOADING...</p>
        <small>Sending booking securely</small>
      </section>
    );
  }

  if (receipt) {
    return (
      <section className="receipt-page">
        <article className="ticket-receipt-card">
          <div className="receipt-check">OK</div>
          <h2>Thank you!</h2>
          <p className="muted">Your booking has been issued successfully</p>
          <div className="receipt-dash" />
          <div className="receipt-grid">
            <div>
              <span>Ticket ID</span>
              <strong>{receipt.ticketId}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>TZS {receipt.total}</strong>
            </div>
            <div className="receipt-full">
              <span>Date & Time</span>
              <strong>{receipt.dateTime}</strong>
            </div>
          </div>
          <div className="receipt-product-row">
            {receipt.productImageUrl ? <img src={receipt.productImageUrl} alt={receipt.productName} /> : <span />}
            <div>
              <strong>{receipt.productName}</strong>
              <p>Zansupermarket Zanzibar</p>
            </div>
          </div>
          <div className="receipt-barcode-wrap">
            {receipt.barcodeImageUrl ? (
              <img src={receipt.barcodeImageUrl} alt={`Scannable barcode ${receipt.ticketId}`} />
            ) : (
              <div className="barcode-fallback">{receipt.ticketId}</div>
            )}
            <p>{receipt.ticketId}</p>
          </div>
          {paymentResult ? (
            <p className="payment-result-text">
              Order #{paymentResult.sale?.id} created. Control Number: {paymentResult.payment?.control_number || "Pending"}.
            </p>
          ) : null}
          <div className="receipt-actions">
            <button type="button" className="ghost-btn" onClick={() => downloadReceipt(receipt)}>
              Download Receipt
            </button>
            <button type="button" className="primary-btn" onClick={() => navigate("/customer/dashboard")}>
              Return Dashboard
            </button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="payment-page">
      <div className="payment-phone-card">
        <header className="payment-topbar">
          <button type="button" className="payment-icon-btn" onClick={() => navigate("/cart")} aria-label="Back to cart">
            <span aria-hidden="true">&lt;</span>
          </button>
          <h2>Payment Status</h2>
          <button type="button" className="payment-icon-btn" aria-label="Share payment">
            <span aria-hidden="true">^</span>
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
            </div>
          </div>
        </div>

        {error ? <p className="error payment-error">{error}</p> : null}
        <div className="payment-method-row">
          <span>Payment Method</span>
          <strong>{brand === "mastercard" ? "Mastercard" : "Visa"} Ending {form.cardNumber.slice(-4) || "----"}</strong>
          <span className={`card-color-chip ${brand}`} />
        </div>
        <button type="button" className="payment-pay-btn" onClick={submitPayment}>
          Pay Now
        </button>
      </div>
    </section>
  );
}

export default PaymentPage;
