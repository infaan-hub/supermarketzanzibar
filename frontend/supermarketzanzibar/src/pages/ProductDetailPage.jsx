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
        <div className="product-view-media-stage">
          <div className="product-view-thumbs" aria-hidden="true">
            <button type="button" className="product-view-thumb active">
              <img
                src={productImageUrl(product) || PRODUCT_PLACEHOLDER}
                alt=""
                data-fallback-src={PRODUCT_PLACEHOLDER}
                onError={applyImageFallback}
              />
            </button>
          </div>
          <div className="product-view-media">
            <img
              src={productImageUrl(product) || PRODUCT_PLACEHOLDER}
              alt={product.name}
              data-fallback-src={PRODUCT_PLACEHOLDER}
              onError={applyImageFallback}
            />
          </div>
        </div>
        <div className="product-view-copy">
          <div className="product-view-topbar">
            <div>
              <p className="product-view-brand">{product.category_name || "Product"}</p>
              <h2>{product.name}</h2>
            </div>
            <Link className="product-view-close" to={user?.role === "customer" ? "/customer/dashboard" : "/"}>
              <span aria-hidden="true">×</span>
              <span className="sr-only">Close product view</span>
            </Link>
          </div>

          <p className="product-view-description">{product.description || "Fresh product available now."}</p>

          <div className="product-view-detail-grid">
            <div>
              <span>Category</span>
              <strong>{product.category_name || "Product"}</strong>
            </div>
            <div>
              <span>Stock</span>
              <strong>{product.quantity} available</strong>
            </div>
          </div>

          <div className="product-view-divider" />
          <p className="product-view-price">TZS {product.price}</p>

          {isAuthenticated && user?.role === "customer" ? (
            <div className="product-view-actions">
              <button type="button" className="product-view-primary-btn" onClick={() => addToCart(product, 1)}>
                Add Cart
              </button>
              <button type="button" className="product-view-secondary-btn" onClick={openBuy}>
                Buy Now
              </button>
            </div>
          ) : (
            <div className="catalog-empty compact product-view-login-card">
              <h3>Login to continue</h3>
              <p>Guests can view the product, but customer login is required before adding cart or buying now.</p>
              <Link className="product-view-primary-btn" to="/login" state={{ from: `/products/${product.id}` }}>
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
