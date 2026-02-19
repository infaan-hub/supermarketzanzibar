import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function RoleRoute({ roles, children }) {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) return <div className="center-screen">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/home" replace />;
  return children;
}

export default RoleRoute;
