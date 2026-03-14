import { Link, useNavigate } from "react-router-dom";
import productPlaceholder from "../assets/product-placeholder.svg";
import { useCart } from "../context/CartContext.jsx";
import { applyImageFallback, productImageUrl } from "../lib/media.jsx";

const PRODUCT_PLACEHOLDER = productPlaceholder;

function CartPage() {
  const { items, removeFromCart, total, count } = useCart();
  const navigate = useNavigate();

  return (
    <section className="page-wrap">
      <div className="dashboard-summary">
        <div>
          <p className="home-toolbar-kicker">Customer cart</p>
          <h2 className="dashboard-title">My Cart</h2>
          <p className="section-note">Review the products you added, remove what you do not need, then continue to buy now.</p>
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
          <h3>Your cart is empty.</h3>
          <p>Add products from the customer dashboard to continue.</p>
        </div>
      ) : (
        <>
          <div className="cart-list">
            {items.map((item) => (
              <article className="cart-product-card" key={item.product.id}>
                <img
                  className="cart-product-image"
                  src={productImageUrl(item.product) || PRODUCT_PLACEHOLDER}
                  alt={item.product.name}
                  data-fallback-src={PRODUCT_PLACEHOLDER}
                  onError={applyImageFallback}
                />
                <div className="cart-product-copy">
                  <h3>{item.product.name}</h3>
                  <p className="muted">{item.product.category_name || "General"}</p>
                  <p className="product-summary">{item.product.description || "Fresh product available now."}</p>
                </div>
                <div className="cart-product-meta">
                  <p>Qty: {item.quantity}</p>
                  <p className="product-price">TZS {(Number(item.product.price) * item.quantity).toFixed(2)}</p>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => removeFromCart(item.product.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="checkout-summary-card">
            <div>
              <p className="home-toolbar-kicker">Cart summary</p>
              <h3>Total: TZS {total.toFixed(2)}</h3>
              <p className="section-note">Proceed to the supermarket order form to complete customer information and submit the order.</p>
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={() => navigate("/customer/buynow")}
            >
              Buy Now
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default CartPage;
