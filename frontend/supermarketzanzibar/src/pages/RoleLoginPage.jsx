import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage } from "../lib/apiErrors.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const ROLE_CONFIG = {
  customer: {
    title: "Customer Login",
    eyebrow: "Welcome back",
    description: "Sign in to continue shopping, manage your cart, and track your orders.",
    action: "loginCustomer",
    next: "/customer/dashboard",
  },
  admin: {
    title: "Admin Login",
    eyebrow: "System access",
    description: "Use your admin account to manage users, products, and payment approvals.",
    action: "loginAdmin",
    next: "/admin/dashboard",
  },
  supplier: {
    title: "Supplier Login",
    eyebrow: "Inventory access",
    description: "Open your supplier dashboard to add products and maintain stock details.",
    action: "loginSupplier",
    next: "/supplier/dashboard",
  },
  driver: {
    title: "Driver Login",
    eyebrow: "Delivery access",
    description: "Sign in to view assigned deliveries and update drop-off status.",
    action: "loginDriver",
    next: "/driver/dashboard",
  },
};

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser environment is unavailable."));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(window.google), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google sign-in.")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google sign-in."));
    document.head.appendChild(script);
  });
}

function OtpIllustration({ stage }) {
  return (
    <div className={`otp-illustration ${stage}`}>
      {stage === "request" ? (
        <>
          <div className="otp-phone-shell">
            <span className="otp-phone-handset" />
            <span className="otp-phone-card" />
            <span className="otp-phone-dots">******</span>
          </div>
          <div className="otp-pill-row" aria-hidden="true">
            <span className="otp-pill active">Email</span>
            <span className="otp-pill muted">Phone</span>
          </div>
        </>
      ) : (
        <div className="otp-lock-shell" aria-hidden="true">
          <span className="otp-lock-body" />
          <span className="otp-lock-shackle" />
          <span className="otp-lock-hole" />
          <span className="otp-lock-key" />
        </div>
      )}
    </div>
  );
}

