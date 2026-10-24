import { Navigate } from "react-router-dom";
import { getRole } from "../store/authStore";

function RoleRoute({ allow, children }) {
  const role = getRole();
  if (!role) return <Navigate to="/" replace />;
  if (role !== allow) return <Navigate to="/unauthorized" replace />;
  return children;
}

export default RoleRoute;