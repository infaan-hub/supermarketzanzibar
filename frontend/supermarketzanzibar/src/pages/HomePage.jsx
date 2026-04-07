import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { applyImageFallback, toMediaUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

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
      <header className="marketplace-return" aria-label="Marketplace quick actions">
        <h1>Marketplace</h1>
        <div className="marketplace-actions">
          <a className="market-action-btn" href="#products" aria-label="Search products">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="5.5" />
              <path d="M15 15l4 4" />
            </svg>
          </a>
          <a className="market-action-btn" href="#products" aria-label="Filter products">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14" />
              <path d="M8 12h8" />
              <path d="M11 17h2" />
            </svg>
          </a>
          <a className="market-action-btn" href="#products" aria-label="View products">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="5" width="5" height="5" rx="1" />
              <rect x="14" y="5" width="5" height="5" rx="1" />
              <rect x="5" y="14" width="5" height="5" rx="1" />
              <rect x="14" y="14" width="5" height="5" rx="1" />
            </svg>
          </a>
        </div>
      </header>
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
              <img
                src={toMediaUrl(product.image) || PRODUCT_PLACEHOLDER}
                alt={product.name}
                data-fallback-src={PRODUCT_PLACEHOLDER}
                onError={applyImageFallback}
              />
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
