import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { getApiErrorMessage } from "../lib/apiErrors.js";
import { applyImageFallback, productImageUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isAuthenticated, user } = useAuth();
  const { addToCart, startCheckoutFromProduct } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await http.get(`/api/products/${id}/`);
        setProduct(response.data);
      } catch (requestError) {
        setProduct(null);
        setError(getApiErrorMessage(requestError, "Failed to load product details."));
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  if (loading) return <p className="page-wrap">Loading product...</p>;

  if (!product) {
    return (
      <section className="page-wrap">
        <div className="catalog-empty">
          <h3>Product not found.</h3>
          <p>{error || "This product could not be loaded right now."}</p>
        </div>
      </section>
    );
  }

  const openBuy = () => {
    startCheckoutFromProduct(product, 1);
    navigate("/buy");
  };

  return (
    <section className="page-wrap">
      <div className="product-view-shell">
        <div className="product-view-media">
          <img
            src={productImageUrl(product) || PRODUCT_PLACEHOLDER}
            alt={product.name}
            data-fallback-src={PRODUCT_PLACEHOLDER}
            onError={applyImageFallback}
          />
        </div>
        <div className="product-view-copy">
          <p className="home-toolbar-kicker">{product.category_name || "Product"}</p>
          <h2>{product.name}</h2>
          <p className="product-view-description">{product.description || "Fresh product available now."}</p>
          <p className="showcase-card-price">TZS {product.price}</p>
          <p className="muted">Stock available: {product.quantity}</p>

          {isAuthenticated && user?.role === "customer" ? (
            <div className="showcase-card-actions">
              <button type="button" className="showcase-primary-btn" onClick={() => addToCart(product, 1)}>
                Add Cart
              </button>
              <button type="button" className="showcase-secondary-btn" onClick={openBuy}>
                Buy Now
              </button>
            </div>
          ) : (
            <div className="catalog-empty compact">
              <h3>Login to continue</h3>
              <p>Guests can view the product, but customer login is required before adding cart or buying now.</p>
              <Link className="showcase-primary-btn" to="/login" state={{ from: `/products/${product.id}` }}>
                Customer Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProductDetailPage;
