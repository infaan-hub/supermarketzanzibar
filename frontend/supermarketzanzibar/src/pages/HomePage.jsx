import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";

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

  return (
    <section className="page-wrap">
      <div className="hero">
        <h1>Fresh Zanzibar Products</h1>
        <p>Browse freely. Product details, cart, and checkout require login.</p>
      </div>
      {loading ? <p>Loading products...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="grid-products">
        {products.map((product) => (
          <article className="product-card" key={product.id}>
            <img src={product.image_url || "https://placehold.co/600x380?text=No+Image"} alt={product.name} />
            <div className="card-body">
              <h3>{product.name}</h3>
              <p className="muted">{product.category_name || "General"}</p>
              <p className="price">TZS {product.price}</p>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate("/login");
                    return;
                  }
                  navigate(`/products/${product.id}`);
                }}
              >
                Open Product Card
              </button>
            </div>
          </article>
        ))}
      </div>
      {!isAuthenticated ? (
        <p className="callout">
          New customer? <Link to="/register">Create account</Link> to use cart and buy now.
        </p>
      ) : null}
    </section>
  );
}

export default HomePage;
