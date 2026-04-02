import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import MainNav from "./components/MainNav.jsx";
import CartNoticeCenter from "./components/CartNoticeCenter.jsx";
import RoleNotificationCenter from "./components/RoleNotificationCenter.jsx";
import RoleRoute from "./components/RoleRoute.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import BillingPage from "./pages/BillingPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import CustomerBuyNowPage from "./pages/CustomerBuyNowPage.jsx";
import CustomerDashboardPage from "./pages/CustomerDashboardPage.jsx";
import CustomerHistoryPage from "./pages/CustomerHistoryPage.jsx";
import DriverDashboardPage from "./pages/DriverDashboardPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ReceiptStatusPage from "./pages/ReceiptStatusPage.jsx";
import RoleLoginPage from "./pages/RoleLoginPage.jsx";
import SupplierDashboardPage from "./pages/SupplierDashboardPage.jsx";

function AppLayout() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("theme-mode") || "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme-mode", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <RoleNotificationCenter />
      <CartNoticeCenter />
      <MainNav theme={theme} onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))} />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/home" replace />;
  if (user?.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === "supplier") return <Navigate to="/supplier/dashboard" replace />;
  if (user?.role === "driver") return <Navigate to="/driver/dashboard" replace />;
  return <Navigate to="/customer/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<RoleLoginPage role="customer" />} />
        <Route path="/admin/login" element={<RoleLoginPage role="admin" />} />
        <Route path="/supplier/login" element={<RoleLoginPage role="supplier" />} />
        <Route path="/driver/login" element={<RoleLoginPage role="driver" />} />
        <Route path="/register" element={<RegisterPage mode="customer" />} />
        <Route path="/admin/register" element={<RegisterPage mode="admin" />} />

        <Route
          path="/products/:id"
          element={<ProductDetailPage />}
        />
        <Route
          path="/cart"
          element={<Navigate to="/purchases" replace />}
        />
        <Route
          path="/customer/cart"
          element={<Navigate to="/purchases" replace />}
        />
        <Route
          path="/purchases"
          element={
            <RoleRoute roles={["customer"]}>
              <CartPage />
            </RoleRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <RoleRoute roles={["customer", "admin", "supplier", "driver"]}>
              <ProfilePage />
            </RoleRoute>
          }
        />
        <Route
          path="/customer/dashboard"
          element={
            <RoleRoute roles={["customer"]}>
              <CustomerDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/customer/buynow"
          element={<Navigate to="/buy" replace />}
        />
        <Route
          path="/buy"
          element={
            <RoleRoute roles={["customer"]}>
              <CustomerBuyNowPage />
            </RoleRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <RoleRoute roles={["customer"]}>
              <BillingPage />
            </RoleRoute>
          }
        />
        <Route
          path="/receipt"
          element={
            <RoleRoute roles={["customer"]}>
              <ReceiptStatusPage />
            </RoleRoute>
          }
        />
        <Route
          path="/customer/history"
          element={
            <RoleRoute roles={["customer"]}>
              <CustomerHistoryPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RoleRoute roles={["admin"]}>
              <AdminDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/supplier/dashboard"
          element={
            <RoleRoute roles={["supplier"]}>
              <SupplierDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/driver/dashboard"
          element={
            <RoleRoute roles={["driver"]}>
              <DriverDashboardPage />
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
