import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown, Check, LogOut, Activity, Layers, FolderOpen, Bookmark, User, Radar, Lock, Shield, ClipboardCheck,
  FileText, LifeBuoy, Settings, UserCog, Siren, Hourglass, Sparkles, Bell, Menu,
} from "lucide-react";
import { useTopTag } from "../../store/topbarContext";
import "../../styles/people.css";
import "../../styles/topbar.css";
import { getRole, clearRole, useAuth } from "../../store/authStore";
import { useSettings, initialsOf } from "../../store/settingsStore";
import { useActiveZone, setActiveZone } from "../../store/zoneStore";
import { ZONES } from "../../config/zones";
import { WARDS } from "../../constants/issueConstants";
import { useIssues, useAudit } from "../../store/issueStore";
import { useCommunity } from "../../store/communityStore";
import { slaOf, urgencyCompare } from "../../utils/sla";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { useRealtimeStatus } from "../../services/realtime";
import { useFlash, useInbox } from "../../store/notifyStore";
import { useDuty } from "../../store/dutyStore";
import { fileLink } from "../../utils/fileLink";

/* ------------------------------------------------------------------
   Top bar. One glass slab, the same on every page and for every role:
     [ left module 300 ]   [ status capsule 470 ]   [ profile module 300 ]
   Fixed sizes, so nothing on either side is ever bigger than the other.
   Left module: the zone selector on City Health / Field Health / Map,
   "Desk / Page" everywhere else (with a live focus tag). Capsule: sync,
   IST, and the one number the role lives by (admin: breached, field:
   next window, citizen: open reports). Tier 2 (#tb2-tier) holds the
   section's tabs on pages that have them (IssueShell portals them in).
------------------------------------------------------------------- */
const ROLE_TAG = { admin: "Command", staff: "Field", citizen: "Citizen" };
const WEEK = 7 * 864e5;
const COVERED = new Set(WARDS.map((w) => w.name));

const MENU = {
  admin: [
    { id: "duty", label: "Duty status", icon: Activity, action: "toggle-duty" },
    { id: "activity", label: "Command activity", icon: Layers, to: "/admin/audit" },
    { id: "interface", label: "Interface", icon: User, to: "/settings" },
  ],
  staff: [
    { id: "duty", label: "Duty status", icon: Activity, action: "toggle-duty" },
    { id: "load", label: "Field load", icon: Layers, to: "/staff/performance" },
    { id: "activity", label: "My activity", icon: FolderOpen, to: "/staff/assigned" },
  ],
  citizen: [
    { id: "reports", label: "My reports", icon: FolderOpen, to: "/citizen/my-reports" },
    { id: "saved", label: "Saved", icon: Bookmark, to: "/citizen/saved" },
    { id: "inbox", label: "Notifications", icon: Bell, to: "/notifications", inbox: true },
  ],
};

/* Focus zone for City Health and the zone cards. 15 zones are monitored
   (air, traffic, water, power); the ones that are also issue-reporting
   zones show what that role needs about them (see load below). */
