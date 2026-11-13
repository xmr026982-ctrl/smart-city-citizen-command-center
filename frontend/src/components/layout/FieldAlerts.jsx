import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles, CornerUpLeft, Ban, CheckCircle2, ArrowRightLeft, X, ArrowUpRight, Flag, Clock, Hourglass, Copy, UserCog,
  Users, ShieldCheck, RotateCcw, MessageSquare, Gauge, Bell, Undo2, FilePlus2, Vote, Megaphone, Wrench, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../store/authStore";
import { useAudit, useAllIssues } from "../../store/issueStore";
import { flashNew, useFieldUnread, useInbox, markNotice, noticeLink, popUpAllowed } from "../../store/notifyStore";
import { getSettings } from "../../store/settingsStore";
import "../../styles/field-alerts.css";

/* ------------------------------------------------------------------
   Live alerts, every role. Whatever page you're on, a new notification
   that needs you slides in at the top right, in your role colour, with
   an Open button that goes where the notification goes (and marks it
   read). Fed by the same inbox as the Notifications page.
     admin    what needs a decision, breaches, duplicates, danger reports
     staff    changes to your work, service windows closing / breached
     citizen  your reports and the ones you follow
   On the Notifications page itself the list updates live, so no alerts.
   On sign-in: one summary of what landed while you were away.
   Max 3 on screen, each leaves after 10 s.
   Settings · Alerts decides what may pop up: everything, urgent only
   or nothing, and quiet hours (urgent only). Muted groups never arrive.
------------------------------------------------------------------- */
const LIFE = 10000;
const ICON = {
  assigned: Sparkles, reassigned: ArrowRightLeft, unassigned: ArrowRightLeft, removed: Ban, "flag-declined": Flag, "flag-approved": Flag,
  "sent-back": CornerUpLeft, closed: CheckCircle2, window: Hourglass, breach: Clock, priority: Gauge, note: MessageSquare,
  request: Flag, close: CheckCircle2, duplicate: Copy, clearance: UserCog, desk: ShieldCheck, filed: FilePlus2, supported: Users,
  crew: Users, started: Sparkles, resolved: CheckCircle2, dismissed: Ban, merged: Copy, restored: RotateCcw, decided: ShieldCheck,
  "proposal-decided": ShieldCheck, "proposal-response": MessageSquare, "proposal-backed": Users, "poll-opened": Vote, "poll-closed": Vote, "poll-closing": Vote,
  announcement: Megaphone, "work-notice": Wrench, "proposal-new": Sparkles, "proposal-target": Users, "proposal-due": Hourglass, "poll-ended": Vote, still: AlertTriangle, recalled: Undo2, withdrawn: Undo2,
};

/* which notifications interrupt you (the rest wait quietly in the inbox) */
function worthAnAlert(n, role) {
  if (!popUpAllowed(n, getSettings())) return false;
  if (role === "admin") return Boolean(n.decide) || n.kind === "breach" || n.kind === "still" || (n.kind === "filed" && n.tone === "alert");
  return true;
}

/* staff sidebar: new assignments not yet seen on Assigned Work */
export function useStaffBadge() {
  const me = useAuth();
  const audit = useAudit();
  const everything = useAllIssues();
  return useFieldUnread(audit, everything, me?.role === "staff" ? me?.name : null).assigned.length;
}

/* Where the stack sits. Bottom right by default; while a drawer is open on the right it docks
   just outside the drawer's left edge, so it never lands on the drawer's buttons. When the
   drawer fills the screen (phones) the stack drops from the top instead. Centred dialogs
   leave it where it is. */
