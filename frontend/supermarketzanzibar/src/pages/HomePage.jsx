import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { applyImageFallback, toMediaUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function productListFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState("");
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef(null);
  const searchOpen = location.pathname === "/search";
  const filterOpen = location.pathname === "/filter" || location.pathname === "/category";
  const query = searchOpen ? searchParams.get("q") || "" : "";
  const activeCategory = location.pathname === "/category" ? searchParams.get("name") || "all" : "all";

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setSlowLoading(false);
    setError("");
    try {
      const response = await http.get("/api/products/");
      setProducts(productListFromResponse(response.data));
    } catch (err) {
      setError(err.code === "ECONNABORTED" ? "Products are taking too long to load. Please retry." : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setTimeout(() => setSlowLoading(true), 7000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searchOpen]);

  const categories = useMemo(() => {
    const names = products.map((product) => product.category_name || "General");
    return ["all", ...Array.from(new Set(names))];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const category = String(product.category_name || "General");
      const matchesCategory =
        activeCategory === "all" || category.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch =
        !normalizedQuery ||
        [product.name, product.description, product.category_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, query]);

  const toggleSearch = () => {
    navigate(searchOpen ? "/home" : "/search");
  };

  const toggleFilter = () => {
    navigate(filterOpen ? "/home" : "/filter");
  };

  const resetProductView = () => {
    navigate("/home");
  };

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
          <button
            type="button"
            className={searchOpen ? "market-action-btn active" : "market-action-btn"}
            onClick={toggleSearch}
            aria-label="Search products"
            aria-pressed={searchOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="5.5" />
              <path d="M15 15l4 4" />
            </svg>
          </button>
          <button
            type="button"
            className={filterOpen ? "market-action-btn active" : "market-action-btn"}
            onClick={toggleFilter}
            aria-label="Filter products"
            aria-pressed={filterOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14" />
              <path d="M8 12h8" />
              <path d="M11 17h2" />
            </svg>
          </button>
          <button type="button" className="market-action-btn" onClick={resetProductView} aria-label="View all products">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="5" width="5" height="5" rx="1" />
              <rect x="14" y="5" width="5" height="5" rx="1" />
              <rect x="5" y="14" width="5" height="5" rx="1" />
              <rect x="14" y="14" width="5" height="5" rx="1" />
            </svg>
          </button>
        </div>
        {(searchOpen || filterOpen) ? (
          <div className="marketplace-tools">
            {searchOpen ? (
              <input
                ref={searchInputRef}
                name="product_search"
                type="search"
                placeholder="Search product name, description, or category"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  navigate(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search", { replace: true });
                }}
              />
            ) : null}
            {filterOpen ? (
              <div className="category-filter-row" aria-label="Product categories">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={category === activeCategory ? "category-filter active" : "category-filter"}
                    onClick={() => navigate(category === "all" ? "/filter" : `/category?name=${encodeURIComponent(category)}`)}
                  >
                    {category === "all" ? "All" : category}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      {loading && !products.length ? <p>{slowLoading ? "Refresh. Products will appear soon..." : "Loading products..."}</p> : null}
      {error ? (
        <div className="load-error-panel">
          <p className="error">{error}</p>
          <button type="button" className="ghost-btn" onClick={loadProducts} disabled={loading}>
            {loading ? "Retrying..." : "Retry"}
          </button>
        </div>
      ) : null}
      <h2 id="products" className="section-title">Products</h2>
      <div className="grid-products product-grid">
        {visibleProducts.map((product) => (
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
            </div>
          </article>
        ))}
      </div>
      {!loading && !visibleProducts.length ? <p className="muted">No products match your search.</p> : null}
      {!isAuthenticated ? (
        <p className="callout">
          New customer? <Link to="/register">Create account</Link> to open products, add cart, and checkout.
        </p>
      ) : null}
    </section>
  );
}

export default HomePage;
