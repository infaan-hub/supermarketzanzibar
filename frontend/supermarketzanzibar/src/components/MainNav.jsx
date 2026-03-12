import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

function MainNav({ theme, onToggleTheme }) {
  const { user, logout, isAuthenticated } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    { to: "/", label: "Home", show: true },
    { to: "/cart", label: `Cart (${count})`, show: isAuthenticated },
    { to: "/profile", label: "Profile", show: isAuthenticated },
    { to: "/admin/dashboard", label: "Admin Dashboard", show: user?.role === "admin" },
    { to: "/supplier/dashboard", label: "Supplier Dashboard", show: user?.role === "supplier" },
    { to: "/driver/dashboard", label: "Driver Dashboard", show: user?.role === "driver" },
    { to: "/customer/dashboard", label: "My Orders", show: user?.role === "customer" },
  ];

  const guestActions = [
    { to: "/login", label: "Customer Login" },
    { to: "/admin/login", label: "Admin Login" },
    { to: "/supplier/login", label: "Supplier Login" },
    { to: "/driver/login", label: "Driver Login" },
  ];

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className={`sidebar-toggle${sidebarOpen ? " active" : ""}`}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link to="/" className="brand">
          Zansupermarket
        </Link>
      </header>

      <div
        className={`sidebar-backdrop${sidebarOpen ? " visible" : ""}`}
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar${sidebarOpen ? " open" : ""}`} aria-label="Main sidebar">
        <div className="sidebar-header">
          <p className="sidebar-kicker">Control Panel</p>
          <h2>Navigation</h2>
          <p className="muted">All actions are moved here for the new layout.</p>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link-pill${isActive ? " active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-actions">
          <button type="button" className="theme-switch" onClick={onToggleTheme}>
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
          {!isAuthenticated
            ? guestActions.map((action) => (
                <NavLink
                  key={action.to}
                  to={action.to}
                  className="ghost-btn"
                  onClick={() => setSidebarOpen(false)}
                >
                  {action.label}
                </NavLink>
              ))
            : (
              <button type="button" className="ghost-btn" onClick={onLogout}>
                Logout
              </button>
            )}
        </div>
      </aside>
    </>
  );
}

export default MainNav;
