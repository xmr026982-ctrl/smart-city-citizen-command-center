import { stamp as stamp24 } from "../../../utils/time";
import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X, Zap, MapPin, Radio, BadgeCheck, Activity, Lock, ClipboardList, Radar, ArrowUpRight, Shield, Siren,
  KeyRound, Archive, UserX, FileText,
} from "lucide-react";
import { expertiseLabel } from "../../../config/expertise";
import { CAPACITY, eventsAbout, fileCode } from "../../../store/fieldRoster";
import { RANKS, isAwaiting, uplinkPhase } from "../../../store/staffDeskStore";
import { slaOf, urgencyCompare } from "../../../utils/sla";
import { Avatar, CatGlyph, StatusPill, PriorityPill, SlaMeter, Empty, ago } from "./CommandKit";
import { nameFor } from "../../../store/profileStore";

/* ------------------------------------------------------------------
   Personnel file. Three states:
   • live      – on the roster: live work numbers, open assignments,
                 command trace. Rank and expertise are read-only here
                 (the Staff Desk owns them).
   • awaiting  – cleared but not uplinked yet: key status instead of
                 performance.
   • record    – no longer in the system (removed, or clearance denied):
                 a locked, read-only record built from the audit trail.
   Pass `person` for live/awaiting, or `record` (from personRecord()).
------------------------------------------------------------------- */

const stamp = (iso) =>
  iso ? stamp24(iso) : "—";

function useDoor(open, onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
}

