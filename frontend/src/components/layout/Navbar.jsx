import { LogOut, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROLE_LABEL } from "../../constants/userRoles";
import { logout, useAuth } from "../../store/authStore";

function Navbar({ onMenu }) {
  const user = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button type="button" className="menu-btn" onClick={onMenu} aria-label="Open menu">
          <Menu size={18} />
        </button>
        <div>
          <strong>{user.name}</strong>
          <div className="mono">
            {ROLE_LABEL[user.role]} · {user.ward}
          </div>
        </div>
      </div>

      <div className="session-plate">
        <span className="live-dot" />
        <span className="identity-copy">
          <strong>{user.name}</strong>
          <small>Secure session · {ROLE_LABEL[user.role]}</small>
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ height: 36, padding: "0 12px" }}
          onClick={() => {
            logout();
            navigate("/sign-in", { replace: true });
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </header>
  );
}

export default Navbar;