import { clock as clock24 } from "../../utils/time";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CheckCheck, Clock, Flag, Copy, FilePlus2, Users, ShieldCheck, CheckCircle2, ArrowRightLeft, Sparkles,
  CornerUpLeft, Ban, Undo2, RotateCcw, MessageSquare, Hourglass, UserCog, Gauge, ArrowUpRight, Circle, Inbox, Lock, Radio, Vote, Megaphone, Wrench, AlertTriangle,
  BellOff, Moon, SlidersHorizontal,
} from "lucide-react";
import { useInbox, GROUPS, markNotice, markAllNotices, noticeLink, mutedGroups, inQuietHours } from "../../store/notifyStore";
import { useSettings } from "../../store/settingsStore";
import { useMinute } from "../../hooks/useMinute";
import { useUrlParam } from "../../hooks/useUrlParam";
import { useAllIssues } from "../../store/issueStore";
import { useCommunity, signalOf } from "../../store/communityStore";
import { LensDeck } from "../../components/issues/admin/CommandKit";
import "../../styles/notifications.css";

/* ------------------------------------------------------------------
   Notifications: one page for every role, each person's own inbox.
   Tiles lock a view (unread, what needs a decision, ...), chips filter,
   day groups keep it readable. Opening an item marks it read and lands
   on the file (fileLink), the person's Saved, or the Staff Desk.
   The view lives in the address (?view=unread), so Back returns to it.
------------------------------------------------------------------- */

const ICON = {
  filed: FilePlus2, supported: Users, request: Flag, close: CheckCircle2, recalled: Undo2, withdrawn: Undo2,
  duplicate: Copy, breach: Clock, window: Hourglass, clearance: UserCog, desk: ShieldCheck,
  assigned: Sparkles, reassigned: ArrowRightLeft, unassigned: ArrowRightLeft, "sent-back": CornerUpLeft, closed: CheckCircle2,
  priority: Gauge, removed: Ban, "flag-approved": Flag, "flag-declined": Flag, note: MessageSquare,
  crew: Users, started: Sparkles, resolved: CheckCircle2, dismissed: Ban, merged: Copy, restored: RotateCcw, decided: ShieldCheck,
  "proposal-decided": ShieldCheck, "proposal-response": MessageSquare, "proposal-backed": Users, "poll-opened": Vote, "poll-closed": Vote, "poll-closing": Vote,
  announcement: Megaphone, "work-notice": Wrench, "proposal-new": Sparkles, "proposal-target": Users, "proposal-due": Hourglass, "poll-ended": Vote, still: AlertTriangle,
};

const COPY = {
  admin: { kick: "Command · Signal inbox", sub: "Everything that needs command, from issues, the field and the Staff Desk. One click opens the file." },
  staff: { kick: "Field · Signal inbox", sub: "Changes to your work: new files, returns, flags and service windows. One click opens the work order." },
  citizen: { kick: "Citizen · Updates", sub: "What happened to your reports and the ones you follow. One click opens the report." },
};

/* the four tiles: one view each */
const TILES = {
  admin: [
    { id: "unread", label: "Unread", sub: "Since you last looked", icon: Bell, tone: "acc" },
    { id: "decide", label: "Needs a decision", sub: "Requests, flags, closes, clearance", icon: Flag, tone: "amber" },
    { id: "breach", label: "Breached", sub: "Past their service window", icon: Clock, tone: "red" },
    { id: "duplicate", label: "Duplicates", sub: "Possible repeats to merge", icon: Copy, tone: "ink" },
  ],
  staff: [
    { id: "unread", label: "Unread", sub: "Since you last looked", icon: Bell, tone: "acc" },
    { id: "work", label: "New work", sub: "Assigned, moved, notes", icon: Sparkles, tone: "green" },
    { id: "returns", label: "Returns and flags", sub: "Sent back, flags decided", icon: CornerUpLeft, tone: "amber" },
    { id: "windows", label: "Service windows", sub: "Closing or breached", icon: Hourglass, tone: "red" },
  ],
  citizen: [
    { id: "unread", label: "Unread", sub: "Since you last looked", icon: Bell, tone: "acc" },
    { id: "mine", label: "My reports", sub: "Crews, progress, fixes", icon: FilePlus2, tone: "green" },
    { id: "following", label: "Following", sub: "Reports and proposals you back", icon: Users, tone: "ink" },
    { id: "decisions", label: "Decisions", sub: "Requests and outcomes", icon: ShieldCheck, tone: "amber" },
  ],
};

