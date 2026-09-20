import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROLE_LABEL } from "../../constants/userRoles";
import { setRole, useAuth } from "../../store/authStore";

const HOME = {
  citizen: "/citizen/report",
  staff: "/staff/queue",
  admin: "/admin/command",
};

function Navbar({ onMenu }) {
  const user = useAuth();
  const navigate = useNavigate();

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
      <div className="role-switch">
        {["citizen", "staff", "admin"].map((role) => (
          <button
            key={role}
            type="button"
            className={user.role === role ? "active" : ""}
            onClick={() => {
              setRole(role);
              navigate(HOME[role]);
            }}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>
    </header>
  );
}

export default Navbar;