import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";
import { ROLE_HOME } from "../config/server";

/* Public pages and sign-in. Someone already signed in goes straight to their desk.
   Setup, reset and email-confirm links stay open: they work whether or not someone is signed in. */
const ALWAYS_OPEN = ["/staff-setup", "/staff-password", "/reset-password", "/confirm-email"];

function PublicOnly() {
  const user = useAuth();
  const { pathname } = useLocation();
  if (user && !ALWAYS_OPEN.includes(pathname)) return <Navigate to={ROLE_HOME[user.role] || "/"} replace />;
  return <Outlet />;
}

export default PublicOnly;
