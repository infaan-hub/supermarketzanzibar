import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReceiptPreviewCard from "../components/ReceiptPreviewCard.jsx";
import { http } from "../api/http.jsx";
import { useCart } from "../context/CartContext.jsx";
import { getApiErrorMessage } from "../lib/apiErrors.js";

function ReceiptStatusPage() {
  const navigate = useNavigate();
  const { checkoutDraft, clearCheckoutDraft } = useCart();
  const [latestOrder, setLatestOrder] = useState(checkoutDraft?.order?.sale || null);
  const [loading, setLoading] = useState(Boolean(checkoutDraft?.order?.sale?.id));
  const [error, setError] = useState("");
  const [autoDownloaded, setAutoDownloaded] = useState(false);

  const saleId = checkoutDraft?.order?.sale?.id;

  useEffect(() => {
    if (!saleId) return;

    let active = true;
    const loadOrder = async () => {
      try {
        const response = await http.get("/api/customer/orders/");
        if (!active) return;
        const matchedOrder = response.data.find((order) => order.id === saleId) || null;
        setLatestOrder(matchedOrder);
        setError("");
      } catch (requestError) {
        if (!active) return;
        setError(getApiErrorMessage(requestError, "Unable to load receipt status."));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadOrder();
    const intervalId = window.setInterval(loadOrder, 12000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [saleId]);

  const receiptReady = useMemo(() => Boolean(latestOrder?.receipt_url), [latestOrder]);

  if (!saleId) {
    return (
      <section className="page-wrap">
        <div className="catalog-empty">
          <h3>No receipt session found.</h3>
          <p>Open purchases or buy now again to continue.</p>
          <Link className="showcase-primary-btn" to="/customer/dashboard">
            Customer Dashboard
          </Link>
        </div>
      </section>
    );
  }

  const paymentStatus = latestOrder?.payment_status || latestOrder?.payment?.status || "pending";
  const hasFailed = paymentStatus === "rejected";

  return (
    <section className="page-wrap">
      <div className="checkout-steps">
        <span className="complete">1 Customer Details</span>
        <span className="complete">2 Payment Method</span>
        <span className="active">3 Confirmation</span>
      </div>

      {loading ? <p>Loading receipt status...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {hasFailed ? (
        <div className="receipt-status-card failed">
          <h2>Payment failed</h2>
          <p>Your order could not be confirmed. Return to the customer dashboard and try again.</p>
          <button type="button" className="showcase-primary-btn" onClick={() => { clearCheckoutDraft(); navigate("/customer/dashboard"); }}>
            Return to Dashboard
          </button>
        </div>
      ) : null}

      {!hasFailed && receiptReady && latestOrder ? (
        <div className="receipt-flow-stack">
          <ReceiptPreviewCard order={latestOrder} autoDownload={!autoDownloaded} onAutoDownloadComplete={() => setAutoDownloaded(true)} />
          <div className="receipt-status-card success">
            <h2>Receipt ready</h2>
            <p>Your payment was successful and the receipt is ready now.</p>
            <div className="row">
              <button type="button" className="ghost-btn" onClick={() => clearCheckoutDraft()}>
                Clear Session
              </button>
              <button type="button" className="showcase-primary-btn" onClick={() => navigate("/customer/dashboard")}>
                Return Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!hasFailed && !receiptReady ? (
        <div className="receipt-status-card pending">
          <h2>Receipt is being prepared</h2>
          <p>Your payment request is complete. The receipt will appear here as soon as the order response finishes loading.</p>
          <div className="row">
            <Link className="ghost-btn" to="/customer/history">
              View Order History
            </Link>
            <button type="button" className="showcase-primary-btn" onClick={() => navigate("/customer/dashboard")}>
              Customer Dashboard
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ReceiptStatusPage;
