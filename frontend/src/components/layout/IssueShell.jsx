import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Shield, Layers, Send, Users, BarChart3, ScrollText,
  ClipboardCheck, Activity, Inbox, Gauge,
  Flag, FileText, Bookmark, Hourglass,
} from "lucide-react";
import { getRole } from "../../store/authStore";
import "../../styles/issue-dock.css";

// Issue Management lanes per desk. The sidebar shows one item per desk
// (Report Issue / Assigned Work / Issue Command); this dock opens the rest.
const LANES = {
  citizen: [
    { to: "/citizen/report", label: "Report Issue", icon: Flag },
    { to: "/citizen/my-reports", label: "My Reports", icon: FileText },
    { to: "/citizen/saved", label: "Saved", icon: Bookmark },
  ],
  staff: [
    { to: "/staff/assigned", label: "Assigned Work", icon: ClipboardCheck },
    { to: "/staff/operations", label: "Operations", icon: Activity },
    { to: "/staff/queue", label: "City Intake", icon: Inbox },
    { to: "/staff/performance", label: "Field Load", icon: Gauge },
  ],
  admin: [
    { to: "/admin/command", label: "Issue Command", icon: Shield },
    { to: "/admin/queue", label: "All Issues", icon: Layers },
    { to: "/admin/assignments", label: "Assign Issues", icon: Send },
    { to: "/admin/staff", label: "Staff Management", icon: Users },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/admin/windows", label: "Service Windows", icon: Hourglass },
    { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  ],
};

// the glider is drawn at this width and scaled to the active lane, so the
// slide is a pure transform the GPU runs even while the next page mounts
const GLIDE_BASE = 120;

// the desk name on the dock's tag
const TAG = { admin: "Command", staff: "Field", citizen: "Citizen" };

/* ------------------------------------------------------------------
   Every Issue Management page sits here: under the app frame's top bar,
   the command dock, then the page inside .ix (where all Issue styles
   are scoped).

   Command dock: a compact glass bar (never stretched), left-aligned with
   the page content, with even space above and below so it belongs to
   neither the top bar nor the page glow.
   • a live tag (pulsing dot + desk name)
   • lanes, each with its icon (fixed widths, so nothing reflows when the
     page changes); one glider slides under the active lane as a single
     transform (move + scale), and a light sweep runs once across the bar
   • it sits in the top bar as tier 2 (portalled into #tb2-tier), so it
     stays in place while the page scrolls
   On narrow screens the lanes scroll sideways and the active one is
   brought into view; the tag steps aside.
------------------------------------------------------------------- */
function IssueShell() {
  const role = getRole();
  const lanes = LANES[role] || [];
  const { pathname } = useLocation();
  const dockRef = useRef(null);
  const railRef = useRef(null);
  const [glide, setGlide] = useState(null); // { x, w } of the active lane
  const [ready, setReady] = useState(false); // first placement without a slide
  // tier 2: the dock lives inside the top bar (#tb2-tier), so it never scrolls away
  const [slot, setSlot] = useState(undefined); // undefined = not looked yet; null = no top bar slot
  useLayoutEffect(() => { setSlot(document.getElementById("tb2-tier")); }, []);


  // place the glider under the active lane (and keep it there on resize / font load)
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const place = () => {
      const on = rail.querySelector("a.on");
      const last = rail.querySelector("a:last-of-type");
      // exact (fractional) end of the last lane, so the track never adds a sliver of scroll
      const full = last ? last.getBoundingClientRect().right - rail.getBoundingClientRect().left + rail.scrollLeft : 0;
      setGlide(on ? { x: on.offsetLeft, w: on.offsetWidth, full } : null);
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(rail);
    document.fonts?.ready?.then(place).catch(() => {});
    return () => ro?.disconnect();
  }, [pathname, slot]);

  // let the glider slide only after its first placement
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // narrow screens: bring the active lane into view inside the sideways-scrolling rail
  useEffect(() => {
    const rail = railRef.current;
    const on = rail?.querySelector("a.on");
    if (!rail || !on || rail.scrollWidth <= rail.clientWidth) return;
    const left = on.offsetLeft - (rail.clientWidth - on.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [pathname]);

  const dock = (
      <nav
        ref={dockRef}
        className={`ix-dock tone-${role || "guest"}${lanes.length > 5 ? " dense" : ""}`}
        aria-label="Issue Management"
      >
        <span className="ix-dock-tag" aria-hidden>
          <i />
          {TAG[role] || "Issues"}
        </span>
        <span className="ix-dock-sep" aria-hidden />
        <div className="ix-dock-rail" ref={railRef}>
          {glide ? (
            <span className="ix-dock-track" aria-hidden style={{ width: glide.full }}>
              <span
                className={`ix-dock-glider${ready ? " live" : ""}`}
                style={{ width: GLIDE_BASE, transform: `translateX(${glide.x}px) scaleX(${glide.w / GLIDE_BASE})` }}
              />
            </span>
          ) : null}
          {lanes.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "on" : "")}>
              <Icon size={14} strokeWidth={2} />
              <span data-label={label}>{label}</span>
            </NavLink>
          ))}
        </div>
        <span key={pathname} className="ix-dock-sweep" aria-hidden />
      </nav>
  );

  return (
    <div className="page issue-page">
      {slot === undefined ? null : slot ? createPortal(dock, slot) : dock}
      <div className="ix">
        <Outlet />
      </div>
    </div>
  );
}

export default IssueShell;