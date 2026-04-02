import { useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import CatalogControls from "../components/CatalogControls.jsx";
import ProductShowcaseCard from "../components/ProductShowcaseCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { getApiErrorMessage } from "../lib/apiErrors.js";
import { ABOUT_CARDS, CONTACT_ITEMS, STORE_EMAIL_HREF, STORE_NAME, STORE_PHONE_HREF } from "../lib/storeInfo.js";

function AboutIcon({ kind }) {
  if (kind === "supply") {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M14 19.5L24 12l10 7.5V32a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V19.5Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M19 24h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 19v10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "search") {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="21" cy="21" r="9" stroke="currentColor" strokeWidth="2.4" />
        <path d="M27.5 27.5L35 35" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M21 17v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M17 21h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M14 16h3l2.2 11.2a2 2 0 0 0 2 1.6h10.8a2 2 0 0 0 2-1.5L36 20H20.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="34" r="2.6" fill="currentColor" />
      <circle cx="32" cy="34" r="2.6" fill="currentColor" />
      <path d="M31 13v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M28 16h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { isAuthenticated } = useAuth();
  const { addToCart, startCheckoutFromProduct } = useCart();
  const navigate = useNavigate();
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await http.get("/api/products/");
      setProducts(response.data);
    } catch (error) {
      setError(getApiErrorMessage(error, "Failed to load products."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openProduct = (productId) => {
    navigate(`/products/${productId}`);
  };

  const buyNow = (product) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/buy" } });
      return;
    }
    startCheckoutFromProduct(product, 1);
    navigate("/buy");
  };

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

  return (
    <section className="page-wrap">
      <header className="home-toolbar">
        <div className="home-toolbar-head">
          <div className="home-toolbar-copy">
            <p className="home-toolbar-kicker">Marketplace</p>
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
      </header>
      {loading ? <p>Loading products...</p> : null}
      {error ? (
        <div className="panel product-load-feedback">
          <p className="error">{error}</p>
          <button type="button" className="ghost-btn" onClick={loadProducts}>
            Retry Products
          </button>
        </div>
      ) : null}
      <div className="section-heading">
        <h2 id="products" className="section-title">Products</h2>
        <p className="section-note">Tap a card to open the full product view.</p>
      </div>
      <div className="grid-products product-grid">
        {visibleProducts.map((product) => (
          <ProductShowcaseCard
            key={product.id}
            product={product}
            canPurchase={isAuthenticated}
            onOpenProduct={openProduct}
            onAddToCart={(entry) => addToCart(entry, 1)}
            onBuyNow={buyNow}
          />
        ))}
      </div>
      {!loading && !error && !visibleProducts.length ? (
        <div className="catalog-empty">
          <h3>No products match that search.</h3>
          <p>Try a different keyword, change the filter, or switch back to all categories.</p>
        </div>
      ) : null}
      {!isAuthenticated ? (
        <p className="callout">
          New customer? <Link to="/register">Create account</Link> to open products, add cart, and checkout.
        </p>
      ) : null}
      <section className="home-section" id="about">
        <div className="section-heading">
          <h2 className="section-title">About Us</h2>
        </div>
        <div className="info-grid">
          {ABOUT_CARDS.map((card) => (
            <article key={card.title} className="info-card">
              <div className="info-card-head">
                <div className="info-card-icon">
                  <AboutIcon kind={card.icon} />
                </div>
                <p className="info-card-kicker">About us</p>
              </div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="home-section" id="contact">
        <div className="section-heading">
          <h2 className="section-title">Contact Us</h2>
        </div>
        <div className="contact-card">
          <div className="contact-copy">
            <p className="info-card-kicker">Support</p>
            <h3>Talk to {STORE_NAME}</h3>
            <p>
              Contact us for account support, supplier onboarding, product updates, and help with your orders.
            </p>
            <div className="contact-actions">
              <a className="primary-btn" href={STORE_EMAIL_HREF}>
                Email Support
              </a>
              <a className="ghost-btn" href={STORE_PHONE_HREF}>
                Call Now
              </a>
            </div>
          </div>
          <div className="contact-list">
            {CONTACT_ITEMS.map((item) => (
              <a key={item.label} className="contact-item" href={item.href}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </a>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

export default HomePage;
