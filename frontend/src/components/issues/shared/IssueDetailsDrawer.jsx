import { useEffect, useRef, useState } from "react";
import { AdminRemoval, StaffFlag } from "./RemovalKit";
import { markRequestSeen } from "../../../store/issueStore";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  X, MapPin, Calendar, Clock, User, Tag, Gauge, LocateFixed, ArrowUpRight,
  Wrench, Shield, Check, CornerUpLeft, CheckCircle2, Send, MessageSquareText,
  Radio, Siren, Hourglass, Activity, Lock, BadgeCheck, Camera,
} from "lucide-react";
import IssueStatusBadge from "./IssueStatusBadge";
import IssuePriorityBadge from "./IssuePriorityBadge";
import CitizenReportDrawer from "../citizen/CitizenReportDrawer";
import GateDoor from "./GateDoor";
import { FieldMoves } from "../staff/FieldKit";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { ISSUE_STATUSES, STATUS_LABEL } from "../../../constants/issueStatuses";
import { ROLE_LABEL } from "../../../constants/userRoles";
import { addFieldNote, notesAccess, lastCloseNote, SEAL_PREFIX } from "../../../services/issueService";
import { useAuth } from "../../../store/authStore";
import { formatDateTime } from "../../../utils/formatDate";
import { slaOf as windowOf, span, hoursSince, resolveHours } from "../../../utils/sla";
import { useSeenFile } from "../../../store/notifyStore";
import "../../../styles/issue-drawer.css";
import { nameFor, useNames } from "../../../store/profileStore";
import TextHint from "../../ui/TextHint";
import { isMash } from "../../../utils/textGuard";

/* ------------------------------------------------------------------
   Issue file drawer for the two working desks.
   STAFF  (teal)   : Field Console. Work order, SLA clock, site, notes.
   ADMIN  (violet) : Command Console. Dispatch, confirm gate, comms log.
   Close-gate moves that carry words (request close, recall, send back)
   open a gate door above the file (shared/GateDoor.jsx).
   Notes: command and the assigned crew read and write them; anyone else
   on the field sees a locked panel (notesAccess in services/issueService).
   A citizen who reaches this drawer gets the citizen drawer instead.
   Rendered in a portal with its own .ix scope.
------------------------------------------------------------------- */

const DESK = {
  staff: {
    tone: "staff",
    crumb: "FIELD DESK",
    kind: "WORK ORDER",
    icon: Wrench,
    notePh: "Add a field note for command",
  },
  admin: {
    tone: "admin",
    crumb: "CIVIC COMMAND",
    kind: "ISSUE FILE",
    icon: Shield,
    notePh: "Add a command note for the field",
  },
};

const COPY = {
  submitted: "Report received by command",
  acknowledged: "Reviewed and queued",
  in_progress: "Crew is working the site",
  pending_review: "Field asked to close. Waiting on command",
  resolved: "Verified closed by command",
};

// Service window: same numbers and wording as every list (utils/sla), plus a sub line for the file.
function slaOf(issue) {
  const s = windowOf(issue);
  if (s.state === "closed") {
    const took = resolveHours(issue);
    if (took === null || !s.total) return { ...s, sub: "Closed" };
    return took <= s.total
      ? { ...s, sub: `Closed inside the ${span(s.total)} window` }
      : { ...s, sub: `Closed ${span(took - s.total)} past the ${span(s.total)} window` };
  }
  if (s.state === "none") return { ...s, state: "ok", sub: "No service window set" };
  if (s.state === "over") return { ...s, sub: `${span(s.total)} window breached` };
  return { ...s, sub: `of a ${span(s.total)} window` };
}

function IssueDetailsDrawer({ issue, onClose }) {
  useNames(); // names follow each person's current display name
  const user = useAuth();
  const role = user?.role || "staff";

  if (role === "citizen") return <CitizenReportDrawer issue={issue} onClose={onClose} />;
  return <DeskDrawer issue={issue} onClose={onClose} user={user} role={role} />;
}

