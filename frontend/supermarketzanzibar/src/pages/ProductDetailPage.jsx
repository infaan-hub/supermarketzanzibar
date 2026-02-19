import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
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
    try {
      await http.post("/api/customer/checkout/", {
        items: [{ product: product.id, quantity: Number(qty) }],
        payment_method: "mobile_money",
        terms_accepted: true,
      });
      navigate("/customer/dashboard");
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Buy now failed."));
    }
  };

  if (loading) return <p className="page-wrap">Loading product...</p>;
  if (!product) return <p className="page-wrap error">{error || "Product not found."}</p>;

  return (
    <section className="page-wrap">
      <div className="product-detail">
        <img src={product.image_url || "https://placehold.co/800x520?text=No+Image"} alt={product.name} />
        <div>
          <h2>{product.name}</h2>
          <p>{product.description || "No description available."}</p>
          <p className="price">TZS {product.price}</p>
          <p>Available stock: {product.quantity}</p>
          <div className="row">
            <input type="number" min="1" max={product.quantity} value={qty} onChange={(e) => setQty(e.target.value)} />
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
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default ProductDetailPage;
