import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function GoogleIcon() {
  return (
    <span className="google-auth-icon" aria-hidden="true">
      G
    </span>
  );
}

function GoogleAuthPanel({ enabled = true, next = "/customer/dashboard" }) {
  const { startGoogleLogin, verifyGoogleOtp } = useAuth();
  const navigate = useNavigate();
  const codeClientRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSession, setOtpSession] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response.credential) {
              setError("Google did not return a sign-in credential.");
              return;
            }
            setLoading(true);
            setError("");
            try {
              const otpResponse = await startGoogleLogin(response.credential);
              setOtpSession(otpResponse.otp_session);
              setMessage(`Verification code sent to ${otpResponse.masked_email || "your email"}.`);
            } catch (err) {
              setError(err.response?.data?.detail || "Google sign in failed.");
            } finally {
              setLoading(false);
            }
          },
        });
        codeClientRef.current = window.google.accounts.id;
        setReady(true);
      })
      .catch(() => setError("Google sign in could not load. Check your connection."));

    return () => {
      cancelled = true;
    };
  }, [enabled, startGoogleLogin]);

  const startGoogle = () => {
    setError("");
    setMessage("");
    if (!enabled) {
      setError("Google sign in is available for customer accounts only.");
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign in needs VITE_GOOGLE_CLIENT_ID.");
      return;
    }
    codeClientRef.current?.prompt();
  };

  const submitOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await verifyGoogleOtp({ otp_session: otpSession, otp_code: otpCode });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="google-auth-panel">
      <button className="google-auth-btn" type="button" onClick={startGoogle} disabled={loading || (enabled && !ready && Boolean(GOOGLE_CLIENT_ID))}>
        <GoogleIcon />
        <span>{loading ? "Please wait..." : "Continue with Google"}</span>
      </button>

      {otpSession ? (
        <div className="google-otp-form">
          <input
            name="google_otp_code"
            inputMode="numeric"
            maxLength="6"
            placeholder="Enter email code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            required
          />
          <button className="google-otp-submit" type="button" onClick={submitOtp} disabled={loading || otpCode.length < 6}>
            Verify
          </button>
        </div>
      ) : null}

      {message ? <p className="ok auth-feedback">{message}</p> : null}
      {error ? <p className="error auth-feedback">{error}</p> : null}
    </div>
  );
}

export default GoogleAuthPanel;
