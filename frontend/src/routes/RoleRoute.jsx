import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/authStore";

const HOME = {
  citizen: "/citizen/report",
  staff: "/staff/assigned",
  admin: "/admin/command",
};

function RoleRoute({ allow }) {
  const user = useAuth();
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!allow.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return <Outlet />;
}

export default RoleRoute;