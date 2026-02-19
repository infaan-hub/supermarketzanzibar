import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

function MainNav() {
  const { user, logout, isAuthenticated } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/home");
  };

  return (
    <header className="topbar">
      <Link to="/home" className="brand">
        Zanzibar Super System
      </Link>
      <nav className="nav-links">
        <NavLink to="/home">Home</NavLink>
        {isAuthenticated ? <NavLink to="/cart">Cart ({count})</NavLink> : null}
        {isAuthenticated ? <NavLink to="/profile">Profile</NavLink> : null}
        {user?.role === "admin" ? <NavLink to="/admin/dashboard">Admin Dashboard</NavLink> : null}
        {user?.role === "supplier" ? <NavLink to="/supplier/dashboard">Supplier Dashboard</NavLink> : null}
        {user?.role === "driver" ? <NavLink to="/driver/dashboard">Driver Dashboard</NavLink> : null}
        {user?.role === "customer" ? <NavLink to="/customer/dashboard">My Orders</NavLink> : null}
      </nav>
      <div className="auth-buttons">
        {!isAuthenticated ? (
          <>
            <NavLink to="/login" className="ghost-btn">
              Customer Login
            </NavLink>
            <NavLink to="/admin/login" className="ghost-btn">
              Admin Login
            </NavLink>
            <NavLink to="/supplier/login" className="ghost-btn">
              Supplier Login
            </NavLink>
            <NavLink to="/driver/login" className="ghost-btn">
              Driver Login
            </NavLink>
          </>
        ) : (
          <button type="button" className="ghost-btn" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

export default MainNav;