function findDrawer() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const roots = document.querySelectorAll('[aria-modal="true"]');
  for (const root of roots) {
    for (const el of [root, ...root.children]) {
      const r = el.getBoundingClientRect();
      if (r.width < 240 || r.height < vh * 0.6) continue;
      if (Math.abs(r.right - vw) > 4) continue; // docked on the right edge
      if (r.width >= vw - 4 && el === root && root.children.length) continue; // a full-screen veil: look at its panel
      return r;
    }
  }
  return null;
}
function useDock(active) {
  const [dock, setDock] = useState(null); // null | { right } | { top: true }
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0, settle = 0;
    const measure = () => {
      const r = findDrawer();
      const vw = window.innerWidth;
      const next = !r ? null : r.left < 360 + 32 ? { top: true } : { right: Math.round(vw - r.left + 16) };
      setDock((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    };
    const schedule = () => {
      cancelAnimationFrame(raf); raf = requestAnimationFrame(measure);
      clearTimeout(settle); settle = setTimeout(measure, 420); // after the drawer's slide-in
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal", "class"] });
    window.addEventListener("resize", schedule);
    schedule();
    return () => { mo.disconnect(); window.removeEventListener("resize", schedule); cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [active]);
  return active ? dock : null;
}

function FieldAlerts() {
  const { me, role, items } = useInbox();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [list, setList] = useState([]);
  const dock = useDock(list.length > 0);
  const seen = useRef(null);
  const greeted = useRef(""); // the away summary shows once per sign-in (StrictMode runs effects twice)
  const here = useRef(pathname);
  here.current = pathname;

  // on sign-in: what landed while away
  useEffect(() => {
    if (!me?.id || greeted.current === me.id) return;
    greeted.current = me.id;
    seen.current = new Set(items.map((n) => n.key));
    if (pathname === "/notifications") return;
    const fresh = items.filter((n) => n.unread && worthAnAlert(n, role));
    if (!fresh.length) return;
    if (fresh.length === 1) { push(fresh[0]); return; }
    const assigned = fresh.filter((n) => n.kind === "assigned");
    if (role === "staff" && assigned.length && pathname !== "/staff/assigned") {
      push({ key: `away-${Date.now()}`, kind: "assigned", tone: "new", title: `${assigned.length} new assignment${assigned.length === 1 ? "" : "s"}`, line: "Landed while you were away", go: { label: "Assigned Work", to: "/staff/assigned" } });
      return;
    }
    const decide = fresh.filter((n) => n.decide).length;
    const total = items.filter((n) => n.unread).length; // the same number the sidebar shows
    push({
      key: `away-${Date.now()}`, kind: "inbox", tone: "new", title: `${total} unread notifications`,
      line: role === "admin" && decide ? `${decide} of them need${decide === 1 ? "s" : ""} a decision` : "Landed while you were away",
      go: { label: "Open", to: "/notifications" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  // live: anything new for me
  useEffect(() => {
    if (!me?.id || !seen.current) return;
    const fresh = items.filter((n) => !seen.current.has(n.key));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current.add(n.key));
    fresh.slice(0, 3).reverse().forEach((n) => {
      if (n.kind === "assigned" && n.ref?.id) flashNew({ ...n, issueId: n.ref.id });
      if (!n.unread || !worthAnAlert(n, role) || here.current === "/notifications") return;
      // Assigned Work shows new work in its own list
      if (n.kind === "assigned" && here.current === "/staff/assigned") return;
      push(n);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function push(n) {
    const toastKey = `${n.key}-${Date.now()}`;
    setList((cur) => [{ ...n, toastKey }, ...cur.filter((x) => x.key !== n.key)].slice(0, 3));
    setTimeout(() => setList((cur) => cur.filter((x) => x.toastKey !== toastKey)), LIFE);
  }
  const close = (key) => setList((cur) => cur.filter((x) => x.toastKey !== key));
  const open = (n) => {
    close(n.toastKey);
    if (!n.go && n.key) markNotice(me.id, n.key, true);
    const t = n.go || noticeLink(n, role, pathname);
    if (t?.to) navigate(t.to, t.state ? { state: t.state } : undefined);
  };

  if (!list.length) return null;
  return createPortal(
    <div
      className={`fa-stack tone-${role}${dock?.right ? " docked" : ""}${dock?.top ? " docked-top" : ""}`}
      style={dock?.right ? { right: `${dock.right}px` } : undefined}
      role="status" aria-live="polite"
    >
      {list.map((n) => {
        const Icon = ICON[n.kind] || Bell;
        const t = n.go || noticeLink(n, role, pathname);
        return (
          <div key={n.toastKey} className={`fa-card ${n.tone || "new"}`} style={{ "--life": `${LIFE}ms` }}>
            <span className="fa-ic"><Icon size={15} /></span>
            <div className="fa-main">
              <b>{n.title}</b>
              <p>{n.ref?.id && !String(n.line || "").includes(n.ref.id) ? <em className="fa-id">{n.ref.id}</em> : null}<span className="fa-line">{n.line}</span></p>
            </div>
            <div className="fa-acts">
              {t && !t.locked ? (
                <button type="button" className="fa-go" onClick={() => open(n)} aria-label={n.go ? t.label : "Open"} title={n.go ? t.label : "Open"}>
                  <ArrowUpRight size={14} />
                </button>
              ) : null}
              <button type="button" className="fa-x" aria-label="Dismiss" onClick={() => close(n.toastKey)}><X size={13} /></button>
            </div>
            <i className="fa-life" aria-hidden />
          </div>
        );
      })}
    </div>,
    document.body
  );
}

export default FieldAlerts;