function Trace({ events }) {
  return (
    <section className="ac-door-box">
      <p className="ac-kicker"><Radar size={12} /> Command trace</p>
      <div className="ac-trace" style={{ marginTop: 6 }}>
        {!events.length ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>No recorded actions yet.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className={`ac-trace-row k-${e.kind || "status"}`}>
              <span className="ac-trace-ic"><Activity size={13} /></span>
              <div style={{ minWidth: 0 }}>
                <p>{e.action}</p>
                <small>{e.actor}</small>
              </div>
              <span className="when">{ago(e.at)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function StaffDetailsDrawer({ person, record, audit = [], onClose, onOpenIssue }) {
  useDoor(Boolean(person || record), onClose);
  const { pathname } = useLocation();
  // "Manage on Staff Desk" lands on the desk with this person locked (see StaffDesk.jsx, target lock)
  const deskLock = person ? { target: person.id, from: pathname } : null;

  // everything the trail holds about them: desk events + issue work done by or for them
  const trace = useMemo(() => {
    const who = person || record;
    if (!who) return [];
    const first = who.name.split(" ")[0];
    const about = new Set(eventsAbout({ id: who.id, name: who.name }, audit).map((e) => e.id));
    return audit
      .filter((e) => about.has(e.id) || e.actor === who.name || e.action.includes(who.name) || e.action.includes(` ${first} `))
      .slice(0, 10);
  }, [audit, person, record]);

  if (record) return <RecordDoor record={record} trace={trace} onClose={onClose} />;
  if (!person) return null;

  const waiting = isAwaiting(person);
  const phase = uplinkPhase(person);
  const open = [...(person.openIssues || [])].sort(urgencyCompare);
  const breached = open.filter((i) => slaOf(i).state === "over").length;
  const pct = Math.min(100, Math.round((person.load / CAPACITY) * 100));
  const handled = person.load + person.closed;
  const closeRate = handled ? Math.round((person.closed / handled) * 100) : 0;
  const keyCopy = {
    sending: "Activation key is transmitting now.",
    failed: "The activation key was not sent. Re-transmit it from the Staff Desk.",
    stalled: `No first sign-in yet. The key went out ${ago(person.keySentAt || person.acceptedAt)} and may be lost.`,
    awaiting: `Key sent ${ago(person.keySentAt || person.acceptedAt)}. They can take work after their first sign-in.`,
  }[phase];

  return (
    <div className="ac-door-veil" onClick={onClose}>
      <aside className="ac-door" role="dialog" aria-modal="true" aria-label={person.name} onClick={(e) => e.stopPropagation()}>
        <header className="ac-door-head">
          <div>
            <p className="ac-crumb">PERSONNEL FILE <b>/</b> STF-{fileCode(person.name)}</p>
            <h2>{nameFor(person.name)}</h2>
          </div>
          <button type="button" className="ac-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="ac-door-body">
          <section className="ac-door-hero">
            <Avatar name={nameFor(person.name)} size={58} tone={waiting ? "amber" : "violet"} dot={waiting ? undefined : person.onDuty} />
            <div style={{ minWidth: 0 }}>
              <strong>{person.rank}</strong>
              <span className="ac-door-meta"><Zap size={12} /> {expertiseLabel(person.expertise)} <b style={{ color: "#cbd5e1" }}>·</b> <MapPin size={12} /> {person.zone}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {waiting ? (
                  <span className={`ac-tag ${phase === "stalled" || phase === "failed" ? "red" : "amber"}`}><KeyRound size={9} /> {phase === "stalled" ? "Uplink stalled" : phase === "failed" ? "Key not sent" : "Awaiting uplink"}</span>
                ) : (
                  <span className={`ac-tag ${person.onDuty ? "green" : ""}`}><Radio size={9} /> {person.onDuty ? "On duty" : person.duty === "break" ? "On break" : "Off duty"}</span>
                )}
                <span className={`ac-tag ${person.verified ? "violet" : "amber"}`}><BadgeCheck size={9} /> {person.verified ? "Verified" : "Unverified"}</span>
                {person.experience ? <span className="ac-tag">{person.experience}</span> : null}
              </div>
            </div>
          </section>

          {waiting ? (
            <section className={`ac-door-box ac-uplinkbox ${phase}`}>
              <span className="ac-uplinkbox-ic"><KeyRound size={18} /></span>
              <div>
                <p className="ac-kicker"><Radar size={12} /> Not uplinked yet</p>
                <p className="ac-uplinkbox-text">{keyCopy}</p>
                <Link to="/admin/staff-desk" state={deskLock} className="ac-btn sm" style={{ marginTop: 10 }}><Shield size={12} /> Open on Staff Desk <ArrowUpRight size={12} /></Link>
              </div>
            </section>
          ) : (
            <section className="ac-door-box">
              <div className="ac-perf">
                <div className="ac-dial" style={{ "--p": closeRate }}>
                  <span><strong>{closeRate}%</strong><em>closed</em></span>
                </div>
                <div>
                  <p className="ac-kicker"><Activity size={12} /> Live performance</p>
                  <div className={`ac-crew-load ${pct >= 84 ? "hot" : pct >= 50 ? "mid" : ""}`} style={{ marginTop: 10 }}>
                    <div><span>Open load</span><b>{person.load} / {CAPACITY}</b></div>
                    <span className="bar"><i style={{ width: `${Math.max(3, pct)}%` }} /></span>
                  </div>
                  <div className="ac-crew-stats" style={{ marginTop: 10 }}>
                    <div><em>Closed</em><b>{person.closed}</b></div>
                    <div><em>On board</em><b>{person.closedOnBoard}</b></div>
                    <div className={breached ? "warn" : ""}><em>Breached</em><b>{breached}</b></div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="ac-door-box">
            <p className="ac-kicker"><Lock size={12} /> Held on the Staff Desk</p>
            <div className="ac-crew-stats" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div><em>Rank</em><b style={{ fontSize: 13 }}>{person.rank} · {RANKS.indexOf(person.rank) + 1}/{RANKS.length}</b></div>
              <div><em>Expertise</em><b style={{ fontSize: 13 }}>{expertiseLabel(person.expertise)}</b></div>
            </div>
            <Link to="/admin/staff-desk" state={deskLock} className="ac-btn sm" style={{ marginTop: 12 }}><Shield size={12} /> Manage on Staff Desk <ArrowUpRight size={12} /></Link>
          </section>

          {!waiting && (
            <section className="ac-door-box">
              <p className="ac-kicker"><ClipboardList size={12} /> Open assignments · {open.length}</p>
              <div className="ac-mini" style={{ marginTop: 10 }}>
                {!open.length ? (
                  <Empty icon={ClipboardList} title="No open work" sub="Free to take a new dispatch." />
                ) : (
                  open.map((issue) => (
                    <button key={issue.id} type="button" className="ac-mini-row" onClick={() => onOpenIssue?.(issue.id)}>
                      <CatGlyph category={issue.category} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <strong>{issue.title}</strong>
                        <small><span className="ac-id">{issue.id}</span><StatusPill status={issue.status} /><PriorityPill priority={issue.priority} /></small>
                      </div>
                      <SlaMeter issue={issue} compact />
                    </button>
                  ))
                )}
              </div>
              {breached ? <p className="ac-result" style={{ marginTop: 10, color: "#b91c1c" }}><Siren size={12} /> {breached} past the service window</p> : null}
            </section>
          )}

          <Trace events={trace} />
        </div>
      </aside>
    </div>
  );
}

/* Locked, read-only record of someone who is no longer in the system. */
function RecordDoor({ record, trace, onClose }) {
  const rejected = record.state === "rejected";
  const removed = record.state === "removed";
  const seal = rejected
    ? { icon: UserX, title: "Clearance denied", line: "The request was closed. They never joined the field." }
    : removed
      ? {
          icon: Archive,
          title: "Removed from the system",
          line: `${record.released ? `${record.released} open issue${record.released === 1 ? "" : "s"} went back to dispatch. ` : ""}Past files stay in the record.`,
        }
      : { icon: Archive, title: "No longer on the roster", line: "This person is not on the Staff Desk anymore. The record below is what the trail kept." };
  const Seal = seal.icon;

  return (
    <div className="ac-door-veil" onClick={onClose}>
      <aside className="ac-door record" role="dialog" aria-modal="true" aria-label={record.name} onClick={(e) => e.stopPropagation()}>
        <header className="ac-door-head">
          <div>
            <p className="ac-crumb">{rejected ? "CLEARANCE RECORD" : "PERSONNEL RECORD"} <b>/</b> {record.code}</p>
            <h2>{record.name}</h2>
          </div>
          <button type="button" className="ac-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="ac-door-body">
          <section className="ac-door-hero">
            <Avatar name={record.name} size={58} tone="slate" />
            <div style={{ minWidth: 0 }}>
              <strong>{rejected ? "Clearance request" : record.rank || "Field staff"}</strong>
              {record.expertise || record.zone ? (
                <span className="ac-door-meta">
                  {record.expertise ? <><Zap size={12} /> {expertiseLabel(record.expertise)}</> : null}
                  {record.expertise && record.zone ? <b style={{ color: "#cbd5e1" }}>·</b> : null}
                  {record.zone ? <><MapPin size={12} /> {record.zone}</> : null}
                </span>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <span className="ac-tag red"><Lock size={9} /> {rejected ? "Denied" : removed ? "Removed" : "Off roster"}</span>
                <span className="ac-tag">Read only</span>
                {record.experience ? <span className="ac-tag">{record.experience}</span> : null}
              </div>
            </div>
          </section>

          <section className={`ac-door-box ac-seal ${rejected ? "denied" : ""}`}>
            <span className="ac-seal-ic"><Seal size={18} /></span>
            <div>
              <p className="ac-kicker">{seal.title}</p>
              <p className="ac-seal-when">{record.at ? `${stamp(record.at)} · by ${record.by}` : "Date not recorded"}</p>
              <p className="ac-seal-line">{seal.line}</p>
            </div>
          </section>

          <section className="ac-door-box">
            <p className="ac-kicker"><FileText size={12} /> {rejected ? "As requested" : "Last known file"}</p>
            <div className="ac-crew-stats" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr" }}>
              {!rejected ? <div><em>Rank</em><b style={{ fontSize: 13 }}>{record.rank || "—"}</b></div> : null}
              <div><em>Expertise</em><b style={{ fontSize: 13 }}>{record.expertise ? expertiseLabel(record.expertise) : "—"}</b></div>
              <div><em>Zone</em><b style={{ fontSize: 13 }}>{record.zone || "—"}</b></div>
              <div><em>Experience</em><b style={{ fontSize: 13 }}>{record.experience || "—"}</b></div>
              {!rejected ? <div><em>Cleared</em><b style={{ fontSize: 13 }}>{record.clearedAt ? stamp(record.clearedAt).split(",")[0] : "—"}</b></div> : null}
              {!rejected && record.closed !== undefined ? <div><em>Closed</em><b style={{ fontSize: 13 }}>{record.closed}</b></div> : null}
              {rejected && record.filedAt ? <div><em>Filed</em><b style={{ fontSize: 13 }}>{stamp(record.filedAt).split(",")[0]}</b></div> : null}
            </div>
            {rejected && record.note ? <p className="ac-seal-line" style={{ marginTop: 10 }}>&ldquo;{record.note}&rdquo;</p> : null}
          </section>

          <Trace events={trace} />
        </div>
      </aside>
    </div>
  );
}

export default StaffDetailsDrawer;
