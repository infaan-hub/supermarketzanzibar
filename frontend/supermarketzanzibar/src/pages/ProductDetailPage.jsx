import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { toMediaUrl } from "../lib/media.jsx";

function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await http.get(`/api/products/${id}/`);
        setProduct(response.data);
      } catch {
        setError("Failed to load product details.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const buyNow = async () => {
    if (user?.role !== "customer") {
      setError("Only customers can buy.");
      return;
    }
    if (!termsAccepted) {
      setError("Accept terms to continue.");
      return;
    }
    try {
      const response = await http.post("/api/customer/checkout/", {
        items: [{ product: product.id, quantity: Number(qty) }],
        payment_method: paymentMethod,
        delivery_location: deliveryLocation,
        terms_accepted: termsAccepted,
      });
      setCheckoutInfo(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Buy now failed.");
    }
  };

  if (loading) return <p className="page-wrap">Loading product...</p>;
  if (!product) return <p className="page-wrap error">{error || "Product not found."}</p>;

  return (
    <section className="page-wrap">
      <div className="product-detail">
        <img src={toMediaUrl(product.image) || "https://placehold.co/800x520?text=No+Image"} alt={product.name} />
        <div>
          <h2>{product.name}</h2>
          <p>{product.description || "No description available."}</p>
          <p className="price">TZS {product.price}</p>
          <p>Available stock: {product.quantity}</p>
          <div className="row">
            <input name="quantity" type="number" min="1" max={product.quantity} value={qty} onChange={(e) => setQty(e.target.value)} />
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                addToCart(product, Number(qty));
                navigate("/cart");
              }}
            >
              Add to Cart
            </button>
            <button type="button" className="accent-btn" onClick={buyNow}>
              Buy Now
            </button>
          </div>
          <select name="payment_method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="mobile_money">Mobile Money</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
          <textarea
            name="delivery_location"
            placeholder="Delivery location (optional)"
            value={deliveryLocation}
            onChange={(e) => setDeliveryLocation(e.target.value)}
          />
          <label className="checkbox-row">
            <input name="terms_accepted" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            I accept terms and payment process.
          </label>
          {checkoutInfo ? (
            <div className="order-card checkout-result">
              <div>
                <h4>Order Created Successfully</h4>
                <p>Order ID: #{checkoutInfo.sale?.id}</p>
                <p>Control Number: {checkoutInfo.payment?.control_number}</p>
                <p className="pending">Payment Status: {checkoutInfo.payment?.status}</p>
                <p>Payment is pending admin confirmation. A request has been sent to admin and details were sent to your email.</p>
              </div>
              <button type="button" className="primary-btn" onClick={() => navigate("/customer/dashboard")}>
                View My Orders
              </button>
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default ProductDetailPage;
