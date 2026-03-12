import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function RoleRoute({ roles, children }) {
  const { loading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center-screen">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default RoleRoute;
