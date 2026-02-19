import { useEffect, useState } from "react";
import { http } from "../api/http.jsx";

function CustomerDashboardPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await http.get("/api/customer/orders/");
        setOrders(response.data);
      } catch {
        setError("Unable to load orders.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="page-wrap">Loading orders...</p>;

  return (
    <section className="page-wrap">
      <h2>Customer Dashboard</h2>
      {error ? <p className="error">{error}</p> : null}
      <div className="order-list">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div>
              <h4>Order #{order.id}</h4>
              <p className="muted">Status: {order.status}</p>
              <p>Control Number: {order.payment?.control_number || "Pending"}</p>
              <p className={order.payment?.status === "confirmed" ? "ok" : "pending"}>
                {order.payment?.status === "confirmed" ? "Payment Confirmed ✓" : "Waiting Admin Confirmation"}
              </p>
            </div>
            <div>
              <p>Total: TZS {order.final_amount}</p>
              <p>Delivery: {order.delivery_location || "Not set"}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default CustomerDashboardPage;
