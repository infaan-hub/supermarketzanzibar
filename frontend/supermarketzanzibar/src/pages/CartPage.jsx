import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

function CartPage() {
  const { items, removeFromCart, total } = useCart();
  const navigate = useNavigate();

  return (
    <section className="page-wrap">
      <h2>Your Cart</h2>
      {!items.length ? <p>No items in cart.</p> : null}
      <div className="order-list">
        {items.map((item) => (
          <article className="order-card" key={item.product.id}>
            <div>
              <h4>{item.product.name}</h4>
              <p className="muted">
                Qty: {item.quantity} x TZS {item.product.price}
              </p>
            </div>
            <button type="button" className="ghost-btn" onClick={() => removeFromCart(item.product.id)}>
              Remove
            </button>
          </article>
        ))}
      </div>
      <p className="price">Total: TZS {total.toFixed(2)}</p>
      <button type="button" className="primary-btn" onClick={() => navigate("/customer/dashboard")}>
        Continue Shopping
      </button>
    </section>
  );
}

export default CartPage;
