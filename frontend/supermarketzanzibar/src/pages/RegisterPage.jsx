import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function formatApiError(err) {
  if (err?.code === "ECONNABORTED") {
    return "Request timed out. Backend may be waking up on Render. Please retry in a few seconds.";
  }
  if (!err?.response) {
    return "Network/CORS error. Check backend CORS and that API is online.";
  }
  const data = err.response.data;
  if (typeof data === "string") return data;
  if (data?.detail && typeof data.detail === "string") return data.detail;
  if (typeof data === "object" && data !== null) {
    const firstKey = Object.keys(data)[0];
    const firstValue = data[firstKey];
    if (Array.isArray(firstValue) && firstValue.length) return `${firstKey}: ${firstValue[0]}`;
    if (typeof firstValue === "string") return `${firstKey}: ${firstValue}`;
  }
  return "Register failed.";
}

function RegisterPage({ mode = "customer" }) {
  const { registerCustomer, registerAdmin } = useAuth();
  const navigate = useNavigate();
  const isAdmin = mode === "admin";
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    phone: "",
    address: "",
    password: "",
    password_confirm: "",
    profile_image: null,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== null && value !== undefined) payload.append(key, value);
    });
    try {
      if (mode === "admin") {
        await registerAdmin(payload);
        navigate("/admin/login");
      } else {
        await registerCustomer(payload);
        navigate("/login");
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-section">
      <div className="auth-portal-shell">
        <div className="auth-portal-hero auth-portal-hero-register">
          <span className="auth-portal-badge">{isAdmin ? "Admin Portal" : "Customer Portal"}</span>
          <h1>{isAdmin ? "Register Admin" : "Register Here"}</h1>
          <p>
            {isAdmin
              ? "Create a secure admin account for platform control and operations."
              : "Create your account to shop, track orders, and manage your profile."}
          </p>
          <span className="auth-portal-orb auth-portal-orb-left" aria-hidden="true" />
          <span className="auth-portal-orb auth-portal-orb-right" aria-hidden="true" />
        </div>

        <form className="auth-card auth-card-premium auth-portal-card auth-portal-card-register" onSubmit={onSubmit}>
          <div className="auth-grid auth-portal-grid">
            <label className="auth-field auth-portal-field">
              <input name="username" type="text" placeholder="Username" required value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
            </label>
            <label className="auth-field auth-portal-field">
              <input name="email" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </label>
            <label className="auth-field auth-portal-field">
              <input name="full_name" type="text" placeholder="Full Name" required value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
            </label>
            <label className="auth-field auth-portal-field">
              <input name="phone" type="text" placeholder="Phone" required value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </label>
            <label className="auth-field auth-field-wide auth-portal-field">
              <input name="address" type="text" placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </label>
            <label className="auth-field auth-field-wide auth-portal-field auth-portal-file-field">
              <span>Profile Image</span>
              <input name="profile_image" type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, profile_image: e.target.files?.[0] || null }))} />
            </label>
            <label className="auth-field auth-portal-field">
              <input name="password" type="password" placeholder="Password" required value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </label>
            <label className="auth-field auth-portal-field">
              <input name="password_confirm" type="password" placeholder="Confirm Password" required value={form.password_confirm} onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))} />
            </label>
          </div>

          {error ? <p className="error auth-feedback">{error}</p> : null}
          <button className="primary-btn auth-submit auth-portal-submit" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Register"}
          </button>

          <p className="auth-footnote auth-portal-footnote">
            Already registered?{" "}
            <Link to={isAdmin ? "/admin/login" : "/login"}>Login</Link>
          </p>
        </form>
      </div>
    </section>
  );
}

export default RegisterPage;
