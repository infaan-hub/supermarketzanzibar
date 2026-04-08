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

function VisaLogo() {
  return (
    <svg viewBox="0 0 64 24" aria-hidden="true" className="card-brand-logo visa-logo">
      <path fill="#1434CB" d="M25.4 16.8l2.2-9.7h3.5l-2.2 9.7zm14.6-9.5c-.7-.3-1.9-.6-3.4-.6-3.7 0-6.2 1.8-6.2 4.4 0 1.9 1.9 3 3.3 3.6 1.5.7 2 1.1 2 1.8 0 .9-1.2 1.4-2.3 1.4-1.5 0-2.4-.2-3.6-.8l-.5-.2-.5 2.9c.9.4 2.5.7 4.2.7 3.9 0 6.5-1.8 6.5-4.5 0-1.5-1-2.7-3.1-3.6-1.3-.6-2.1-1-2.1-1.7 0-.6.8-1.2 2.4-1.2 1.3 0 2.2.2 2.9.5l.4.2zm9.2 9.5h3.1L49.6 7.1h-2.9c-.7 0-1.2.2-1.5.9L40.5 16.8H44l.7-1.9H49zm-3.4-4.3l1.8-4.4 1 4.4zm-25.2-5.4l-3.4 6.6-.4-1.7c-.6-1.8-2.3-3.8-4.2-4.8l3.1 9.6h3.6l5.4-9.7zM7 7.1H1.5l-.1.3c4.3 1 7.2 3.5 8.4 6.4l-1.2-5.8c-.2-.7-.7-.9-1.6-.9"/>
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg viewBox="0 0 64 24" aria-hidden="true" className="card-brand-logo mastercard-logo">
      <circle cx="25" cy="12" r="8.5" fill="#EB001B" />
      <circle cx="39" cy="12" r="8.5" fill="#F79E1B" />
      <path fill="#FF5F00" d="M32 5.2a8.4 8.4 0 0 0 0 13.6 8.4 8.4 0 0 0 0-13.6" />
    </svg>
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function downloadReceipt(receipt) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const [productImage, barcodeImage] = await Promise.all([
    loadImage(receipt.productImageUrl).catch(() => null),
    loadImage(receipt.barcodeImageUrl).catch(() => null),
  ]);

  ctx.fillStyle = "#f3f2ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cardX = 150;
  const cardY = 150;
  const cardWidth = 600;
  const cardHeight = 1060;
  const radius = 28;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(105, 96, 145, 0.16)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.beginPath();
  ctx.moveTo(cardX + radius, cardY);
  ctx.arcTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + cardHeight, radius);
  ctx.arcTo(cardX + cardWidth, cardY + cardHeight, cardX, cardY + cardHeight, radius);
  ctx.arcTo(cardX, cardY + cardHeight, cardX, cardY, radius);
  ctx.arcTo(cardX, cardY, cardX + cardWidth, cardY, radius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 6; i += 1) {
    const notchX = cardX + 60 + (i * 96);
    ctx.beginPath();
    ctx.arc(notchX, cardY + cardHeight, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(450, 238, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(436, 238);
  ctx.lineTo(446, 250);
  ctx.lineTo(468, 224);
  ctx.stroke();

  ctx.fillStyle = "#17151d";
  ctx.font = "700 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Thank you!", 450, 332);
  ctx.fillStyle = "#8f8a99";
  ctx.font = "400 28px Arial";
  ctx.fillText("Your ticket has been issued", 450, 378);
  ctx.fillText("successfully", 450, 414);

  ctx.strokeStyle = "#d9d6e3";
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(210, 488);
  ctx.lineTo(690, 488);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "left";
  ctx.fillStyle = "#aaa4b6";
  ctx.font = "700 20px Arial";
  ctx.fillText("TICKET ID", 200, 560);
  ctx.fillText("DATE & TIME", 200, 675);
  ctx.fillText("Amount", 560, 560);

  ctx.fillStyle = "#1e1a25";
  ctx.font = "700 34px Arial";
  ctx.fillText(receipt.ticketId, 200, 600);
  ctx.fillText(receipt.dateTime, 200, 715);
  ctx.fillText(`TZS ${receipt.total}`, 560, 600);

  ctx.fillStyle = "#f6f7ff";
  ctx.beginPath();
  ctx.roundRect(200, 770, 500, 86, 18);
  ctx.fill();
  ctx.fillStyle = "#1e1a25";
  ctx.font = "700 28px Arial";
  ctx.fillText(receipt.productName, 316, 815);
  ctx.fillStyle = "#8f8a99";
  ctx.font = "600 24px Arial";
  ctx.fillText("Supermarket Zanzibar", 316, 846);
  if (productImage) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(220, 788, 56, 56, 14);
    ctx.clip();
    ctx.drawImage(productImage, 220, 788, 56, 56);
    ctx.restore();
  }

  ctx.strokeStyle = "#ece9f5";
  ctx.beginPath();
  ctx.moveTo(200, 920);
  ctx.lineTo(700, 920);
  ctx.stroke();

  if (barcodeImage) {
    ctx.drawImage(barcodeImage, 255, 960, 390, 120);
  } else {
    ctx.fillStyle = "#111111";
    ctx.fillRect(255, 990, 390, 70);
  }
  ctx.fillStyle = "#8f8a99";
  ctx.font = "500 22px Arial";
  ctx.textAlign = "center";
  ctx.fillText(receipt.ticketId, 450, 1110);

  const url = canvas.toDataURL("image/jpeg", 0.94);
  const link = document.createElement("a");
  link.href = url;
  link.download = `receipt-${receipt.ticketId}.jpeg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function PaymentPage() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    cardNumber: "",
    cardHolder: "",
    expiry: "",
    cvv: "",
    brand: "visa",
    wantsDelivery: false,
    deliveryLocation: "",
  });
  const [status, setStatus] = useState("unpaid");
  const [paymentResult, setPaymentResult] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inferredBrand = useMemo(() => cardBrand(form.cardNumber), [form.cardNumber]);
  const brand = form.brand || inferredBrand;
  const orderTotal = total.toFixed(2);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const chooseBrand = (nextBrand) => {
    setForm((current) => ({ ...current, brand: nextBrand }));
  };

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError("This browser cannot access current location.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateForm(
          "deliveryLocation",
          `Current location: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
        );
        updateForm("wantsDelivery", true);
      },
      () => {
        setError("Current location could not be retrieved. Please allow location permission or enter the address manually.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!receipt || autoDownloaded) return;
    downloadReceipt(receipt).finally(() => setAutoDownloaded(true));
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
    if (form.wantsDelivery && !form.deliveryLocation.trim()) {
      setError("Enter a delivery location or use your current location.");
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
        delivery_location: form.wantsDelivery ? form.deliveryLocation.trim() : "",
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
          <div className="receipt-check">✓</div>
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
              <p>Supermarket Zanzibar</p>
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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h2>Payment Status</h2>
          <button type="button" className="payment-icon-btn" aria-label="Share payment">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 5h5v5" />
              <path d="M10 14L19 5" />
              <path d="M19 13v5h-14v-14h5" />
            </svg>
          </button>
        </header>

        <div className="payment-invoice">
          <div className="invoice-printer" />
          <div className="invoice-paper">
            <p className="invoice-title">Order Invoice - Supermarket</p>
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
                <button
                  type="button"
                  className={`gateway-brand ${brand === "visa" ? "active" : ""}`}
                  onClick={() => chooseBrand("visa")}
                >
                  <VisaLogo />
                  <span>Visa</span>
                </button>
                <button
                  type="button"
                  className={`gateway-brand mastercard ${brand === "mastercard" ? "active" : ""}`}
                  onClick={() => chooseBrand("mastercard")}
                >
                  <MastercardLogo />
                  <span>Mastercard</span>
                </button>
              </div>
              <label>
                Card Number
                <input
                  inputMode="numeric"
                  name="card_number"
                  placeholder="4242 4242 4242 4242"
                  value={form.cardNumber}
                  onChange={(event) => {
                    const nextValue = formatCardNumber(event.target.value);
                    updateForm("cardNumber", nextValue);
                    const detectedBrand = cardBrand(nextValue);
                    if (detectedBrand) updateForm("brand", detectedBrand);
                  }}
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
              <div className="delivery-panel">
                <label className="delivery-toggle">
                  <input
                    type="checkbox"
                    name="wants_delivery"
                    checked={form.wantsDelivery}
                    onChange={(event) => updateForm("wantsDelivery", event.target.checked)}
                  />
                  <span>Need delivery?</span>
                </label>
                {form.wantsDelivery ? (
                  <div className="delivery-fields">
                    <div className="delivery-field-row">
                      <button type="button" className="ghost-btn" onClick={useCurrentLocation}>
                        Use Present Location
                      </button>
                      <span className="muted">Driver receives this delivery location automatically after payment.</span>
                    </div>
                    <label>
                      Delivery Location
                      <input
                        name="delivery_location"
                        placeholder="Enter address or landmark for delivery"
                        value={form.deliveryLocation}
                        onChange={(event) => updateForm("deliveryLocation", event.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <p className="muted">Pickup is selected. Turn on delivery only if the driver should bring the order to you.</p>
                )}
              </div>
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
          <span className={`card-logo-chip ${brand}`}>{brand === "mastercard" ? <MastercardLogo /> : <VisaLogo />}</span>
        </div>
        <button type="button" className="payment-pay-btn" onClick={submitPayment}>
          Pay Now
        </button>
      </div>
    </section>
  );
}

export default PaymentPage;
