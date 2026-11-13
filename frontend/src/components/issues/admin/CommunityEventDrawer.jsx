import { clock, day, stamp } from "../../../utils/time";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Users, X, ArrowUpRight, Clock, Shield, MapPin, Vote, Megaphone, Construction, Lightbulb, EyeOff, Archive } from "lucide-react";
import { ago } from "./CommandKit";
import {
  useCommunity, PROPOSAL_STATUS, residentsOf, supportersOf, pollTotals, pollOpen, announcementLive,
} from "../../../store/communityStore";
import { nameFor } from "../../../store/profileStore";
import { communityRefOf } from "../../../utils/communityRef";
import "../../../styles/gate-door.css";
import "../../../styles/policy-drawer.css";

/* ------------------------------------------------------------------
   Community event file (Audit Log). Opens from a community line that
   names a proposal (PRP-), poll (POL-), announcement (ANN-) or work
   notice (WN-): the item as it is now (live), and a way into Community.
   An item no longer on the board opens as a read-only record built from
   the audit line itself.
------------------------------------------------------------------- */


const TYPE = {
  PRP: { label: "Proposal", icon: Lightbulb, open: (id) => ({ open: id }) },
  POL: { label: "Poll", icon: Vote, open: (id) => ({ poll: id }) },
  ANN: { label: "Announcement", icon: Megaphone, open: (id) => ({ focus: id }) },
  WN: { label: "Work notice", icon: Construction, open: (id) => ({ focus: id }) },
};

const zonesText = (z) => (!z || z === "all" || (Array.isArray(z) && z.includes("all")) ? "Every zone" : Array.isArray(z) ? z.join(", ") : z);

function Facts({ items }) {
  return (
    <div className="pd-facts">
      {items.filter(Boolean).map((f) => (
        <div key={f.k}><em>{f.icon}{f.k}</em><b>{f.v}</b>{f.s ? <small>{f.s}</small> : null}</div>
      ))}
    </div>
  );
}

function Rows({ rows }) {
  return (
    <div className="pd-list">
      {rows.filter(Boolean).map((r, i) => (
        <div key={r.name} className={`pd-row ${r.tone || "note"}`} style={{ animationDelay: `${i * 45}ms` }}>
          <div className="pd-name"><b>{r.name}</b><em>{r.label}</em></div>
          {r.value !== undefined ? <div className="pd-vals"><span className="to">{r.value}</span></div> : null}
        </div>
      ))}
    </div>
  );
}

function body(ref, c) {
  const kind = ref.split("-")[0];
  if (kind === "PRP") {
    const p = c.proposals.find((x) => x.id === ref);
    if (!p) return null;
    const st = PROPOSAL_STATUS[p.status] || { label: p.status };
    return {
      title: p.title,
      lead: p.summary,
      rows: [
        { name: "Status", label: st.label, tone: p.status === "notnow" ? "shorter" : p.status === "review" ? "note" : "longer" },
        { name: "Residents behind it", label: `Target ${p.target}`, value: residentsOf(p) },
        { name: "Supporters from other zones", label: "Backing", value: supportersOf(p) },
        p.concerns.length ? { name: "Concerns raised", label: [...new Set(p.concerns.map((x) => x.reason))].join(" · "), value: p.concerns.length, tone: "shorter" } : null,
        p.responses.length ? { name: "Official responses", label: "On the record", value: p.responses.length } : null,
        p.decision ? { name: "Decision", label: `${p.decision.reason}${p.decision.issueId ? ` · ${p.decision.issueId}` : ""}${p.decision.pollId ? ` · ${p.decision.pollId}` : ""}`, tone: "longer" } : null,
      ],
      facts: [
        { k: "Zone", icon: <MapPin size={11} />, v: p.ward },
        { k: "Filed", icon: <Clock size={11} />, v: stamp(new Date(p.at)), s: ago(p.at) },
      ],
    };
  }
  if (kind === "POL") {
    const p = c.polls.find((x) => x.id === ref);
    if (!p) return null;
    const { counts, total } = pollTotals(p);
    const win = p.outcome ? p.options.find((o) => o.id === p.outcome.optionId) : null;
    return {
      title: p.question,
      lead: win ? `Outcome: ${win.label} · ${p.outcome.note}` : pollOpen(p) ? `Open until ${clock(new Date(p.closesAt))} IST, ${day(new Date(p.closesAt))}.` : "Ended · the outcome isn't published yet.",
      rows: p.options.map((o) => ({ name: o.label, label: total ? `${Math.round(((counts[o.id] || 0) / total) * 100)}% of ${total} vote${total === 1 ? "" : "s"}` : "No votes yet", value: counts[o.id] || 0, tone: win?.id === o.id ? "longer" : "note" })),
      facts: [
        { k: "Zone", icon: <MapPin size={11} />, v: zonesText(p.ward) },
        { k: "Opened", icon: <Clock size={11} />, v: stamp(new Date(p.opensAt)), s: ago(p.opensAt) },
        p.from ? { k: "From", icon: <Lightbulb size={11} />, v: p.from.id } : null,
      ],
    };
  }
  if (kind === "ANN") {
    const a = c.announcements.find((x) => x.id === ref);
    if (!a) return null;
    return {
      title: a.title,
      lead: a.body || "No further text.",
      rows: [
        { name: "Reaches", label: [a.audience.citizens ? "Citizens" : null, a.audience.staff ? "Field crews" : null].filter(Boolean).join(" · ") },
        { name: "Status", label: a.hidden ? `Hidden · ${a.hidden.reason}` : announcementLive(a) ? `Live until ${clock(new Date(a.until))} IST, ${day(new Date(a.until))}` : "Ended", tone: a.hidden ? "shorter" : announcementLive(a) ? "longer" : "note" },
      ],
      facts: [
        { k: "Zones", icon: <MapPin size={11} />, v: zonesText(a.zones) },
        { k: "Published", icon: <Clock size={11} />, v: stamp(new Date(a.at)), s: ago(a.at) },
      ],
    };
  }
  if (kind === "WN") {
    const n = c.notices.find((x) => x.id === ref);
    if (!n) return null;
    const live = !n.hidden && new Date(n.to).getTime() > Date.now();
    return {
      title: `${n.kind} · ${n.issueId}`,
      lead: n.note || "No note.",
      rows: [
        { name: "Window", label: `${clock(new Date(n.from))} → ${clock(new Date(n.to))} IST · ${day(new Date(n.from))}` },
        { name: "Status", label: n.hidden ? `Hidden · ${n.hidden.reason}` : live ? "Live" : "Ended", tone: n.hidden ? "shorter" : live ? "longer" : "note" },
      ],
      facts: [
        { k: "Zone", icon: <MapPin size={11} />, v: n.ward },
        { k: "Crew", icon: <Shield size={11} />, v: nameFor(n.by) },
      ],
    };
  }
  return null;
}

