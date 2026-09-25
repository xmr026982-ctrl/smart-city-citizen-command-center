import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";

function ProtectedRoute() {
  const user = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;