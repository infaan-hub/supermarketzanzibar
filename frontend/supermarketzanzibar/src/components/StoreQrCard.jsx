const STORE_URL = "https://supermarketzanzibar.vercel.app/";
const QR_IMAGE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(STORE_URL)}`;

function VisaLogo() {
  return (
    <svg viewBox="0 0 64 24" aria-hidden="true" className="store-brand-logo visa-logo">
      <path fill="#1A1F71" d="M24.7 20.1h-4.6l2.9-16.2h4.6l-2.9 16.2Zm-6.8-16.2L13.5 15l-.5-2.4-1.5-7c-.2-.9-.5-1.3-1.3-1.6-1.3-.5-3.5-1-5.4-1.3l.1-.7h7.5c1 0 1.8.7 2 1.8l1.9 10.2L21 3.9h4.8l-7.1 16.2h-4.8L9.8 5.4c-.2-.7-.4-.9-.9-1.2-.8-.4-2.1-.8-3.3-1l.1-.7h7.4c1 0 1.8.7 2 1.8l1 5.2 2.5-6.6h4.3Z" />
      <path fill="#1A1F71" d="m44 3.9-3.7 16.2H36c0-.7-.1-1.4-.2-2-.9 1.4-2.3 2.3-4.2 2.3-3.3 0-5.5-2.8-5.5-6.8 0-4.8 3.2-10 9.1-10 1.5 0 2.9.4 3.8 1.7l.2-1.4H44Zm-6.1 7.2c0-2-.9-3.2-2.6-3.2-2.8 0-4.4 3.4-4.4 5.7 0 1.8.8 3.1 2.5 3.1 2.8 0 4.5-3.4 4.5-5.6Z" />
      <path fill="#1A1F71" d="M58.9 4.3c-1-.4-2.5-.8-4.1-.8-4.5 0-7.7 2.4-7.7 5.8 0 2.5 2.3 3.9 4 4.7 1.8.9 2.4 1.5 2.4 2.3 0 1.2-1.5 1.8-2.8 1.8-1.9 0-2.9-.3-4.5-1l-.6-.3-.7 4c1.1.5 3.2.9 5.3.9 4.8 0 7.9-2.3 7.9-5.9 0-2-1.2-3.5-3.8-4.7-1.6-.8-2.6-1.3-2.6-2.2 0-.7.9-1.5 2.6-1.5 1.5 0 2.6.3 3.5.7l.4.2.7-3.8Z" />
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
