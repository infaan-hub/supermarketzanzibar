import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { toMediaUrl } from "../lib/media.jsx";

function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await http.get("/api/products/");
        setProducts(response.data);
      } catch {
        setError("Failed to load products.");
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const openProduct = (productId) => {
    if (!isAuthenticated) {
      alert("Please login first to open product details.");
      navigate("/login", { state: { from: `/products/${productId}` } });
      return;
    }
    navigate(`/products/${productId}`);
  };

  return (
    <section className="page-wrap">
      <div className="hero">
        <div className="hero-content">
          <h1>Live Minimarket Zanzibar</h1>
          <p>Fresh groceries, pantry staples and household essentials.</p>
          <p className="hero-desc">Touch any product to open full details, add to cart, or buy now.</p>
          <a className="hero-cta" href="#products">
            Shop Now
          </a>
        </div>
      </div>
      {loading ? <p>Loading products...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <h2 id="products" className="section-title">Products</h2>
      <div className="grid-products product-grid">
        {products.map((product) => (
          <article
            className="product-card"
            key={product.id}
            role="button"
            tabIndex={0}
            onClick={() => openProduct(product.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openProduct(product.id);
            }}
          >
            <div className="card-image">
              <img src={toMediaUrl(product.image) || "https://placehold.co/600x380?text=No+Image"} alt={product.name} />
            </div>
            <div className="card-body">
              <h3 className="product-title">{product.name}</h3>
              <p className="muted">{product.category_name || "General"}</p>
              <p className="product-price">TZS {product.price}</p>
            </div>
          </article>
        ))}
      </div>
      {!isAuthenticated ? (
        <p className="callout">
          New customer? <Link to="/register">Create account</Link> to open products, add cart, and checkout.
        </p>
      ) : null}
    </section>
  );
}

export default HomePage;
