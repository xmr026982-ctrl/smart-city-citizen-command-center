import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Building2 } from "lucide-react";
import { NAV } from "../../config/nav";
import { getRole } from "../../store/authStore";
import Sparkline from "../dashboard/Sparkline";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useStaffBadge } from "./FieldAlerts";
import { useInbox } from "../../store/notifyStore";

const DESK = { citizen: "Citizen Services", staff: "Field Desk", admin: "Civic Command" };
const LAYER = { citizen: "Citizen Layer", staff: "Field Layer", admin: "Command Layer" };

function Sidebar() {
  const role = getRole();
  const items = NAV[role] || [];
  const feed = useLiveFeed();
  const { pathname } = useLocation();
  const badge = useStaffBadge(); // staff: new assignments not yet seen
  const { unread } = useInbox(); // everyone: unread notifications

  // an item also lights up on the pages that belong to it (e.g. All Issues under Issue Command)
  const lit = (also) => (also || []).some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // tablets and phones: the sidebar is a drawer (opened from the top bar), closed on every move
  useEffect(() => { document.body.classList.remove("nav-open"); }, [pathname]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    <button type="button" className="side-veil" aria-label="Close menu" tabIndex={-1} onClick={() => document.body.classList.remove("nav-open")} />
    <aside className="sidebar" id="app-sidebar">
      <span className="side-edge" aria-hidden />
      <span className="side-frame" aria-hidden><i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /></span>

      <div className="brand">
        <div className="brand-mark">
          <Building2 size={20} strokeWidth={1.8} />
          <i />
        </div>
        <div>
          <strong>Smart Kolkata</strong>
          <span>{DESK[role] || DESK.citizen}</span>
        </div>
      </div>

      <p className="layer">{LAYER[role] || LAYER.citizen}</p>

      <nav>
        {items.map(({ to, label, icon: Icon, end, also, badge: kind }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive || lit(also) ? "active" : "")}>
            <span className="nav-ic"><Icon size={16} strokeWidth={1.9} /></span>
            {label}
            {role === "staff" && to === "/staff/assigned" && badge ? <em className="nav-badge" aria-label={`${badge} new`}>{badge}</em> : null}
            {kind === "inbox" && unread ? <em className="nav-badge inbox" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</em> : null}
          </NavLink>
        ))}
      </nav>

      <div className="sys-card">
        <div className="sys-head">
          <strong>System status</strong>
          <i className={`live${feed.mode === "offline" ? " down" : ""}`} />
        </div>
        <span>{feed.mode === "offline" ? "Connection lost · showing last data" : "All systems operational"}</span>
        <Sparkline data={feed.city.envHistory} color={feed.mode === "offline" ? "#d97706" : "#16a34a"} height={36} live />
        <small className="sys-cap">City environment index</small>
      </div>

    </aside>
    </>
  );
}

export default Sidebar;
