import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/authStore";

function RoleRoute({ allow }) {
  const user = useAuth();
  if (!allow.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default RoleRoute;