function DeskDrawer({ issue, onClose, user, role }) {
  const desk = DESK[role] || DESK.staff;
  useSeenFile(issue?.id); // opening the file is seeing its updates
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const openId = issue ? issue.id : null;
  const [note, setNote] = useState("");
  const [gate, setGate] = useState(null); // gate door open over the file: "close" | "recall" | "sendback"
  const [moved, setMoved] = useState(null); // the last move made from this file, shown in Next move

  const [photo, setPhoto] = useState(null); // citizen photo shown full size
  const photoRef = useRef(null);
  useEffect(() => { photoRef.current = photo; });

  useEffect(() => { setNote(""); setGate(null); setMoved(null); setPhoto(null); }, [openId]);

  // command opened the file: a waiting request shows "Seen" to whoever sent it
  useEffect(() => { if (openId && role === "admin") markRequestSeen(openId); }, [openId, role]);

  // lock page scroll and close on Escape while a file is open
  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (photoRef.current) setPhoto(null); // a full-size photo closes first
      else closeRef.current();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  if (!issue) return null;

  const Mark = desk.icon;
  const sla = slaOf(issue);
  const stepIndex = Math.max(0, ISSUE_STATUSES.indexOf(issue.status));
  const timeline = issue.timeline || [];
  const comments = issue.comments || [];
  const eventOf = (step) => [...timeline].reverse().find((e) => e.status === step);
  const hasCoords = Number.isFinite(issue.lat) && Number.isFinite(issue.lng);
  const mapTo = hasCoords ? `/map?lat=${issue.lat}&lng=${issue.lng}&issueId=${issue.id}` : "/map";
  const pinX = hasCoords ? 28 + (Math.abs(issue.lng * 100) % 44) : 56;
  const pinY = hasCoords ? 26 + (Math.abs(issue.lat * 100) % 40) : 48;
  const currentUserId = user?.id || user?._id;

  const userIds = [user?.serverId, user?._id, user?.id]
  .filter(Boolean)
  .map(String);

const isMine =
  role === "staff" &&
  (
    (issue.assignedToId && userIds.includes(String(issue.assignedToId))) ||
    (
      !issue.assignedToId &&
      String(issue.assignedTo || "").trim().toLowerCase() ===
        String(user?.displayName || user?.name || "").trim().toLowerCase()
    )
  );
  const age = span(hoursSince(issue.createdAt));
  const access = notesAccess(issue, user);
  const closeNote = role === "admin" && issue.status === "pending_review" ? lastCloseNote(issue) : null;
  const returnedBanner = isMine && issue.status === "in_progress" && issue.lastReturn ? issue.lastReturn : null;

  const post = () => {
    const res = addFieldNote(issue.id, note, user);
    if (res.ok) setNote("");
  };

  const gateSent = (id, mode) => setMoved({
    id,
    text: { close: "Close requested · waiting on command", recall: "Close request recalled · back in progress", sendback: "Sent back to the field with your reason", confirm: "Close sealed. The citizen now sees Resolved" }[mode],
  });

  return createPortal(
    <div className="ix">
      <div className="idr-veil" onClick={onClose} />

      <aside className={`idr ${desk.tone}`} role="dialog" aria-modal="true" aria-label={`Issue ${issue.id}`}>
        <span className="idr-edge" aria-hidden />
        <span className="idr-scan" aria-hidden />

        {/* ---------- head ---------- */}
        <header className="idr-head">
          <div className="idr-id">
            <span className="idr-mark"><Mark size={17} strokeWidth={1.8} /><i /></span>
            <div>
              <p className="idr-crumb">{desk.crumb} <b>/</b> {desk.kind}</p>
              <p className="idr-code">{issue.id}</p>
            </div>
          </div>
          <div className="idr-head-right">
            <span className={`idr-sla-chip ${sla.state}`}><Hourglass size={12} /> {sla.label}</span>
            <button type="button" className="idr-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </header>

        <div className="idr-body">
          {/* ---------- title ---------- */}
          <section className="idr-hero">
            <h2>{issue.title}</h2>
            <div className="idr-chips">
              <IssueStatusBadge status={issue.status} />
              <IssuePriorityBadge priority={issue.priority} />
              <span className="idr-cat"><Tag size={12} /> {CATEGORY_LABEL[issue.category] || issue.category}</span>
              {isMine ? <span className="idr-mine">On you</span> : null}
              {issue.danger ? <span className="idr-flag"><Siren size={11} /> Citizen flagged danger</span> : null}
              {(issue.supporters || []).length ? <span className="idr-affected"><User size={11} /> {1 + issue.supporters.length} citizens affected</span> : null}
            </div>
          </section>

          {/* ---------- admin: command gate ---------- */}
          {role === "admin" && issue.status === "pending_review" ? (
            <section className="idr-gate">
              <div className="idr-gate-top">
                <span className="idr-gate-icon"><Siren size={16} /></span>
                <div>
                  <strong>Close request on this file{issue.returned ? <span className="idr-returns">Returned {issue.returned}×</span> : null}</strong>
                  <p>The field asked to close it. The citizen still sees In Progress until you confirm.</p>
                </div>
              </div>
              {closeNote ? (
                <blockquote className="idr-quote">
                  <p>{closeNote.body}</p>
                  <cite>{nameFor(closeNote.author)} · {formatDateTime(closeNote.createdAt)}</cite>
                </blockquote>
              ) : null}
              <div className="idr-gate-actions">
                <button type="button" className="idr-ok" onClick={() => setGate("confirm")}><CheckCircle2 size={15} /> Confirm resolved</button>
                <button type="button" className="idr-back" onClick={() => setGate("sendback")}><CornerUpLeft size={15} /> Send back to field</button>
              </div>
            </section>
          ) : null}

          {/* ---------- field: returned by command ---------- */}
          {returnedBanner ? (
            <section className="idr-returned" role="status">
              <span className="idr-returned-ic"><CornerUpLeft size={15} /></span>
              <div>
                <strong>Returned by command{issue.returned > 1 ? ` · ${issue.returned}×` : ""}</strong>
                <p>{returnedBanner.reason}</p>
                <cite>{nameFor(returnedBanner.by)} · {formatDateTime(returnedBanner.at)}</cite>
              </div>
            </section>
          ) : null}

          {/* ---------- removal: dismiss / restore / decide (admin), flag (field) ---------- */}
          {role === "admin" ? <AdminRemoval issue={issue} user={user} /> : null}
          {role === "staff" ? <StaffFlag issue={issue} user={user} /> : null}

          {/* ---------- SLA + telemetry ---------- */}
          <section className="idr-panel idr-sla">
            <div className={`idr-dial ${sla.state}`} style={{ "--p": sla.pct }}>
              <span>
                <strong>{sla.state === "closed" ? "✓" : sla.state === "off" ? "—" : sla.state === "over" ? sla.short : `${sla.pct}%`}</strong>
                <em>{sla.state === "closed" ? "done" : sla.state === "off" ? "stopped" : sla.state === "over" ? "over" : "of window"}</em>
              </span>
            </div>
            <div className="idr-sla-copy">
              <p className="idr-label"><Gauge size={12} /> Service window</p>
              <strong className={sla.state}>{sla.label}</strong>
              <span>{sla.state === "off" ? "Clock stopped · off the board" : sla.sub}</span>
              <div className="idr-tele">
                <div><em>Since report</em><b>{age}</b></div>
                <div><em>Status changes</em><b>{Math.max(0, timeline.length - 1)}</b></div>
                <div><em>Notes</em><b>{access.read ? comments.length : "—"}</b></div>
              </div>
            </div>
          </section>

          {/* ---------- dispatch tiles ---------- */}
          <section className="idr-meta">
            <Meta icon={User} label={role === "admin" ? "Assignee" : "Assigned to"} value={issue.assignedTo || "Unassigned"} warn={!issue.assignedTo} />
            <Meta icon={Activity} label="Priority" value={PRIORITY_LABEL[issue.priority] || issue.priority} />
            <Meta icon={MapPin} label="Zone" value={issue.ward} />
            <Meta icon={Radio} label="Status" value={STATUS_LABEL[issue.status]} />
            <Meta icon={Calendar} label="Reported" value={formatDateTime(issue.createdAt)} />
            <Meta icon={Clock} label="Updated" value={formatDateTime(issue.updatedAt)} />
          </section>

          {/* ---------- next move ---------- */}
          <NextMove role={role} issue={issue} isMine={isMine} user={user} moved={moved} onMoved={setMoved} onRequestClose={() => setGate("close")} onWithdraw={() => setGate("recall")} />
        
          {/* ---------- brief ---------- */}
          {issue.description ? (
            <section className="idr-panel idr-pad">
              <p className="idr-label">
                {role === "admin" ? "Citizen report" : "Field brief"}
              </p>

              <p className="idr-desc">{issue.description}</p>

              {issue.reportedBy ? (
                <div className="idr-by">
                  Filed by{" "}
                  <strong>
                    {typeof issue.reportedBy === "object"
                      ? issue.reportedBy?.name || "Unknown Citizen"
                      : issue.reportedBy || "Unknown Citizen"}
                  </strong>
                  {(issue.supporters || []).length
                    ? ` · ${issue.supporters.length} more citizen${
                        issue.supporters.length === 1 ? "" : "s"
                      } reported the same`
                    : ""}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ---------- citizen photos ---------- */}
          {(issue.photos || []).length ? (
            <section className="idr-panel idr-pad">
              <p className="idr-label"><Camera size={12} /> Evidence from the citizen · {issue.photos.length}</p>
              <div className="idr-photos">
                {issue.photos.map((ph, i) => (
                  <button key={ph.id} type="button" onClick={() => setPhoto(ph)} title="Open full size">
                    <img src={ph.url} alt={`Citizen photo ${i + 1}`} />
                  </button>
                ))}
              </div>
            </section>
          ) : issue.photosDropped ? (
            <p className="idr-empty">The citizen attached {issue.photosDropped} photo{issue.photosDropped === 1 ? "" : "s"}, but the browser had no room to keep them.</p>
          ) : null}

          {/* ---------- site ---------- */}
          <section className="idr-panel idr-geo">
            <div className="idr-geo-stage">
              <span className="idr-grid" />
              <span className="idr-cross x" style={{ top: `${pinY}%` }} />
              <span className="idr-cross y" style={{ left: `${pinX}%` }} />
              <span className="idr-ring" style={{ left: `${pinX}%`, top: `${pinY}%` }} />
              <span className="idr-ring late" style={{ left: `${pinX}%`, top: `${pinY}%` }} />
              <span className="idr-pin" style={{ left: `${pinX}%`, top: `${pinY}%` }}><LocateFixed size={15} /></span>
              <span className="idr-geo-scan" />
              <span className="idr-hud tl" /><span className="idr-hud br" />
              {hasCoords ? <span className="idr-coord">{issue.lat.toFixed(5)} N · {issue.lng.toFixed(5)} E</span> : null}
            </div>
            <div className="idr-geo-info">
              <div>
                <p className="idr-geo-name">
  {issue.locationText ||
    (typeof issue.location === "string"
      ? issue.location
      : "Location not available")}
</p>
                <p className="idr-geo-sub">
  {issue.zone ||
    issue.reportedBy?.zone ||
    issue.reportedBy?.ward ||
    "Zone not available"}
</p>
              </div>
              <Link to={mapTo} className="idr-btn">
                {role === "admin" ? "Open on command map" : "Open exact site"} <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>

          {/* ---------- timeline ---------- */}
          <section className="idr-panel idr-pad">
            <p className="idr-label">Status trace</p>
            <ol className="idr-tl">
              {ISSUE_STATUSES.map((step, i) => {
                const ev = eventOf(step);
                const state = i < stepIndex ? "done" : i === stepIndex ? "now" : "next";
                const ticked = state === "done" || (state === "now" && step === "resolved");
                return (
                  <li key={step} className={`idr-tl-row ${state}${step === "pending_review" ? " gate" : ""}`}>
                    <span className="idr-tl-rail">
                      <span className="idr-tl-dot">{ticked ? <Check size={10} strokeWidth={3} /> : null}</span>
                      {i < ISSUE_STATUSES.length - 1 ? <span className="idr-tl-line" /> : null}
                    </span>
                    <div className="idr-tl-copy">
                      <div className="idr-tl-head">
                        <strong>{STATUS_LABEL[step]}</strong>
                        {state === "now" && step !== "resolved" ? <em>Live</em> : null}
                      </div>
                      <p>{state !== "next" && ev?.note ? ev.note : COPY[step]}</p>
                      {ev && state !== "next" ? (
                        <time>{formatDateTime(ev.at)}{ev.by ? <span> · {nameFor(ev.by)}</span> : null}</time>
                      ) : ev ? (
                        // reached once, then the file moved back (sent back, reassigned, owner left)
                        <time className="wait">Earlier · {formatDateTime(ev.at)}{ev.by ? ` · ${nameFor(ev.by)}` : ""}</time>
                      ) : (
                        <time className="wait">Not reached</time>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ---------- comms log ---------- */}
          <section className="idr-panel idr-pad">
            <p className="idr-label"><MessageSquareText size={12} /> {role === "admin" ? "Comms log" : "Field notes"}</p>
            {!access.read ? (
              <div className="idr-locked">
                <span><Lock size={15} /></span>
                <p>
                  <strong>Notes are between {issue.assignedTo ? issue.assignedTo.split(" ")[0] : "the assigned crew"} and command</strong>
                  Internal notes on a file are open only to the crew it is assigned to and to command.
                </p>
              </div>
            ) : (
              <>
                {comments.length === 0 ? (
                  <p className="idr-empty">No notes on this file yet.</p>
                ) : (
                  <ul className="idr-notes">
                    {comments.map((c) => {
                      // command's closing note: the official last entry, shown as the seal
                      const seal = c.role === "admin" && c.body.startsWith(SEAL_PREFIX);
                      return (
                        <li key={c.id} className={seal ? "seal" : c.role === role ? "self" : ""}>
                          <div className="idr-note-head">
                            <strong>{nameFor(c.author)}</strong>
                            <span className={`idr-role ${c.role}`}>{ROLE_LABEL[c.role] || c.role}</span>
                            {seal ? <span className="idr-role sealed"><BadgeCheck size={10} /> Closed by command</span> : c.internal ? <span className="idr-role internal">Internal</span> : null}
                            <time>{formatDateTime(c.createdAt)}</time>
                          </div>
                          <p>{seal ? c.body.slice(SEAL_PREFIX.length) : c.body}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {access.write ? (
                  <div className="idr-compose">
                    <textarea
                      rows={3}
                      value={note}
                      placeholder={desk.notePh}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) post(); }}
                    />
                    <TextHint text={note} />
                    <div className="idr-compose-bar">
                      <span>Internal. The citizen never sees this. Ctrl + Enter to send.</span>
                      <button type="button" className="idr-btn" disabled={!note.trim() || isMash(note)} onClick={post}>
                        <Send size={14} /> Post note
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="idr-closed-note"><Lock size={12} /> Closed by command. Notes are locked for everyone.</p>
                )}
              </>
            )}
          </section>
        </div>
      </aside>
      {gate ? <GateDoor mode={gate} issue={issue} onClose={() => setGate(null)} onSent={gateSent} /> : null}
      {photo ? (
        <div className="idr-zoom" onClick={() => setPhoto(null)} role="dialog" aria-label="Citizen photo">
          <img src={photo.url} alt="Citizen photo, full size" />
          <button type="button" aria-label="Close photo"><X size={18} /></button>
        </div>
      ) : null}
    </div>,
    document.body
  );
}

/* Admin dispatch moves don't just link to Assign Issues: they carry the issue
   there as a target. Assign Issues picks the lens and page that hold it,
   locks onto the row and offers "Reassign now" + a way back to where you were.
   Already on Assign Issues? The dispatch console opens straight away.
   Field (staff): the move happens right here (Start work, Request close,
   Recall), and "Assigned Work" carries the issue there as a locked
   target, the same way. */
function NextMove({ role, issue, isMine, user, moved, onMoved, onRequestClose, onWithdraw }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  let text = "";
  let cta = "";
  let target = false;

  if (role === "admin") {
    if (issue.status === "resolved") text = "Closed and confirmed. Nothing waits on command.";
    else if (issue.status === "pending_review") text = "Use the gate above to confirm or send this back.";
    else if (!issue.assignedTo) { text = "No one is on this file. Dispatch a field operative."; cta = "Open dispatch"; target = true; }
    else { text = `${nameFor(issue.assignedTo)} is on this file. Watch the service window.`; cta = "Reassign"; target = true; }
  } else {
    if (issue.status === "resolved") text = isMine ? "Command confirmed your close. The file is done." : "Closed and confirmed by command.";
    else if (!isMine) text = issue.assignedTo ? `This file is on ${nameFor(issue.assignedTo)}. Read only.` : "No owner yet. Command dispatches it. Read only.";
    else if (issue.status === "pending_review") text = "Your close request is with command. Recall it, with a reason, if the work is not finished.";
    else if (issue.status === "in_progress") text = "Crew on site. When the work is done, ask command to close.";
    else text = "On you, not started. Start work when the crew reaches the site.";
  }
  if (moved?.id === issue.id && moved.tone !== "warn") text = `${moved.text}.`;
  const lockable = role === "staff" && isMine && issue.status !== "resolved" && pathname !== "/staff/assigned";

  return (
    <section className={`idr-next${role === "staff" ? " fld" : ""}`}>
      <span className="idr-next-dot" />
      <p><b>Next move</b>{moved?.tone === "warn" && moved.id === issue.id ? moved.text : text}</p>
      {target ? (
        <button
          type="button"
          className="idr-next-link"
          style={{ fontFamily: "inherit", cursor: "pointer" }}
          onClick={() => navigate("/admin/assignments", { state: { target: issue.id, from: pathname, open: pathname === "/admin/assignments" } })}
        >
          {cta} <ArrowUpRight size={14} />
        </button>
      ) : null}
      {role === "staff" ? (
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <FieldMoves issue={issue} user={user} onRequestClose={onRequestClose} onWithdraw={onWithdraw} onMoved={onMoved} compact />
          {lockable ? (
            <button
              type="button"
              className="idr-next-link"
              style={{ fontFamily: "inherit", cursor: "pointer" }}
              onClick={() => navigate("/staff/assigned", { state: { target: issue.id, from: pathname } })}
            >
              Assigned Work <ArrowUpRight size={14} />
            </button>
          ) : null}
        </span>
      ) : null}
    </section>
  );
}

function Meta({ icon: Icon, label, value, warn = false }) {
  return (
    <div className={`idr-meta-cell${warn ? " warn" : ""}`}>
      <span><Icon size={14} /></span>
      <div>
        <p>{label}</p>
        <strong title={value}>{value || "—"}</strong>
      </div>
    </div>
  );
}

export default IssueDetailsDrawer;