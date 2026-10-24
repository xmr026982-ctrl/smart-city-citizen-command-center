import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronDown, LogOut, Activity, User } from "lucide-react";
import { ROLE_LABEL } from "../../constants/userRoles";
import { logout, useAuth } from "../../store/authStore";

const DESK = { admin: "Civic Command", staff: "Field Desk", citizen: "Citizen Services" };

function TopBar({ onMenu }) {
  const user = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const role = user.role || "citizen";

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        {onMenu && (
          <button type="button" className="menu-btn" onClick={onMenu} aria-label="Open menu">
            <Activity size={18} />
          </button>
        )}
        <div className="zone-menu">
          <button type="button" className="loc" disabled>
            <MapPin size={18} strokeWidth={1.6} />
            <div>
              <strong>{user.ward || "Zone"}</strong>
              <span>{DESK[role]}</span>
            </div>
          </button>
        </div>
      </div>

      <div className="session-plate" ref={ref} style={{ position: "relative" }}>
        <span className="live-dot" />
        <button
          type="button"
          className="identity-copy"
          onClick={() => setOpen((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(145deg, #0ea5e9, #0369a1)",
            display: "grid", placeItems: "center", color: "white",
          }}>
            <User size={16} />
          </div>
          <div style={{ textAlign: "left" }}>
            <strong>{user.name}</strong>
            <small>Secure session · {ROLE_LABEL[role]}</small>
          </div>
          <ChevronDown size={14} style={{ opacity: 0.6 }} />
        </button>

        {open && (
          <div className="profile-menu" style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            minWidth: 200, borderRadius: 14, padding: 8,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(14,165,233,0.18)",
            boxShadow: "0 16px 40px rgba(14,165,233,0.12)",
            zIndex: 50,
          }}>
            <button
              type="button"
              className="profile-item logout"
              onClick={() => { logout(); navigate("/", { replace: true }); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, border: "none",
                background: "transparent", cursor: "pointer", fontSize: 13.5,
                color: "var(--fg)",
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default TopBar;