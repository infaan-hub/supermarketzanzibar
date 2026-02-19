import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function RegisterPage({ mode = "customer" }) {
  const { registerCustomer, registerAdmin } = useAuth();
  const navigate = useNavigate();
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
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>{mode === "admin" ? "Admin Register" : "Customer Register"}</h2>
        <input type="text" placeholder="Username" required value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
        <input type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <input type="text" placeholder="Full name" required value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
        <input type="text" placeholder="Phone" required value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        <input type="text" placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, profile_image: e.target.files?.[0] || null }))} />
        <input type="password" placeholder="Password" required value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        <input type="password" placeholder="Confirm password" required value={form.password_confirm} onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))} />
        {error ? <p className="error">{error}</p> : null}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Register"}
        </button>
        <p>
          Already registered?{" "}
          <Link to={mode === "admin" ? "/admin/login" : "/login"}>
            Login
          </Link>
        </p>
      </form>
    </section>
  );
}

export default RegisterPage;