/* tile tones in the shared lens deck: the role colour, a status colour, or neutral ink */
const TONE = { acc: undefined, amber: "amber", red: "red", green: "green", ink: "ink" };

const PAGE = 25;
const DAY = 864e5;

function dayLabel(t) {
  const d = new Date(t);
  const today = new Date();
  const y = new Date(today.getTime() - DAY);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
const clock = (t) => clock24(t);

function matches(n, view) {
  if (view === "all") return true;
  if (view === "unread") return n.unread;
  if (view === "decide") return Boolean(n.decide);
  return n.group === view;
}

function Row({ n, role, onOpen, onToggle }) {
  const Icon = ICON[n.kind] || Bell;
  const t = noticeLink(n, role);
  return (
    <li className={`nx-row t-${n.tone}${n.unread ? " new" : ""}`}>
      <button type="button" className="nx-hit" onClick={() => onOpen(n, t)} aria-label={`${n.title}. ${n.line}`}>
        <span className="nx-u" aria-hidden />
        <span className="nx-ic" aria-hidden><Icon size={16} strokeWidth={1.9} /></span>
        <span className="nx-body">
          <b className="nx-title">
            {n.title}
            {n.decide ? <em className="nx-tag amber">Decide</em> : null}
            {n.tone === "alert" && n.kind === "breach" ? <em className="nx-tag red">Breach</em> : null}
          </b>
          <span className="nx-line">{n.line}</span>
        </span>
        <span className="nx-side">
          <time dateTime={n.at}>{clock(n.t)}</time>
          {t ? (
            <span className={`nx-go${t.locked ? " locked" : ""}`}>
              {t.locked ? <Lock size={11} /> : null}{t.label}{t.locked ? null : <ArrowUpRight size={12} />}
            </span>
          ) : null}
        </span>
      </button>
      <button type="button" className="nx-dot" onClick={() => onToggle(n)} title={n.unread ? "Mark as read" : "Mark as unread"} aria-label={n.unread ? "Mark as read" : "Mark as unread"}>
        <Circle size={9} />
      </button>
    </li>
  );
}

const POPUPS = { all: "Everything", urgent: "Urgent only", off: "Off" };

export default function Notifications() {
  const { me, role, items, unread } = useInbox();
  const prefs = useSettings();
  useMinute(); // quiet hours start and end on their own
  const muted = mutedGroups(role, prefs);
  const quietNow = inQuietHours(prefs);
  const groups = GROUPS[role].filter((g) => !muted.includes(g.id));
  const navigate = useNavigate();
  const VIEWS = ["all", "unread", "decide", ...GROUPS[role].map((g) => g.id)];
  const [view, setView] = useUrlParam("view", { allowed: VIEWS, fallback: "all" });
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [view]);

  const counts = useMemo(() => {
    const c = { all: items.length, unread: unread, decide: items.filter((n) => n.decide).length };
    GROUPS[role].forEach((g) => { c[g.id] = items.filter((n) => n.group === g.id).length; });
    return c;
  }, [items, unread, role]);

  const list = useMemo(() => items.filter((n) => matches(n, view)), [items, view]);

  // citizens: how many reports and proposals they follow (the tile counts updates; this says what they come from)
  const allIssues = useAllIssues();
  const community = useCommunity();
  const followCount = useMemo(() => {
    if (role !== "citizen" || !me) return 0;
    const reports = allIssues.filter((i) => !i.removed && i.reporterId !== me.id && ((i.savedBy || []).includes(me.id) || (i.supporters || []).some((x) => x.id === me.id))).length;
    const proposals = community.proposals.filter((p) => p.by.id !== me.id && signalOf(p, me.id)).length;
    return reports + proposals;
  }, [role, me, allIssues, community.proposals]);
  const days = useMemo(() => {
    const out = [];
    list.slice(0, shown).forEach((n) => {
      const label = dayLabel(n.t);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(n);
    });
    return out;
  }, [list, shown]);

  const zones = useMemo(() => {
    const m = new Map();
    list.forEach((n) => { if (n.zone) m.set(n.zone, (m.get(n.zone) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [list]);
  const zmax = Math.max(1, ...zones.map((z) => z[1]));

  const open = (n, t) => {
    if (n.unread) markNotice(me.id, n.key, true);
    if (t && !t.locked && t.to) navigate(t.to, t.state ? { state: t.state } : undefined);
  };
  const toggle = (n) => markNotice(me.id, n.key, n.unread);
  const copy = COPY[role];
  const empty = view === "unread" ? "You're all caught up." : view === "all" ? "Nothing yet. Changes to your work show up here the moment they happen." : "Nothing in this view.";

  return (
    <main className={`page nx tone-${role}`}>
      <header className="nx-head">
        <div>
          <p className="nx-kick"><i />{copy.kick}</p>
          <h1>Notifications</h1>
          <p className="nx-sub">{copy.sub}</p>
        </div>
        <div className="nx-acts">
          <button type="button" className="nx-btn" onClick={() => markAllNotices(me.id)} disabled={!unread}>
            <CheckCheck size={15} /> Mark all read
          </button>
        </div>
      </header>

      <LensDeck
        value={TILES[role].some((t) => t.id === view) ? view : "all"}
        onChange={setView}
        readout={`${list.length} of ${items.length}`}
        tiles={TILES[role].map((tile) => {
          const v = counts[tile.id] || 0;
          return {
            id: tile.id,
            icon: tile.icon,
            label: tile.label,
            value: v,
            sub: muted.includes(tile.id) ? "Muted in Settings" : tile.id === "following" ? (followCount ? `Updates from the ${followCount} you follow` : "Follow a report from Community") : tile.sub,
            meter: items.length ? (v / items.length) * 100 : 0,
            tone: TONE[tile.tone],
          };
        })}
      />

      <nav className="nx-chips" aria-label="Filter">
        {[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }, ...groups].map((g) => (
          <button key={g.id} type="button" className={`nx-chip${view === g.id ? " on" : ""}`} onClick={() => setView(g.id)}>
            {g.label} <b>{counts[g.id] || 0}</b>
          </button>
        ))}
      </nav>

      <div className="nx-cols">
        <section className="nx-list" aria-label="Notifications">
          {!list.length ? (
            <div className="nx-empty"><Inbox size={22} /><p>{empty}</p></div>
          ) : (
            days.map((d) => (
              <div key={d.label} className="nx-day">
                <p className="nx-sec"><span>{d.label}</span><span>{d.items.length}</span></p>
                <ul>{d.items.map((n) => <Row key={n.key} n={n} role={role} onOpen={open} onToggle={toggle} />)}</ul>
              </div>
            ))
          )}
          {list.length > shown ? (
            <button type="button" className="nx-more" onClick={() => setShown((s) => s + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more · {list.length - shown} older</button>
          ) : null}
        </section>

        <aside className="nx-rail">
          <div className="nx-card">
            <p className="nx-sec"><span>Where they come from</span><span>{list.length}</span></p>
            {zones.length ? zones.map(([z, v]) => (
              <div key={z} className="nx-zbar">
                <span>{z}</span>
                <i><b style={{ width: `${Math.round((v / zmax) * 100)}%` }} /></i>
                <span className="m">{v}</span>
              </div>
            )) : <p className="nx-quiet">No zone in this view.</p>}
          </div>
          <div className="nx-card nx-live">
            <p className="nx-kick sm"><i />Delivery</p>
            <div className="nx-kv"><span><Radio size={13} /> Live on this desk</span><em className="ok">On</em></div>
            <div className="nx-kv"><span><Bell size={13} /> Pop-ups</span><em className={prefs.popups === "off" ? "" : "acc"}>{quietNow && prefs.popups !== "off" ? "Urgent only" : POPUPS[prefs.popups] || POPUPS.all}</em></div>
            <div className="nx-kv"><span><Moon size={13} /> Quiet hours</span><em className={quietNow ? "acc" : ""}>{prefs.quietHours ? `${prefs.quietFrom}–${prefs.quietTo}${quietNow ? " · now" : ""}` : "Off"}</em></div>
            <div className="nx-kv"><span><BellOff size={13} /> Muted</span><em>{muted.length ? `${muted.length} group${muted.length === 1 ? "" : "s"}` : "None"}</em></div>
            <div className="nx-kv"><span><Inbox size={13} /> Kept for</span><em>14 days</em></div>
            <button type="button" className="nx-set" onClick={() => navigate("/settings#alerts")}><SlidersHorizontal size={13} /> Alert settings</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
