import { useEffect, useState } from "react";
import { http } from "../api/http.jsx";

function AdminDashboardPage() {
  const [payments, setPayments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sales, setSales] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    phone: "",
    address: "",
    role: "supplier",
    password: "",
    password_confirm: "",
    company_name: "",
    profile_image: null,
  });

  const loadData = async () => {
    try {
      const [paymentRes, userRes, salesRes] = await Promise.all([
        http.get("/api/payments/"),
        http.get("/api/users/"),
        http.get("/api/sales/"),
      ]);
      setPayments(paymentRes.data);
      setDrivers(userRes.data.filter((user) => user.role === "driver"));
      setSales(salesRes.data);
    } catch {
      setError("Failed to load admin data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setError("");
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== null && value !== undefined) data.append(key, value);
    });
    try {
      await http.post("/api/auth/admin/create-user/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({
        username: "",
        email: "",
        full_name: "",
        phone: "",
        address: "",
        role: "supplier",
        password: "",
        password_confirm: "",
        company_name: "",
        profile_image: null,
      });
      await loadData();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Cannot create user."));
    }
  };

  const confirmPayment = async (id) => {
    try {
      await http.post(`/api/payments/${id}/confirm/`);
      await loadData();
    } catch {
      setError("Payment confirmation failed.");
    }
  };

  const assignDriver = async (saleId, driverId) => {
    if (!driverId) return;
    try {
      await http.post(`/api/sales/${saleId}/assign_driver/`, { driver_id: Number(driverId) });
      await loadData();
    } catch {
      setError("Assign driver failed.");
    }
  };

  return (
    <section className="page-wrap two-col">
      <div className="panel">
        <h2>Create Supplier/Driver/Customer</h2>
        <form onSubmit={createUser}>
          <input required placeholder="Username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
          <input required placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          <input required placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            <option value="supplier">Supplier</option>
            <option value="driver">Driver</option>
            <option value="customer">Customer</option>
          </select>
          <input placeholder="Company name (supplier)" value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} />
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, profile_image: e.target.files?.[0] || null }))} />
          <input type="password" required placeholder="Password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          <input type="password" required placeholder="Confirm password" value={form.password_confirm} onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))} />
          <button className="primary-btn" type="submit">Create User</button>
        </form>
      </div>

      <div className="panel">
        <h2>Pending Payments</h2>
        {payments.map((payment) => (
          <article key={payment.id} className="order-card">
            <div>
              <p>#{payment.control_number}</p>
              <p>Status: {payment.status}</p>
            </div>
            {payment.status !== "confirmed" ? (
              <button className="primary-btn" onClick={() => confirmPayment(payment.id)} type="button">
                Confirm
              </button>
            ) : (
              <span className="ok">Confirmed ✓</span>
            )}
          </article>
        ))}
      </div>

      <div className="panel full-span">
        <h2>Assign Drivers</h2>
        {sales.map((sale) => (
          <article key={sale.id} className="order-card">
            <div>
              <p>Order #{sale.id}</p>
              <p>Status: {sale.status}</p>
            </div>
            <select defaultValue="" onChange={(e) => assignDriver(sale.id, e.target.value)}>
              <option value="">Assign Driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </select>
          </article>
        ))}
      </div>
      {error ? <p className="error full-span">{error}</p> : null}
    </section>
  );
}

export default AdminDashboardPage;
