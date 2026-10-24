import { NavLink } from "react-router-dom";
import { Building2 } from "lucide-react";
import { NAV } from "../../config/nav";
import { clearRole, getRole } from "../../store/authStore";
import Sparkline from "../dashboard/Sparkline";
import { useLiveFeed } from "../../hooks/useLiveFeed";

const DESK = { citizen: "Citizen Services", staff: "Field Desk", admin: "Civic Command" };
const LAYER = { citizen: "Citizen Layer", staff: "Field Layer", admin: "Command Layer" };

function Sidebar() {
  const role = getRole();
  const items = NAV[role] || [];
  const feed = useLiveFeed();

  return (
    <aside className="sidebar">
      <span className="side-edge" aria-hidden />

      <div className="brand">
        <div className="brand-mark">
          <Building2 size={20} strokeWidth={1.8} />
          <i />
        </div>
        <div>
          <strong>Smart City</strong>
          <span>{DESK[role] || DESK.citizen}</span>
        </div>
      </div>

      <p className="layer">{LAYER[role] || LAYER.citizen}</p>

      <nav>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={17} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sys-card">
        <div className="sys-head">
          <strong>System Status</strong>
          <i className="live" />
        </div>
        <span>All Systems Operational</span>
        <Sparkline data={feed.city.envHistory} color="#16a34a" height={36} live />
      </div>

      <button className="leave-desk" type="button" onClick={() => { clearRole(); window.location.assign("/"); }}>
        Leave desk
      </button>
    </aside>
  );
}

export default Sidebar;