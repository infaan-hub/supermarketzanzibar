const STORE_URL = "https://supermarketzanzibar.vercel.app/";
const QR_IMAGE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(STORE_URL)}`;

function VisaLogo() {
  return (
    <svg viewBox="0 0 64 24" aria-hidden="true" className="store-brand-logo visa-logo">
      <path fill="#1434CB" d="M25.4 16.8l2.2-9.7h3.5l-2.2 9.7zm14.6-9.5c-.7-.3-1.9-.6-3.4-.6-3.7 0-6.2 1.8-6.2 4.4 0 1.9 1.9 3 3.3 3.6 1.5.7 2 1.1 2 1.8 0 .9-1.2 1.4-2.3 1.4-1.5 0-2.4-.2-3.6-.8l-.5-.2-.5 2.9c.9.4 2.5.7 4.2.7 3.9 0 6.5-1.8 6.5-4.5 0-1.5-1-2.7-3.1-3.6-1.3-.6-2.1-1-2.1-1.7 0-.6.8-1.2 2.4-1.2 1.3 0 2.2.2 2.9.5l.4.2zm9.2 9.5h3.1L49.6 7.1h-2.9c-.7 0-1.2.2-1.5.9L40.5 16.8H44l.7-1.9H49zm-3.4-4.3l1.8-4.4 1 4.4zm-25.2-5.4l-3.4 6.6-.4-1.7c-.6-1.8-2.3-3.8-4.2-4.8l3.1 9.6h3.6l5.4-9.7zM7 7.1H1.5l-.1.3c4.3 1 7.2 3.5 8.4 6.4l-1.2-5.8c-.2-.7-.7-.9-1.6-.9" />
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg viewBox="0 0 64 24" aria-hidden="true" className="store-brand-logo mastercard-logo">
      <circle cx="26" cy="12" r="8.4" fill="#EB001B" />
      <circle cx="38" cy="12" r="8.4" fill="#F79E1B" />
      <path fill="#FF5F00" d="M32 4.4a8.3 8.3 0 0 0 0 15.2 8.3 8.3 0 0 0 0-15.2Z" />
    </svg>
  );
}

function StoreQrCard({ className = "" }) {
  return (
    <article className={`store-qr-card${className ? ` ${className}` : ""}`}>
      <div className="store-qr-copy">
        <p className="auth-eyebrow">Store QR</p>
        <h3>Scan To Open Supermarket</h3>
        <p className="muted">Scanning this QR code opens the live store at `supermarketzanzibar.vercel.app`.</p>
        <div className="store-brand-row" aria-label="Accepted payment cards">
          <span className="store-brand-chip">
            <VisaLogo />
          </span>
          <span className="store-brand-chip">
            <MastercardLogo />
          </span>
        </div>
      </div>
      <a className="store-qr-link" href={STORE_URL} target="_blank" rel="noreferrer" aria-label="Open Supermarket store website">
        <img className="store-qr-image" src={QR_IMAGE_URL} alt="QR code for Supermarket store website" />
      </a>
    </article>
  );
}

export default StoreQrCard;
