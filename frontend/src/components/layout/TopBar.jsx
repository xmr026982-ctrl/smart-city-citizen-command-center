import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronDown, Check, LogOut, Activity, Layers, FolderOpen, Bookmark, Bell, User } from "lucide-react";
import "../../styles/people.css";
import { getRole, clearRole } from "../../store/authStore";
import { useSettings, initialsOf } from "../../store/settingsStore";
import { useActiveZone, setActiveZone } from "../../store/zoneStore";
import { ZONES } from "../../config/zones";
import FeedBadge from "../dashboard/FeedBadge";

const DESK = { admin: "Command Center", staff: "Field Desk", citizen: "Citizen Services" };

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
    { id: "notifications", label: "Notifications", icon: Bell, to: "/citizen/notifications" },
  ],
};

function ZoneMenu() {
  const activeId = useActiveZone();
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

  return (
    <div className="zone-menu" ref={ref}>
      <button type="button" className="loc" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MapPin size={20} strokeWidth={1.6} />
        <div>
          <strong>{active.name} <ChevronDown size={14} /></strong>
          <span>Kolkata <b>•</b> {ZONES.length} zones monitored</span>
        </div>
      </button>
      {open && (
        <ul className="zone-list" role="listbox" aria-label="Choose a zone">
          {ZONES.map((z) => (
            <li key={z.id}>
              <button type="button" role="option" aria-selected={z.id === activeId} className={z.id === activeId ? "on" : ""} onClick={() => { setActiveZone(z.id); setOpen(false); }}>
                {z.name}
                {z.id === activeId && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileMenu({ role }) {
  const navigate = useNavigate();
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const [onDuty, setOnDuty] = useState(true);
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
      setOnDuty((v) => !v);
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
    <div className="profile-menu" ref={ref}>
      <button type="button" className="profile" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="avatar">{s.avatar ? <img src={s.avatar} alt="" /> : initialsOf(s.displayName)}</span>
        <div>
          <strong>{s.displayName}</strong>
          <span>{DESK[role]}</span>
        </div>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />
      </button>

      {open && (
        <div className="profile-drop" role="menu">
          <div className="profile-head">
            <span className="avatar sm">{s.avatar ? <img src={s.avatar} alt="" /> : initialsOf(s.displayName)}</span>
            <div>
              <strong>{s.displayName}</strong>
              <span>{DESK[role]}</span>
            </div>
          </div>

          <div className="profile-list">
            {items.map((item) => {
              const Icon = item.icon;
              const isDuty = item.action === "toggle-duty";
              return (
                <button key={item.id} type="button" role="menuitem" className="profile-item" onClick={() => onItem(item)}>
                  <Icon size={16} strokeWidth={1.7} />
                  <span>{item.label}</span>
                  {isDuty && <em className={onDuty ? "on" : ""}>{onDuty ? "On" : "Off"}</em>}
                </button>
              );
            })}
          </div>

          <button type="button" className="profile-item logout" onClick={logout}>
            <LogOut size={16} strokeWidth={1.7} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const role = getRole() || "citizen";
  return (
    <header className="topbar">
      <ZoneMenu />
      <FeedBadge />
      <ProfileMenu role={role} />
    </header>
  );
}

export default TopBar;