function RoleLoginPage({ role }) {
  const config = ROLE_CONFIG[role];
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [otpChallenge, setOtpChallenge] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const otpInputRef = useRef(null);

  const otpDigits = useMemo(() => {
    const chars = otpCode.slice(0, 6).split("");
    while (chars.length < 6) chars.push("");
    return chars;
  }, [otpCode]);

  const finishLogin = () => {
    const fromPath = typeof location.state?.from === "string" ? location.state.from : null;
    navigate(role === "customer" && fromPath ? fromPath : config.next, { replace: true });
  };

  useEffect(() => {
    let active = true;
    if (role !== "customer" || !GOOGLE_CLIENT_ID) {
      setGoogleReady(false);
      return undefined;
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (active) setGoogleReady(true);
      })
      .catch(() => {
        if (active) setGoogleReady(false);
      });

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (otpChallenge) {
      window.setTimeout(() => otpInputRef.current?.focus(), 60);
    }
  }, [otpChallenge]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await auth[config.action](form);
      finishLogin();
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed."));
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = async () => {
    setError("");
    setOtpError("");
    setOtpNotice("");
    setGoogleLoading(true);

    try {
      const google = await loadGoogleIdentityScript();
      if (!GOOGLE_CLIENT_ID) {
        throw new Error("Google sign-in is not configured for this app.");
      }
      if (!google?.accounts?.oauth2) {
        throw new Error("Google sign-in is not available right now.");
      }

      const codeClient = google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        ux_mode: "popup",
        callback: async (response) => {
          if (response.error || !response.code) {
            setError("Google login was cancelled or failed.");
            setGoogleLoading(false);
            return;
          }

          try {
            const challenge = await auth.loginCustomerWithGoogle(response.code);
            setOtpChallenge(challenge);
            setOtpCode("");
            setOtpNotice(challenge.detail || "Verification code sent.");
          } catch (err) {
            setError(getApiErrorMessage(err, "Google login failed."));
          } finally {
            setGoogleLoading(false);
          }
        },
        error_callback: () => {
          setError("Google login was cancelled or blocked.");
          setGoogleLoading(false);
        },
      });

      codeClient.requestCode();
    } catch (err) {
      setError(err.message || "Google login failed.");
      setGoogleLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!otpChallenge?.otp_session) return;

    setOtpLoading(true);
    setOtpError("");
    try {
      await auth.verifyCustomerGoogleOtp({
        otp_session: otpChallenge.otp_session,
        otp_code: otpCode.slice(0, 6),
      });
      setOtpChallenge(null);
      setOtpCode("");
      finishLogin();
    } catch (err) {
      setOtpError(getApiErrorMessage(err, "Verification failed."));
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!otpChallenge?.otp_session) return;
    setOtpLoading(true);
    setOtpError("");
    setOtpNotice("");
    try {
      const challenge = await auth.resendCustomerGoogleOtp({ otp_session: otpChallenge.otp_session });
      setOtpChallenge(challenge);
      setOtpNotice(challenge.detail || "Verification code sent again.");
    } catch (err) {
      setOtpError(getApiErrorMessage(err, "Unable to resend code."));
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <section className="auth-section">
      <form className="auth-card auth-card-premium" onSubmit={onSubmit}>
        <div className="auth-copy">
          <p className="auth-eyebrow">{config.eyebrow}</p>
          <h2>{config.title}</h2>
          <p className="auth-description">{config.description}</p>
        </div>

        <div className="auth-field-list">
          <label className="auth-field">
            <span>Username</span>
            <input
              name="username"
              type="text"
              placeholder="Enter your username"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              required
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
        </div>

        {error ? <p className="error auth-feedback">{error}</p> : null}
        <button className="primary-btn auth-submit" type="submit" disabled={loading}>
          {loading ? "Please wait..." : "Login"}
        </button>

        {role === "customer" ? (
          <>
            <div className="auth-alt-divider" aria-hidden="true">
              <span>or</span>
            </div>
            <button
              className="ghost-btn auth-google-btn"
              type="button"
              onClick={onGoogleLogin}
              disabled={loading || googleLoading || !googleReady}
            >
              {googleLoading ? "Connecting to Google..." : "Continue with Google"}
            </button>
            <p className="auth-footnote">
              No account? <Link to="/register">Register</Link>
            </p>
          </>
        ) : null}
        {role === "admin" ? (
          <p className="auth-footnote">
            First admin? <Link to="/admin/register">Register admin</Link>
          </p>
        ) : null}
      </form>

      {role === "customer" && otpChallenge ? (
        <div className="otp-modal-layer" role="dialog" aria-modal="true" aria-labelledby="otp-modal-title">
          <div className="otp-modal-grid">
            <article className="otp-modal-card">
              <button type="button" className="otp-modal-close" onClick={() => { setOtpChallenge(null); setOtpCode(""); setOtpError(""); setOtpNotice(""); }}>
                ×
              </button>
              <OtpIllustration stage="request" />
              <h3 id="otp-modal-title">Enter Phone Number</h3>
              <p className="otp-modal-copy">
                Google authentication succeeded. We sent a 6-digit code to <strong>{otpChallenge.masked_email || otpChallenge.email}</strong>.
              </p>
              <div className="otp-contact-pill">
                <span className="otp-country-chip">Email</span>
                <span className="otp-contact-value">{otpChallenge.masked_email || otpChallenge.email}</span>
              </div>
              <button type="button" className="otp-primary-btn" onClick={() => setOtpNotice("Check your inbox and enter the code below.")}>
                Send Code
              </button>
              {otpNotice ? <p className="otp-helper-text">{otpNotice}</p> : null}
            </article>

            <article className="otp-modal-card">
              <button type="button" className="otp-modal-close" onClick={() => { setOtpChallenge(null); setOtpCode(""); setOtpError(""); setOtpNotice(""); }}>
                ×
              </button>
              <OtpIllustration stage="verify" />
              <h3>Enter OTP Code</h3>
              <p className="otp-modal-copy">Enter the verification code sent to your email to continue with customer login.</p>
              <form className="otp-verify-form" onSubmit={verifyOtp}>
                <label className="otp-hidden-label" htmlFor="otp-code-input">OTP code</label>
                <input
                  id="otp-code-input"
                  ref={otpInputRef}
                  className="otp-hidden-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <div className="otp-digit-row" aria-hidden="true" onClick={() => otpInputRef.current?.focus()}>
                  {otpDigits.map((digit, index) => (
                    <span key={index} className="otp-digit-box">{digit || ""}</span>
                  ))}
                </div>
                <button type="button" className="otp-link-btn" onClick={resendOtp} disabled={otpLoading}>
                  Resend Code
                </button>
                <button type="submit" className="otp-primary-btn" disabled={otpLoading || otpCode.length !== 6}>
                  {otpLoading ? "Verifying..." : "Verify Code"}
                </button>
              </form>
              {otpError ? <p className="error auth-feedback">{otpError}</p> : null}
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default RoleLoginPage;
