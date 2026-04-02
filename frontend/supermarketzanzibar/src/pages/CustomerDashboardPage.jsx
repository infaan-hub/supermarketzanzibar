import { useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http.jsx";
import CatalogControls from "../components/CatalogControls.jsx";
import ProductShowcaseCard from "../components/ProductShowcaseCard.jsx";
import { useCart } from "../context/CartContext.jsx";
import { getApiErrorMessage } from "../lib/apiErrors.js";

function CustomerDashboardPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const { addToCart, count, startCheckoutFromProduct } = useCart();
  const navigate = useNavigate();

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await http.get("/api/products/");
      setProducts(response.data);
    } catch (error) {
      setError(getApiErrorMessage(error, "Unable to load products."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const onBuyNow = (product) => {
    startCheckoutFromProduct(product, 1);
    navigate("/buy");
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
          <Link className="primary-btn" to="/purchases">
            Purchases ({count})
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
      {error ? (
        <div className="panel product-load-feedback">
          <p className="error">{error}</p>
          <button type="button" className="ghost-btn" onClick={loadProducts}>
            Retry Products
          </button>
        </div>
      ) : null}

      <div className="section-heading">
        <h2 className="section-title">Products</h2>
        <p className="section-note">Add products to your cart, then continue to buy now when ready.</p>
      </div>

      <div className="grid-products product-grid">
        {visibleProducts.map((product) => (
          <ProductShowcaseCard
            key={product.id}
            product={product}
            canPurchase
            onOpenProduct={(productId) => navigate(`/products/${productId}`)}
            onAddToCart={(entry) => addToCart(entry, 1)}
            onBuyNow={onBuyNow}
          />
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
