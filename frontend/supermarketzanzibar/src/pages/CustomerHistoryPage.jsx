import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../api/http.jsx";
import ReceiptPreviewCard from "../components/ReceiptPreviewCard.jsx";

function CustomerHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await http.get("/api/customer/orders/");
        setOrders(response.data);
      } catch {
        setError("Unable to load order history.");
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  return (
    <section className="page-wrap">
      <div className="dashboard-summary">
        <div>
          <p className="home-toolbar-kicker">Customer history</p>
          <h2 className="dashboard-title">Order History</h2>
          <p className="section-note">Track every order, payment status, delivery note, and receipt download from one place.</p>
        </div>
        <div className="dashboard-summary-actions">
          <Link className="ghost-btn" to="/customer/dashboard">
            Customer Dashboard
          </Link>
          <Link className="primary-btn" to="/customer/cart">
            My Cart
          </Link>
        </div>
      </div>

      {loading ? <p>Loading order history...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !orders.length ? (
        <div className="catalog-empty">
          <h3>No order history yet.</h3>
          <p>Your confirmed and pending customer orders will appear here.</p>
        </div>
      ) : null}

      <div className="order-history-list">
        {orders.map((order) => (
          order.receipt_url ? (
            <ReceiptPreviewCard key={order.id} order={order} />
          ) : (
            <article className="order-card order-history-card" key={order.id}>
              <div>
                <h4>Order #{order.id}</h4>
                <p>Control Number: {order.payment_control_number || order.payment?.control_number || "Pending"}</p>
                <p className={(order.payment_status || order.payment?.status) === "confirmed" ? "ok" : "pending"}>
                  {(order.payment_status || order.payment?.status) === "confirmed" ? "Payment Confirmed" : "Payment Pending"}
                </p>
                <p className="muted">Delivery: {order.delivery_location || "Not provided"}</p>
                <p className="muted">Customer: {order.customer_name}</p>
              </div>
              <div className="order-history-meta">
                <p>Total: TZS {order.final_amount}</p>
                <div className="row">
                  {(order.items || []).map((item) => (
                    <Link key={`${order.id}-${item.id}`} className="ghost-btn" to={`/products/${item.product}`}>
                      {item.product_name || `Product ${item.product}`}
                    </Link>
                  ))}
                </div>
                <span className="muted">Receipt will be shown here after payment confirmation.</span>
              </div>
            </article>
          )
        ))}
      </div>
    </section>
  );
}

export default CustomerHistoryPage;
