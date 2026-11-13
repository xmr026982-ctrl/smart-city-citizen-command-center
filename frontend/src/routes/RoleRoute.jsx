import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";

// allow can be one role ("admin") or a list (["staff", "admin"]).
// Works as a wrapper (<RoleRoute allow="admin"><Page /></RoleRoute>)
// or as a layout route (<Route element={<RoleRoute allow={["admin"]} />}>).
function RoleRoute({ allow, children }) {
  const user = useAuth();
  const { pathname, search } = useLocation();
  const roles = Array.isArray(allow) ? allow : [allow];

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children ?? <Outlet />;
}

export default RoleRoute;
