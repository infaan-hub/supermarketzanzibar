import { useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { http } from "../api/http.jsx";
import CatalogControls from "../components/CatalogControls.jsx";
import { useCart } from "../context/CartContext.jsx";
import { applyImageFallback, productImageUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function CustomerDashboardPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const { addToCart, count } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await http.get("/api/products/");
        setProducts(response.data);
      } catch {
        setError("Unable to load products.");
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const categories = Array.from(
    new Set(products.map((product) => product.category_name || "General")),
  ).sort((left, right) => left.localeCompare(right));

  const visibleProducts = products.filter((product) => {
    const normalizedCategory = product.category_name || "General";
    const price = Number(product.price || 0);
    const searchableText = [product.name, normalizedCategory, product.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !deferredSearch || searchableText.includes(deferredSearch);
    const matchesCategory = categoryFilter === "all" || normalizedCategory === categoryFilter;
    const matchesFilter =
      productFilter === "all" ||
      (productFilter === "in_stock" && Number(product.quantity || 0) > 0) ||
      (productFilter === "budget" && price < 5000) ||
      (productFilter === "premium" && price >= 5000);

    return matchesSearch && matchesCategory && matchesFilter;
  });

  const onAddToCart = (event, product) => {
    event.stopPropagation();
    addToCart(product, 1);
  };

  return (
    <section className="page-wrap">
      <div className="dashboard-summary">
        <div>
          <p className="home-toolbar-kicker">Customer dashboard</p>
          <h2 className="dashboard-title">Browse products and build your cart</h2>
          <p className="section-note">Search, filter, and add items before moving to checkout.</p>
        </div>
        <div className="dashboard-summary-actions">
          <Link className="ghost-btn" to="/customer/history">
            Order History
          </Link>
          <Link className="primary-btn" to="/customer/cart">
            My Cart ({count})
          </Link>
        </div>
      </div>

      <CatalogControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        productFilter={productFilter}
        setProductFilter={setProductFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories}
      />

      {loading ? <p>Loading products...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="section-heading">
        <h2 className="section-title">Products</h2>
        <p className="section-note">Add products to your cart, then continue to buy now when ready.</p>
      </div>

      <div className="grid-products product-grid">
        {visibleProducts.map((product) => (
          <article
            className="product-card"
            key={product.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/products/${product.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") navigate(`/products/${product.id}`);
            }}
          >
            <div className="card-image">
              <img
                src={productImageUrl(product) || PRODUCT_PLACEHOLDER}
                alt={product.name}
                data-fallback-src={PRODUCT_PLACEHOLDER}
                onError={applyImageFallback}
              />
            </div>
            <div className="card-body">
              <h3 className="product-title">{product.name}</h3>
              <p className="muted">{product.category_name || "General"}</p>
              <p className="product-summary">{product.description || "Fresh product available now."}</p>
              <p className="product-price">TZS {product.price}</p>
              <div className="product-card-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={Number(product.quantity || 0) <= 0}
                  onClick={(event) => onAddToCart(event, product)}
                >
                  {Number(product.quantity || 0) > 0 ? "Add to Cart" : "Out of Stock"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/products/${product.id}`);
                  }}
                >
                  View
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!loading && !error && !visibleProducts.length ? (
        <div className="catalog-empty">
          <h3>No products match that search.</h3>
          <p>Try a different keyword, change the filter, or switch back to all categories.</p>
        </div>
      ) : null}
    </section>
  );
}

export default CustomerDashboardPage;
