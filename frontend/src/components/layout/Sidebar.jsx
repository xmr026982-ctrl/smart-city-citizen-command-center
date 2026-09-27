import { NavLink } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  Users,
  BarChart3,
  FileText,
  Shield,
  MapPin,
  Activity,
  Zap,
  UserCog,
  Inbox,
} from "lucide-react";
import { useAuth } from "../../store/authStore";

const NAV = {
  citizen: [
    { to: "/citizen/report", label: "Report Issue", icon: AlertTriangle },
    { to: "/citizen/my-reports", label: "My Reports", icon: ClipboardList },
    { to: "/citizen/saved", label: "Saved Reports", icon: Inbox },
  ],
  staff: [
    { to: "/staff/queue", label: "Work Queue", icon: Zap },
    { to: "/staff/assigned", label: "Assigned Issues", icon: Activity },
    { to: "/staff", label: "Issue Activity", icon: LayoutDashboard },
  ],
  admin: [
    { to: "/admin/command", label: "Command Center", icon: Shield },
    { to: "/admin/queue", label: "All Issues", icon: ClipboardList },
    { to: "/admin/assignments", label: "Assign Issues", icon: MapPin },
    { to: "/admin/staff", label: "Staff Management", icon: UserCog },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/admin/audit", label: "Audit Log", icon: FileText },
  ],
};

function Sidebar({ open, onClose }) {
  const user = useAuth();
  const items = NAV[user?.role] || [];

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <div className="sidebar-brand">
        <span className="sidebar-mark">Σ</span>
        <span>
          Nexus
          <small>Issue Command · 3000</small>
        </span>
      </div>

      <nav className="sidebar-nav" onClick={onClose}>
        {user?.role === "admin" && (
          <div className="sidebar-section">Command Layer</div>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/staff" || item.to === "/admin/command"}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <Icon strokeWidth={1.8} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <p className="sidebar-note">
        Person 4 — Issue Management Core<br />
        Real-time civic neural net · Year 3000 protocol
      </p>
    </aside>
  );
}

export default Sidebar;