function CommunityEventDrawer({ event, onClose }) {
  const navigate = useNavigate();
  const community = useCommunity();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const boxRef = useRef(null);

  useEffect(() => {
    if (!event) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => boxRef.current?.focus(), 60);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey, true); document.body.style.overflow = prev; };
  }, [event]);

  if (!event) return null;
  const ref = communityRefOf(event);
  const type = TYPE[ref?.split("-")[0]] || { label: "Community", icon: Users };
  const Icon = type.icon;
  const view = ref ? body(ref, community) : null;
  const at = new Date(event.at);

  return createPortal(
    <div className="ix">
      <div className="gd-veil" onClick={onClose} />
      <aside className="gd violet pd" role="dialog" aria-modal="true" aria-label={`${type.label} ${ref || ""}`}>
        <span className="gd-edge" aria-hidden />
        <header className="gd-head">
          <div className="gd-id">
            <span className="gd-mark"><Icon size={18} /></span>
            <div>
              <p className="gd-kicker">Audit · {type.label}{view ? " · live" : " · record"}</p>
              <p className="gd-code">{ref || "Community"} · {clock(at)} · {day(at)}</p>
            </div>
          </div>
          <button type="button" className="gd-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="gd-body" ref={boxRef} tabIndex={-1}>
          {view ? (
            <>
              <div>
                <h2>{view.title}</h2>
                <p className="gd-lead">{view.lead}</p>
              </div>
              <Rows rows={view.rows} />
              <Facts items={view.facts} />
            </>
          ) : (
            <>
              <div>
                <h2>{ref ? `${ref} is no longer on the board` : "Community action"}</h2>
                <p className="gd-lead">This is the record kept in the audit trail. The item itself can't be opened.</p>
              </div>
              <Rows rows={[{ name: "Recorded action", label: event.action, tone: "note" }]} />
            </>
          )}
          <div className="pd-facts">
            <div><em>{view ? <Shield size={11} /> : <Archive size={11} />} This line by</em><b>{nameFor(event.actor) || "Command"}</b><small>{event.role === "staff" ? "Field" : event.role === "citizen" ? "Citizen" : "Command"}</small></div>
            <div><em><Clock size={11} /> When</em><b>{stamp(at)}</b><small>{ago(event.at)}</small></div>
          </div>
          {view && /hidden/i.test(JSON.stringify(view.rows)) ? <p className="gd-lead"><EyeOff size={12} /> Hidden items stay on the record for command; citizens no longer see them.</p> : null}
        </div>

        <footer className="gd-foot">
          <button type="button" className="gd-btn" onClick={onClose}>Close</button>
          {view && TYPE[ref.split("-")[0]] ? (
            <button type="button" className="gd-btn go" onClick={() => { onClose(); navigate("/community", { state: TYPE[ref.split("-")[0]].open(ref) }); }}>
              Open in Community <ArrowUpRight size={14} />
            </button>
          ) : null}
        </footer>
      </aside>
    </div>,
    document.body
  );
}

export default CommunityEventDrawer;
