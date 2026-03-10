import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

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
      const details = err.response?.data;
      setError(typeof details === "string" ? details : JSON.stringify(details || "Register failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-section">
      <form className="auth-card auth-card-premium" onSubmit={onSubmit}>
        <div className="auth-copy">
          <p className="auth-eyebrow">{isAdmin ? "Secure onboarding" : "Create your account"}</p>
          <h2>{isAdmin ? "Admin Register" : "Customer Register"}</h2>
          <p className="auth-description">
            {isAdmin
              ? "Register a premium admin account for platform control, user management, and operations."
              : "Create a polished customer account to shop faster, track orders, and manage your profile."}
          </p>
        </div>

        <div className="auth-grid">
          <label className="auth-field">
            <span>Username</span>
            <input type="text" placeholder="Choose a username" required value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
          </label>
          <label className="auth-field">
            <span>Email</span>
            <input type="email" placeholder="name@example.com" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </label>
          <label className="auth-field">
            <span>Full Name</span>
            <input type="text" placeholder="Your full name" required value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          </label>
          <label className="auth-field">
            <span>Phone</span>
            <input type="text" placeholder="Phone number" required value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </label>
          <label className="auth-field auth-field-wide">
            <span>Address</span>
            <input type="text" placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </label>
          <label className="auth-field auth-field-wide">
            <span>Profile Image</span>
            <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, profile_image: e.target.files?.[0] || null }))} />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input type="password" placeholder="Create password" required value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </label>
          <label className="auth-field">
            <span>Confirm Password</span>
            <input type="password" placeholder="Repeat password" required value={form.password_confirm} onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))} />
          </label>
        </div>

        {error ? <p className="error auth-feedback">{error}</p> : null}
        <button className="primary-btn auth-submit" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Register"}
        </button>

        <p className="auth-footnote">
          Already registered?{" "}
          <Link to={isAdmin ? "/admin/login" : "/login"}>Login</Link>
        </p>
      </form>
    </section>
  );
}

export default RegisterPage;