function ZoneMenu({ lockedTo = "", role }) {
  const me = useAuth();
  const activeId = useActiveZone();
  const issues = useIssues();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = ZONES.find((z) => z.id === activeId) || ZONES[0];

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

  /* what each role needs to know about a zone:
     command   open · breached (every file)
     field     open · breached files that are theirs
     citizen   their own open reports, and what the city fixed this week
               (service windows are internal: citizens never see "breached") */
  const load = (name) => {
    const inZone = issues.filter((i) => i.ward === name);
    const list = inZone.filter((i) => i.status !== "resolved");
    if (role === "citizen") {
      const mine = list.filter((i) => i.reporterId === me?.id).length;
      const fixed = inZone.filter((i) => i.status === "resolved" && Date.now() - new Date(i.updatedAt).getTime() < WEEK).length;
      const parts = [mine ? `${mine} yours` : `${list.length} open`];
      if (fixed) parts.push(`${fixed} fixed this week`);
      return { text: parts.join(" · "), hot: false, good: fixed > 0 };
    }
    const over = list.filter((i) => slaOf(i).state === "over" && (role === "admin" || i.assignedTo === me?.name)).length;
    if (!over) return { text: `${list.length} open`, hot: false };
    return { text: `${list.length} · ${over} ${role === "admin" ? "breached" : "of yours breached"}`, hot: true };
  };
  // every issue zone; one the 3D city model does not include can't take the focus
  const covered = WARDS.map((w) => ZONES.find((z) => z.name === w.name) || { id: `ward-${w.name}`, name: w.name, outside: true });
  const monitored = ZONES.filter((z) => !COVERED.has(z.name));

  const item = (z, withLoad) => {
    const l = withLoad ? load(z.name) : null;
    return (
      <li key={z.id}>
        <button type="button" role="option" aria-selected={z.id === activeId} disabled={z.outside} title={z.outside ? "Not part of the 3D city model" : undefined} className={z.id === activeId ? "on" : ""} onClick={() => { setActiveZone(z.id); setOpen(false); }}>
          <span>{z.name}</span>
          {l ? <small className={l.hot ? "hot" : l.good ? "good" : ""}>{l.text}</small> : null}
          {z.id === activeId ? <Check size={14} /> : null}
        </button>
      </li>
    );
  };

  if (lockedTo) {
    return (
      <div className="zone-menu tb2-zone">
        <div className="tb2-mod" title="Set by your report">
          <span className="tb2-glyph" aria-hidden><Lock size={16} strokeWidth={1.8} /></span>
          <span className="tb2-txt">
            <b>{lockedTo}</b>
            <small>Set by your report · pin the spot</small>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="zone-menu tb2-zone" ref={ref}>
      <button type="button" className="tb2-mod click" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="tb2-glyph" aria-hidden><Radar size={16} strokeWidth={1.8} /></span>
        <span className="tb2-txt">
          <b>{active.name}</b>
          <small>{ZONES.length} monitored · {WARDS.length} in issue coverage</small>
        </span>
        <ChevronDown size={14} className="tb2-chev" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="zone-list" role="listbox" aria-label="Choose a focus zone">
          <p className="zone-group">Issue coverage</p>
          <ul>{covered.map((z) => item(z, true))}</ul>
          <p className="zone-group">Monitoring only</p>
          <ul>{monitored.map((z) => item(z, false))}</ul>
        </div>
      )}
    </div>
  );
}

/* profile menu: Notifications, with a live unread signal (the latest are on the Notifications page) */
function InboxItem({ onGo }) {
  const { unread } = useInbox();
  return (
    <button type="button" role="menuitem" className={`profile-item tb2-inbox-item${unread ? " has" : ""}`} onClick={() => onGo("/notifications")}>
      <Bell size={16} strokeWidth={1.7} />
      <span>Notifications</span>
      {unread ? <em className="tb2-signal" role="img" aria-label={`${unread} unread`} title={`${unread} unread`}><i aria-hidden /></em> : null}
    </button>
  );
}

