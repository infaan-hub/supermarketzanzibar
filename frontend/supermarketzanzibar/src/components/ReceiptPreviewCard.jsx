import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useRef, useState } from "react";
import productPlaceholder from "../assets/product-placeholder.svg";
import { applyImageFallback, saleItemImageUrl } from "../lib/media.jsx";
import { ABOUT_CARDS, CONTACT_ITEMS, STORE_NAME, STORE_SUBTITLE } from "../lib/storeInfo.js";

const PRODUCT_PLACEHOLDER = productPlaceholder;

async function waitForReceiptAssets(node) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const finish = () => {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            resolve();
          };

          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        }),
    ),
  );
}

function saveReceiptCanvasAsPdf(canvas, filename) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imageHeight = (canvas.height * contentWidth) / canvas.width;
  const imageData = canvas.toDataURL("image/png");
  let heightLeft = imageHeight;
  let yPosition = margin;

  pdf.addImage(imageData, "PNG", margin, yPosition, contentWidth, imageHeight, undefined, "FAST");
  heightLeft -= contentHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    yPosition = margin - (imageHeight - heightLeft);
    pdf.addImage(imageData, "PNG", margin, yPosition, contentWidth, imageHeight, undefined, "FAST");
    heightLeft -= contentHeight;
  }

  pdf.save(filename);
}

function AboutIcon({ kind }) {
  if (kind === "supply") {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M14 19.5L24 12l10 7.5V32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V19.5Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M19 24h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 19v10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "search") {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="21" cy="21" r="9" stroke="currentColor" strokeWidth="2.4" />
        <path d="M27.5 27.5L35 35" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M21 17v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M17 21h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M14 16h3l2.2 11.2a2 2 0 0 0 2 1.6h10.8a2 2 0 0 0 2-1.5L36 20H20.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="34" r="2.6" fill="currentColor" />
      <circle cx="32" cy="34" r="2.6" fill="currentColor" />
      <path d="M31 13v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M28 16h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptPreviewCard({ order }) {
  const orderDate = order.created_at ? new Date(order.created_at).toLocaleString() : "Not provided";
  const receiptRef = useRef(null);
  const [downloadState, setDownloadState] = useState({ loading: false, error: "" });

  const downloadReceipt = async () => {
    if (!receiptRef.current || downloadState.loading) return;

    setDownloadState({ loading: true, error: "" });

    try {
      await waitForReceiptAssets(receiptRef.current);
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#edf6ee",
        imageTimeout: 15000,
        logging: false,
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true,
      });

      saveReceiptCanvasAsPdf(canvas, `zansupermarket-receipt-order-${order.id}.pdf`);
      setDownloadState({ loading: false, error: "" });
    } catch {
      setDownloadState({ loading: false, error: "Unable to download the receipt right now." });
    }
  };

  return (
    <article ref={receiptRef} className="receipt-preview-card">
      <header className="receipt-preview-header">
        <div className="receipt-preview-brand">
          <p className="receipt-preview-kicker">Official Customer Receipt</p>
          <h3>{STORE_NAME}</h3>
          <p>{STORE_SUBTITLE}</p>
        </div>
        <div className="receipt-preview-status">
          <span>Payment Confirmed</span>
          <strong>Control #{order.payment_control_number || order.payment?.control_number}</strong>
          <p>Order #{order.id}</p>
        </div>
      </header>

      <section className="receipt-preview-panel">
        <div className="receipt-preview-section">
          <div className="receipt-preview-section-title">Customer & Order Details</div>
          <div className="receipt-preview-detail-grid">
            <div>
              <span>Customer</span>
              <strong>{order.customer_name || "Customer"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{order.customer_email || "Not provided"}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{order.customer_phone || "Not provided"}</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>{order.customer_address || "Not provided"}</strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>{order.delivery_location || "Not provided"}</strong>
            </div>
            <div>
              <span>Order Date</span>
              <strong>{orderDate}</strong>
            </div>
          </div>
        </div>

        <div className="receipt-preview-section receipt-preview-total-box">
          <div className="receipt-preview-section-title">Payment</div>
          <p className="receipt-preview-total-label">Status</p>
          <p className="receipt-preview-status-text">Confirmed</p>
          <p className="receipt-preview-total-label">Final Amount</p>
          <p className="receipt-preview-total-amount">TZS {order.final_amount}</p>
        </div>
      </section>

      <section className="receipt-preview-section">
        <div className="receipt-preview-section-title">Paid Products</div>
        <div className="receipt-preview-items">
          {(order.items || []).map((item) => (
            <article className="receipt-preview-item" key={`${order.id}-${item.id}`}>
              <img
                src={saleItemImageUrl(item) || PRODUCT_PLACEHOLDER}
                alt={item.product_name || `Product ${item.product}`}
                crossOrigin="anonymous"
                data-fallback-src={PRODUCT_PLACEHOLDER}
                onError={applyImageFallback}
              />
              <div className="receipt-preview-item-copy">
                <h4>{item.product_name || `Product ${item.product}`}</h4>
                <p>Quantity: {item.quantity}</p>
                <p>Unit Price: TZS {item.price}</p>
                <p className="product-price">Paid Total: TZS {item.total}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="receipt-preview-section">
        <div className="receipt-preview-section-title">About Us</div>
        <div className="receipt-preview-info-grid">
          {ABOUT_CARDS.map((card) => (
            <article className="receipt-preview-info-card" key={card.title}>
              <div className="receipt-preview-info-icon">
                <AboutIcon kind={card.icon} />
              </div>
              <h4>{card.title}</h4>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="receipt-preview-section">
        <div className="receipt-preview-section-title">Contact Us</div>
        <div className="receipt-preview-contact-list">
          {CONTACT_ITEMS.map((item) => (
            <a key={item.label} className="receipt-preview-contact-item" href={item.href}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </a>
          ))}
        </div>
      </section>

      <div className="receipt-preview-actions">
        <p>This receipt is available because the payment for this order has been confirmed.</p>
        <button type="button" className="primary-btn" onClick={downloadReceipt} disabled={downloadState.loading}>
          {downloadState.loading ? "Downloading..." : "Download Receipt PDF"}
        </button>
      </div>
      {downloadState.error ? <p className="error">{downloadState.error}</p> : null}
    </article>
  );
}

export default ReceiptPreviewCard;
