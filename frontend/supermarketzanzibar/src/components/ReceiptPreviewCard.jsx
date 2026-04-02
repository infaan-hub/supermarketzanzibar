import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

function formatReceiptAmount(value) {
  const numeric = Number(value || 0);
  return `TZS ${numeric.toLocaleString()}`;
}

function formatReceiptDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildTicketId(order) {
  const controlNumber = String(order.payment_control_number || order.payment?.control_number || "").trim();
  const digitsOnly = controlNumber.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly;

  const createdAt = order.created_at ? new Date(order.created_at) : new Date();
  const year = String(createdAt.getFullYear()).slice(-2);
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const day = String(createdAt.getDate()).padStart(2, "0");
  const orderId = String(order.id || 0).padStart(6, "0");
  return `${year}${month}${day}${orderId}`;
}

function barcodePattern(value) {
  const seed = String(value || "000000");
  return seed
    .split("")
    .map((character) => {
      const digit = Number(character);
      const safeDigit = Number.isNaN(digit) ? 0 : digit;
      return [1, 2, 1, 3, 2, 1].map((width, index) => ((safeDigit + index) % 2 === 0 ? width : 0));
    })
    .flat();
}

async function downloadReceiptJpeg(node, filename) {
  const canvas = await html2canvas(node, {
    backgroundColor: "#eeefff",
    scale: 2,
    useCORS: true,
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/jpeg", 0.95);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function ReceiptPreviewCard({ order, autoDownload = false, onAutoDownloadComplete = null }) {
  const ticketId = useMemo(() => buildTicketId(order), [order]);
  const barcodeBars = useMemo(() => barcodePattern(ticketId), [ticketId]);
  const receiptRef = useRef(null);
  const [downloadState, setDownloadState] = useState({ loading: false, error: "" });

  const handleDownload = async () => {
    if (!receiptRef.current || downloadState.loading) return;

    setDownloadState({ loading: true, error: "" });
    try {
      await downloadReceiptJpeg(receiptRef.current, `receipt-${ticketId}.jpeg`);
      setDownloadState({ loading: false, error: "" });
      onAutoDownloadComplete?.();
    } catch {
      setDownloadState({ loading: false, error: "Unable to download the receipt JPEG right now." });
    }
  };

  useEffect(() => {
    if (!autoDownload || !receiptRef.current) return;
    handleDownload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDownload, ticketId]);

  return (
    <div className="receipt-ticket-wrap">
      <article className="receipt-ticket-card" ref={receiptRef}>
        <div className="receipt-ticket-check">✓</div>
        <h2>Thank you!</h2>
        <p className="receipt-ticket-subtitle">Your ticket has been issued successfully</p>

        <div className="receipt-ticket-divider" />

        <div className="receipt-ticket-meta">
          <div>
            <span>Ticket ID</span>
            <strong>{ticketId}</strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>{formatReceiptAmount(order.final_amount)}</strong>
          </div>
          <div>
            <span>Date & Time</span>
            <strong>{formatReceiptDate(order.created_at)}</strong>
          </div>
        </div>

        <div className="receipt-ticket-product">
          <div className="receipt-ticket-brand-mark" aria-hidden="true">
            <span />
            <span />
          </div>
          <div>
            <strong>{order.customer_name || "Customer"}</strong>
            <p>{(order.items || []).map((item) => item.product_name).filter(Boolean).join(", ") || "Billing package"}</p>
          </div>
        </div>

        <div className="receipt-ticket-barcode">
          <div className="receipt-ticket-bars" aria-label={`Barcode ${ticketId}`}>
            {barcodeBars.map((bar, index) =>
              bar ? <span key={`${ticketId}-${index}`} style={{ width: `${bar}px` }} /> : <em key={`${ticketId}-${index}`} style={{ width: "1px" }} />
            )}
          </div>
          <p>{ticketId}</p>
        </div>

        <div className="receipt-ticket-edge" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </article>

      <div className="receipt-ticket-actions">
        <button type="button" className="showcase-primary-btn" onClick={handleDownload} disabled={downloadState.loading}>
          {downloadState.loading ? "Downloading..." : "Download Receipt JPEG"}
        </button>
      </div>
      {downloadState.error ? <p className="error">{downloadState.error}</p> : null}
    </div>
  );
}

export default ReceiptPreviewCard;
