import { useEffect, useState } from "react";
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

function PasswordEyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12C4.8 7.9 8.1 5.8 12 5.8s7.2 2.1 9.5 6.2C19.2 16.1 15.9 18.2 12 18.2S4.8 16.1 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.9" />
      {!visible ? <path d="M4 20L20 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /> : null}
    </svg>
  );
}

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

function RoleLoginPage({ role }) {
  const config = ROLE_CONFIG[role];
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState("");

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
        if (active) {
          setGoogleReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, [role]);

  const finishLogin = () => {
    const fromPath = typeof location.state?.from === "string" ? location.state.from : null;
    navigate(role === "customer" && fromPath ? fromPath : config.next, { replace: true });
  };

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
            await auth.loginCustomerWithGoogle(response.code);
            finishLogin();
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
            <div className="auth-password-input">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
              />
              <button
                type="button"
                className="ghost-btn auth-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                <PasswordEyeIcon visible={showPassword} />
              </button>
            </div>
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
          </>
        ) : null}

        {role === "customer" ? (
          <p className="auth-footnote">
            No account? <Link to="/register">Register</Link>
          </p>
        ) : null}
      </form>
    </section>
  );
}

export default RoleLoginPage;
