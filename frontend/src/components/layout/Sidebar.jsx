import { NavLink } from "react-router-dom";
import { useAuth } from "../../store/authStore";

const NAV = {
  citizen: [
    { to: "/citizen/report", label: "Report Issue" },
    { to: "/citizen/my-reports", label: "My Reports" },
    { to: "/citizen/saved", label: "Saved Reports" },
  ],
  staff: [
    { to: "/staff/queue", label: "Work Queue" },
    { to: "/staff/assigned", label: "Assigned Issues" },
    { to: "/staff", label: "Issue Activity" },
  ],
  admin: [
    { to: "/admin/queue", label: "Work Queue" },
    { to: "/admin/command", label: "Command Center" },
    { to: "/admin/assignments", label: "Assign Issues" },
    { to: "/admin/analytics", label: "Analytics" },
    { to: "/admin/audit", label: "Audit Log" },
  ],
};

function Sidebar({ open, onClose }) {
  const user = useAuth();
  const items = NAV[user.role];

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <div className="sidebar-brand">
        <span className="sidebar-mark">W</span>
        <span>
          Wardline
          <small>Issue Command</small>
        </span>
      </div>
      <nav className="sidebar-nav" onClick={onClose}>
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === "/staff"}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <p className="sidebar-note">
        Person 4 — Issue Management only. Auth, map, dashboard and community stay with their owners.
      </p>
    </aside>
  );
}

export default Sidebar;