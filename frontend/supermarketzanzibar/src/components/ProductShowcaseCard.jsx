import productPlaceholder from "../assets/product-placeholder.svg";
import { applyImageFallback, productImageUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function ProductShowcaseCard({ product, canPurchase, onOpenProduct, onAddToCart, onBuyNow }) {
  return (
    <article className="showcase-card">
      <button type="button" className="showcase-card-media" onClick={() => onOpenProduct(product.id)} aria-label={`View ${product.name}`}>
        <img
          src={productImageUrl(product) || PRODUCT_PLACEHOLDER}
          alt={product.name}
          data-fallback-src={PRODUCT_PLACEHOLDER}
          onError={applyImageFallback}
        />
      </button>
      <div className="showcase-card-body">
        <p className="showcase-card-kicker">{product.category_name || "Card 1"}</p>
        <button type="button" className="showcase-card-title" onClick={() => onOpenProduct(product.id)}>
          {product.name}
        </button>
        <p className="showcase-card-description">{product.description || "Fresh product available now."}</p>
        <p className="showcase-card-price">TZS {product.price}</p>
        {canPurchase ? (
          <div className="showcase-card-actions">
            <button
              type="button"
              className="showcase-primary-btn"
              disabled={Number(product.quantity || 0) <= 0}
              onClick={() => onAddToCart(product)}
            >
              {Number(product.quantity || 0) > 0 ? "Add Cart" : "Out of Stock"}
            </button>
            <button
              type="button"
              className="showcase-secondary-btn"
              disabled={Number(product.quantity || 0) <= 0}
              onClick={() => onBuyNow(product)}
            >
              Buy Now
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default ProductShowcaseCard;