function ProfileMenu({ role }) {
  const navigate = useNavigate();
  const s = useSettings();
  const me = useAuth();
  const [open, setOpen] = useState(false);
  const duty = useDuty();
  const ref = useRef(null);
  const items = MENU[role] || MENU.citizen;

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

  const onItem = (item) => {
    if (item.action === "toggle-duty") {
      duty?.toggle();
      return;
    }
    if (item.to) {
      navigate(item.to);
      setOpen(false);
    }
  };

  const logout = () => {
    clearRole();
    setOpen(false);
    navigate("/");
  };

  return (
    <div className={`profile-menu tb2-profile${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="tb2-mod click tb2-me" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="tb2-av">{s.avatar ? <img src={s.avatar} alt="" /> : initialsOf(s.displayName)}<i aria-hidden className={duty ? `d-${duty.status}` : ""} title={duty ? duty.label : "Online"} /></span>
        <span className="tb2-txt">
          <b>{s.displayName}</b>
          <small className="tb2-role">{ROLE_TAG[role] || ROLE_TAG.citizen}</small>
        </span>
        <ChevronDown size={14} className="tb2-chev" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div className="profile-drop" role="menu">
          <div className="profile-head">
            <span className="avatar sm">{s.avatar ? <img src={s.avatar} alt="" /> : initialsOf(s.displayName)}</span>
            <div>
              <strong>{s.displayName}</strong>
              {me?.email ? <small className="profile-mail">{me.email}</small> : null}
              <em className="profile-role">{ROLE_TAG[role] || ROLE_TAG.citizen}</em>
            </div>
          </div>

          <div className="profile-list">
            {items.map((item) => {
              const Icon = item.icon;
              const isDuty = item.action === "toggle-duty";
              if (item.inbox) return <InboxItem key={item.id} onGo={(to, state) => { navigate(to, state ? { state } : undefined); setOpen(false); }} />;
              return (
                <button key={item.id} type="button" role="menuitem" className="profile-item" onClick={() => onItem(item)}>
                  <Icon size={16} strokeWidth={1.7} />
                  <span>{item.label}</span>
                  {isDuty && duty ? <em className={`duty d-${duty.status}`}>{duty.label}</em> : null}
                </button>
              );
            })}
          </div>


          <span className="profile-sep" aria-hidden />
          <button type="button" className="profile-item logout" onClick={logout}>
            <LogOut size={16} strokeWidth={1.7} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}


const ZONE_PAGES = ["/admin", "/staff", "/citizen", "/map"];
const DESK_OF = { admin: "Civic Command", staff: "Field Desk", citizen: "Citizen Services" };
const PAGES = [
  ["/admin/command", "Issue Command", Shield], ["/admin/queue", "All Issues", Shield], ["/admin/issues", "Issue File", Shield],
  ["/admin/assignments", "Assign Issues", Shield], ["/admin/staff-desk", "Staff Desk", UserCog], ["/admin/staff", "Staff Management", Shield],
  ["/admin/analytics", "Analytics", Shield], ["/admin/windows", "Service Windows", Shield], ["/admin/audit", "Audit Log", Shield],
  ["/staff/assigned", "Assigned Work", ClipboardCheck], ["/staff/operations", "Operations", ClipboardCheck], ["/staff/queue", "City Intake", ClipboardCheck],
  ["/staff/performance", "Field Load", ClipboardCheck], ["/staff/issues", "Work Order", ClipboardCheck],
  ["/citizen/report", "Report Issue", FileText], ["/citizen/my-reports", "My Reports", FileText], ["/citizen/saved", "Saved", FileText], ["/citizen/issues", "Report", FileText],
  ["/help", "Help", LifeBuoy], ["/settings", "Settings", Settings], ["/community", "Community", LifeBuoy], ["/notifications", "Notifications", LifeBuoy],
];

function PlaceSlot({ role, pathname }) {
  const tag = useTopTag();
  const hit = PAGES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  const [, page, Icon] = hit || [null, "Smart Kolkata", LifeBuoy];
  return (
    <div className="tb2-mod" aria-label={`${DESK_OF[role] || ""} / ${page}`}>
      <span className="tb2-glyph" aria-hidden><Icon size={16} strokeWidth={1.8} /></span>
      <span className="tb2-txt">
        <small className="tb2-desk">{DESK_OF[role] || "Smart Kolkata"}</small>
        <b>{page}{tag ? <em className="tb2-tag">{tag}</em> : null}</b>
      </span>
    </div>
  );
}

/* the one number each role lives by */
function RoleItem({ role, me }) {
  const issues = useIssues();
  const navigate = useNavigate();
  const flash = useFlash();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(id); }, []);

  if (role === "staff" && flash) {
    return (
      <button type="button" className="tb2-item new" key={flash.key} onClick={() => navigate(fileLink("staff", flash.issueId))}>
        <Sparkles size={12} /> New · <b>{flash.issueId}</b>
      </button>
    );
  }
  if (role === "admin") {
    const n = issues.filter((i) => i.status !== "resolved" && slaOf(i).state === "over").length;
    return (
      <button type="button" className={`tb2-item ${n ? "red" : "ok"}`} onClick={() => navigate("/admin/queue", { state: { lens: "breached" } })} title="Open issues past their service window">
        <Siren size={12} /> {n ? `${n} breached` : "No breaches"}
      </button>
    );
  }
  if (role === "staff") {
    const mine = issues.filter((i) => i.assignedTo === me && i.status !== "resolved").sort(urgencyCompare);
    const next = mine.find((i) => slaOf(i).state !== "none");
    if (!next) return <span className="tb2-item ok"><Hourglass size={12} /> No open work</span>;
    const sla = slaOf(next);
    return (
      <button type="button" className={`tb2-item ${sla.state === "over" ? "red" : "amber"}`} onClick={() => navigate(fileLink("staff", next.id))} title={`${next.title}`}>
        <Hourglass size={12} /> {sla.state === "over" ? <><b>{next.id}</b> · {sla.short}</> : <>Next <b>{sla.short}</b> · {next.id}</>}
      </button>
    );
  }
  const open = issues.filter((i) => i.reporterId === me && i.status !== "resolved").length;
  return (
    <button type="button" className="tb2-item blue" onClick={() => navigate("/citizen/my-reports")} title="Your reports that are still open">
      <FileText size={12} /> {open} report{open === 1 ? "" : "s"} open
    </button>
  );
}

function StatusCore({ role }) {
  const me = useAuth();
  const feed = useLiveFeed();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  // how long since a moment, compact (12s, 4m, 2h, 1d)
  const since = (t) => {
    const sec = Math.max(0, Math.round((now - t) / 1000));
    return sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : sec < 86400 ? `${Math.floor(sec / 3600)}h` : `${Math.floor(sec / 86400)}d`;
  };
  const d = new Date(now);
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  /* The capsule is the live link's state (services/realtime.js), not the data's age:
       LIVE           connected; every change arrives as it happens (no number: each card dates its own reading)
       RECONNECTING   the link dropped under 20 s ago and is retrying
       OFFLINE · 3m   still down: how long this screen has gone without updates
     The server pushes every change, so an age only means something while the link is down. */
  const rt = useRealtimeStatus();
  const [link, setLink] = useState({ state: rt, at: now, ever: rt === "live" });
  if (link.state !== rt) setLink({ state: rt, at: now, ever: link.ever || rt === "live" });
  const live = rt === "live";
  const retrying = !live && link.ever && now - link.at < 20000;
  const label = live ? "Live" : retrying ? "Reconnecting" : rt === "connecting" ? "Connecting" : "Offline";
  const age = !live && !retrying && link.ever ? since(link.at) : "";
  const down = !live && !retrying && rt !== "connecting";
  const tip = live
    ? "Connected live to the city server: every change arrives as it happens."
    : retrying
      ? "The live link dropped. Reconnecting now; the screen keeps the last data it received."
      : rt === "connecting"
        ? "Opening the live link to the city server."
        : link.ever
          ? `Offline for ${since(link.at)}: this screen hasn't received updates since then. It reconnects by itself.`
          : "Can't reach the city server. It keeps trying; the screen updates once it answers.";
  return (
    <div className={`tb2-core${down ? " down" : ""}${retrying || rt === "connecting" ? " retry" : ""}`}>
      <span className="tb2-sync" title={tip}>
        <i key={feed.updatedAt} className="beat" />
        <em>{label}</em>{age ? <span className="m">{age}</span> : null}
      </span>
      <i className="tb2-sep" aria-hidden />
      <span className="tb2-clock" title="India Standard Time"><b className="m">{time}</b><em>IST</em><span>{date}</span></span>
      <i className="tb2-sep" aria-hidden />
      <RoleItem role={role} me={role === "citizen" ? me?.id : me?.name} />
    </div>
  );
}

/* The light under the bar runs only when something actually happened on
   the board or in Community (a filing, a dispatch, a decision, a vote),
   never on a timer, and never on the first load. */
function useBoardPulse() {
  const audit = useAudit();
  const c = useCommunity();
  const key = `${audit[0]?.id || ""}|${c.trail.length}`;
  const first = useRef(key);
  return key === first.current ? null : key;
}

function TopBar() {
  const role = getRole() || "citizen";
  const pulse = useBoardPulse();
  const { pathname, search } = useLocation();
  const q = new URLSearchParams(search);
  const pinning = pathname === "/map" && q.get("pick") === "1" ? q.get("zone") || "" : "";
  const zonePage = ZONE_PAGES.includes(pathname.replace(/\/$/, "") || "/");
  return (
    <header className={`tb2 tone-${role}`}>
      <div className="tb2-t1">
        <button
          type="button"
          className="tb2-menu"
          aria-label="Open menu"
          aria-controls="app-sidebar"
          onClick={() => document.body.classList.toggle("nav-open")}
        >
          <Menu size={18} strokeWidth={1.9} />
        </button>
        <div className="tb2-l">{zonePage ? <ZoneMenu lockedTo={pinning} role={role} /> : <PlaceSlot role={role} pathname={pathname} />}</div>
        <StatusCore role={role} />
        <div className="tb2-r"><ProfileMenu role={role} /></div>
      </div>
      {pulse ? <i key={pulse} className="tb2-light" aria-hidden /> : null}
      <div className="tb2-t2" id="tb2-tier" />
    </header>
  );
}

export default TopBar;
