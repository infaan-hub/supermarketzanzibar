import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { http } from "../api/http.jsx";
import { useCart } from "../context/CartContext.jsx";
import { applyImageFallback, toMediaUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function productListFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function CustomerDashboardPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const [ordersResult, productsResult] = await Promise.allSettled([
        http.get("/api/customer/orders/"),
        http.get("/api/products/"),
      ]);

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value.data);
      }
      if (productsResult.status === "fulfilled") {
        setProducts(productListFromResponse(productsResult.value.data));
      }
      if (ordersResult.status === "rejected" || productsResult.status === "rejected") {
        setError("Some dashboard data could not load. Please refresh if products or orders are missing.");
      }
      setLoading(false);
    };
    load();
  }, []);

  const addProductToCart = (product) => {
    addToCart(product, 1);
    navigate("/cart");
  };

  if (loading) return <p className="page-wrap">Loading customer dashboard...</p>;

  return (
    <section className="page-wrap">
      <h2>Customer Dashboard</h2>
      {error ? <p className="error">{error}</p> : null}
      <div className="dashboard-section">
        <div className="section-heading-row">
          <div>
            <h3 id="customer-products" className="section-title">Shop Products</h3>
            <p className="muted">All marketplace products are unlocked for your customer account.</p>
          </div>
          <Link className="ghost-btn" to="/cart">Open Cart</Link>
        </div>
        <div className="grid-products product-grid customer-product-grid">
          {products.map((product) => (
            <article className="product-card customer-product-card" key={product.id}>
              <button type="button" className="product-card-open" onClick={() => navigate(`/products/${product.id}`)}>
                <span className="sr-only">Open {product.name}</span>
              </button>
              <div className="card-image">
                <img
                  src={toMediaUrl(product.image_url || product.image) || PRODUCT_PLACEHOLDER}
                  alt={product.name}
                  data-fallback-src={PRODUCT_PLACEHOLDER}
                  onError={applyImageFallback}
                />
              </div>
              <div className="card-body">
                <h3 className="product-title">{product.name}</h3>
                <div className="product-meta-row">
                  <span className="product-chip">{product.category_name || "General"}</span>
                  <span className="product-price">TZS {product.price}</span>
                </div>
                <div className="product-card-actions">
                  <button type="button" className="product-action-btn buy" onClick={() => navigate(`/products/${product.id}`)}>
                    View / Buy
                  </button>
                  <button type="button" className="product-action-btn" onClick={() => addProductToCart(product)}>
                    Add Cart
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!products.length && !error ? <p className="muted">No products available yet.</p> : null}
      </div>
      <div className="dashboard-section">
        <h3 className="section-title">My Orders</h3>
        <div className="order-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div>
                <h4>Order #{order.id}</h4>
                <p className="muted">Status: {order.status}</p>
                <p>Control Number: {order.payment_control_number || order.payment?.control_number || "Pending"}</p>
                <p className={(order.payment_status || order.payment?.status) === "confirmed" ? "ok" : "pending"}>
                  {(order.payment_status || order.payment?.status) === "confirmed"
                    ? "Payment Confirmed"
                    : "Payment Pending"}
                </p>
              </div>
              <div>
                <p>Total: TZS {order.final_amount}</p>
                <p>Delivery: {order.delivery_location || "Not set"}</p>
                <div className="row">
                  {(order.items || []).map((item) => (
                    <Link key={`${order.id}-${item.id}`} className="ghost-btn" to={`/products/${item.product}`}>
                      {item.product_name || `Product ${item.product}`}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        {!orders.length ? <p className="muted">You do not have orders yet.</p> : null}
      </div>
    </section>
  );
}

export default CustomerDashboardPage;
