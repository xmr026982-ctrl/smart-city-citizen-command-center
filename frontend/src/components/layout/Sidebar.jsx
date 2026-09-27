import { NavLink } from "react-router-dom";
import {
  Shield, ClipboardList, MapPin, Users,
  BarChart3, FileText, Building2
} from "lucide-react";

const NAV = [
  { to: "/admin/command", label: "Command Center", icon: Shield },
  { to: "/admin/queue", label: "All Issues", icon: ClipboardList },
  { to: "/admin/assignments", label: "Assign Issues", icon: MapPin },
  { to: "/admin/staff", label: "Staff Management", icon: Users },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/audit", label: "Audit Log", icon: FileText },
];

function Sidebar({ open, onClose }) {
  return (
    <aside
      className="sidebar"
      style={{
        width: "100%",
        height: "100dvh",
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(22px) saturate(1.5)",
        borderRight: "1px solid rgba(14,165,233,0.16)",
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute",
        top: 0, right: 0, width: 2, height: "100%",
        background: "linear-gradient(180deg, transparent, rgba(14,165,233,0.55), transparent)",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px 22px" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            color: "white",
            background: "linear-gradient(145deg, #0ea5e9 0%, #0369a1 100%)",
            boxShadow: "0 10px 24px rgba(14,165,233,0.35)",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <Building2 size={20} strokeWidth={1.8} />
          <span style={{
            position: "absolute",
            width: 8, height: 8, borderRadius: "50%",
            background: "#22d3ee",
            right: 5, bottom: 5,
            boxShadow: "0 0 8px #22d3ee",
          }} />
        </div>
        <div>
          <p style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 750,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}>
            Smart City
          </p>
          <p style={{
            marginTop: 5,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--primary)",
          }}>
            Civic Command
          </p>
        </div>
      </div>

      <p style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--subtle)",
        padding: "0 10px 10px",
      }}>
        Command Layer
      </p>

      <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 11,
                height: 44,
                padding: "0 12px",
                borderRadius: 12,
                textDecoration: "none",
                fontSize: 13.5,
                fontWeight: isActive ? 650 : 500,
                color: isActive ? "white" : "var(--muted)",
                background: isActive
                  ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
                  : "transparent",
                boxShadow: isActive ? "0 10px 22px rgba(14,165,233,0.28)" : "none",
                transition: "all 180ms ease",
              })}
            >
              <Icon size={17} strokeWidth={1.8} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;