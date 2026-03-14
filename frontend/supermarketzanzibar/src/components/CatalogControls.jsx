import { useEffect, useRef, useState } from "react";

function ControlIcon({ kind }) {
  if (kind === "filter") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "category") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CatalogControls({
  searchQuery,
  setSearchQuery,
  productFilter,
  setProductFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  searchPlaceholder = "Search products, category, or description",
}) {
  const [activeControl, setActiveControl] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (activeControl === "search") {
      searchInputRef.current?.focus();
    }
  }, [activeControl]);

  const toggleControl = (control) => {
    setActiveControl((current) => (current === control ? null : control));
  };

  return (
    <div className="home-controls">
      <div className="home-control-toggles">
        <button
          type="button"
          className={`home-control-toggle ${activeControl === "search" ? "active" : ""}`}
          aria-label="Toggle search"
          aria-expanded={activeControl === "search"}
          onClick={() => toggleControl("search")}
        >
          <ControlIcon kind="search" />
        </button>
        <button
          type="button"
          className={`home-control-toggle ${activeControl === "filter" ? "active" : ""}`}
          aria-label="Toggle filter"
          aria-expanded={activeControl === "filter"}
          onClick={() => toggleControl("filter")}
        >
          <ControlIcon kind="filter" />
        </button>
        <button
          type="button"
          className={`home-control-toggle ${activeControl === "category" ? "active" : ""}`}
          aria-label="Toggle category"
          aria-expanded={activeControl === "category"}
          onClick={() => toggleControl("category")}
        >
          <ControlIcon kind="category" />
        </button>
      </div>
      {activeControl === "search" ? (
        <div className="home-control-panel">
          <span className="home-control-panel-icon" aria-hidden="true">
            <ControlIcon kind="search" />
          </span>
          <input
            ref={searchInputRef}
            className="home-control-panel-field"
            type="search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button
            type="button"
            className="home-control-dismiss"
            aria-label="Close search"
            onClick={() => setActiveControl(null)}
          >
            x
          </button>
        </div>
      ) : null}
      {activeControl === "filter" ? (
        <div className="home-control-panel">
          <span className="home-control-panel-icon" aria-hidden="true">
            <ControlIcon kind="filter" />
          </span>
          <span className="home-control-panel-title">Filter</span>
          <select
            className="home-control-panel-field"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          >
            <option value="all">All products</option>
            <option value="in_stock">In stock</option>
            <option value="budget">Budget picks</option>
            <option value="premium">Premium picks</option>
          </select>
          <button
            type="button"
            className="home-control-dismiss"
            aria-label="Close filter"
            onClick={() => setActiveControl(null)}
          >
            x
          </button>
        </div>
      ) : null}
      {activeControl === "category" ? (
        <div className="home-control-panel">
          <span className="home-control-panel-icon" aria-hidden="true">
            <ControlIcon kind="category" />
          </span>
          <span className="home-control-panel-title">Category</span>
          <select
            className="home-control-panel-field"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="home-control-dismiss"
            aria-label="Close category"
            onClick={() => setActiveControl(null)}
          >
            x
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default CatalogControls;
