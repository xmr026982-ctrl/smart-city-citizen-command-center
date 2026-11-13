import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";

// Any signed-in desk. Works as a wrapper or as a layout route.
// Signed out: to sign-in, then back to this page.
function ProtectedRoute({ children }) {
  const user = useAuth();
  const { pathname, search } = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  return children ?? <Outlet />;
}

export default ProtectedRoute;
