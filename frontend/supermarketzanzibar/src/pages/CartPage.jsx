import { Link, useNavigate } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { useCart } from "../context/CartContext.jsx";
import { applyImageFallback, productImageUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function CartPage() {
  const {
    items,
    removeFromCart,
    incrementQuantity,
    decrementQuantity,
    total,
    count,
    startCheckoutFromCart,
  } = useCart();
  const navigate = useNavigate();

  const goToBuy = () => {
    startCheckoutFromCart();
    navigate("/buy");
  };

  return (
    <section className="page-wrap">
      <div className="dashboard-summary">
        <div>
          <p className="home-toolbar-kicker">Customer purchases</p>
          <h2 className="dashboard-title">Purchases</h2>
          <p className="section-note">Everything you added lives here. Update quantity, remove products, or continue to buy.</p>
        </div>
        <div className="dashboard-summary-actions">
          <Link className="ghost-btn" to="/customer/dashboard">
            Continue Shopping
          </Link>
          <span className="cart-count-chip">{count} items</span>
        </div>
      </div>

      {!items.length ? (
        <div className="catalog-empty">
          <h3>Your purchases list is empty.</h3>
          <p>Add products from the dashboard and they will appear here.</p>
        </div>
      ) : (
        <>
          <div className="purchase-list">
            {items.map((item) => (
              <article className="purchase-card" key={item.product.id}>
                <button
                  type="button"
                  className="purchase-card-media"
                  onClick={() => navigate(`/products/${item.product.id}`)}
                  aria-label={`View ${item.product.name}`}
                >
                  <img
                    className="cart-product-image"
                    src={productImageUrl(item.product) || PRODUCT_PLACEHOLDER}
                    alt={item.product.name}
                    data-fallback-src={PRODUCT_PLACEHOLDER}
                    onError={applyImageFallback}
                  />
                </button>
                <div className="purchase-card-copy">
                  <h3>{item.product.name}</h3>
                  <p>{item.product.description || "Fresh product available now."}</p>
                  <strong>TZS {(Number(item.product.price) * item.quantity).toFixed(2)}</strong>
                </div>
                <div className="purchase-card-actions">
                  <div className="quantity-stepper" aria-label={`Quantity for ${item.product.name}`}>
                    <button type="button" onClick={() => decrementQuantity(item.product.id)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => incrementQuantity(item.product.id)}>
                      +
                    </button>
                  </div>
                  <button type="button" className="ghost-btn" onClick={() => removeFromCart(item.product.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="purchase-summary">
            <div>
              <p className="home-toolbar-kicker">Ready to continue</p>
              <h3>Total: TZS {total.toFixed(2)}</h3>
              <p className="section-note">Proceed to buy and complete customer details before billing.</p>
            </div>
            <button type="button" className="showcase-primary-btn" onClick={goToBuy}>
              Buy Now
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default CartPage;
