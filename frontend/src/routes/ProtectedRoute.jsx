import { Navigate } from "react-router-dom";
import { getRole } from "../store/authStore";

function ProtectedRoute({ children }) {
  if (!getRole()) return <Navigate to="/" replace />;
  return children;
}

export default ProtectedRoute;