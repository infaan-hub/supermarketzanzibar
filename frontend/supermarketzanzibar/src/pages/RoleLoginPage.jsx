import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const ROLE_CONFIG = {
  customer: { title: "Customer Login", action: "loginCustomer", next: "/customer/dashboard" },
  admin: { title: "Admin Login", action: "loginAdmin", next: "/admin/dashboard" },
  supplier: { title: "Supplier Login", action: "loginSupplier", next: "/supplier/dashboard" },
  driver: { title: "Driver Login", action: "loginDriver", next: "/driver/dashboard" },
};

function RoleLoginPage({ role }) {
  const config = ROLE_CONFIG[role];
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await auth[config.action](form);
      navigate(config.next, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-section">
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>{config.title}</h2>
        <input
          type="text"
          placeholder="Username"
          value={form.username}
          onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />
        {error ? <p className="error">{error}</p> : null}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Please wait..." : "Login"}
        </button>
        {role === "customer" ? (
          <p>
            No account? <Link to="/register">Register</Link>
          </p>
        ) : null}
        {role === "admin" ? (
          <p>
            First admin? <Link to="/admin/register">Register admin</Link>
          </p>
        ) : null}
      </form>
    </section>
  );
}

export default RoleLoginPage;
