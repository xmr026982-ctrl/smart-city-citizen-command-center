import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Undo2, Trash2, Flag, MessageSquareWarning, CheckCircle2, XCircle, Send, Eye, Gavel, RotateCcw, Ban, Check, Lock,
} from "lucide-react";
import {
  WITHDRAW_REASONS, DISMISS_REASONS, FLAG_REASONS, canWithdraw, withdrawIssue, requestRemoval, dismissIssue,
  restoreIssue, decideRequest, openRequest, lastRequest, getIssues, canRestore, canFlagWith, onSite, FLAG_ON_SITE,
  possibleDuplicates, mergeIssue,
} from "../../../store/issueStore";
import { formatDateTime } from "../../../utils/formatDate";
import "../../../styles/removal.css";
import { nameFor } from "../../../store/profileStore";
import TextHint from "../../ui/TextHint";
import { isMash } from "../../../utils/textGuard";

/* ------------------------------------------------------------------
   Removal kit: everything for taking an issue off the board.
   HoldButton (press and hold to confirm), ReasonChips, RequestTrack
   (Sent → Seen → Decided), the citizen / staff / admin panels for the
   issue drawers, RequestCard for the Issue Command decision queue,
   and the Undo notice (one at a time, drains over 8 seconds).
------------------------------------------------------------------- */

const HOLD_MS = 1000;

/* press and hold: a ring fills; let go early and nothing happens */
export function HoldButton({ label, hint, tone = "", disabled = false, onConfirm, icon: Icon = Check }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);
  const done = useRef(false);

  const stop = () => { cancelAnimationFrame(raf.current); if (!done.current) setP(0); };
  const begin = (e) => {
    if (disabled) return;
    e.preventDefault();
    done.current = false;
    start.current = performance.now();
    const step = (t) => {
      const v = Math.min(1, (t - start.current) / HOLD_MS);
      setP(v);
      if (v >= 1) { done.current = true; setP(0); onConfirm(); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const key = (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) begin(e); };
  const keyUp = (e) => { if (e.key === "Enter" || e.key === " ") stop(); };

  return (
    <button
      type="button"
      className={`rq-hold ${tone}${p > 0 ? " holding" : ""}`}
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onKeyDown={key}
      onKeyUp={keyUp}
      style={{ "--p": p }}
      aria-label={`${label}. ${hint || "Press and hold to confirm"}`}
    >
      <span className="rq-ring" aria-hidden><i /></span>
      <Icon size={14} />
      <span>{p > 0 ? hint || "Keep holding" : label}</span>
    </button>
  );
}

export function ReasonChips({ reasons, value, onChange, label = "Reason", locked = [] }) {
  return (
    <div className="rq-reasons" role="radiogroup" aria-label={label}>
      {reasons.map((r) => {
        const lock = locked.includes(r);
        return (
          <button key={r} type="button" role="radio" aria-checked={value === r} disabled={lock} className={`${value === r ? "on" : ""}${lock ? " lock" : ""}`} onClick={() => onChange(value === r ? "" : r)}>
            {lock ? <Lock size={11} /> : null}{r}
          </button>
        );
      })}
    </div>
  );
}

function NoteField({ value, onChange, placeholder, required = false, label }) {
  return (
    <label className="rq-note">
      <span>{label || (required ? "Reason for the citizen" : "Note (optional)")}{required ? <b> · required</b> : null}</span>
      <textarea rows={2} maxLength={200} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <em>{value.length}/200</em>
      <TextHint text={value} />
    </label>
  );
}

/* Sent → Seen → Decided, with the current point pulsing */
export function RequestTrack({ request }) {
  if (!request) return null;
  const stage = request.decided ? 2 : request.seenAt ? 1 : 0;
  const nodes = [
    { label: "Sent", at: request.at, icon: Send },
    { label: "Seen", at: request.seenAt, icon: Eye },
    { label: "Decided", at: request.decided?.at, icon: Gavel },
  ];
  return (
    <ol className={`rq-track${request.decided ? ` ${request.decided.verdict}` : ""}`} aria-label="Request progress">
      {nodes.map((n, i) => {
        const Icon = n.icon;
        return (
          <li key={n.label} className={i < stage ? "done" : i === stage ? "now" : ""}>
            <span><Icon size={11} /></span>
            <b>{n.label}</b>
            <time>{n.at ? formatDateTime(n.at) : "—"}</time>
          </li>
        );
      })}
    </ol>
  );
}

const TYPE_COPY = {
  withdraw: { icon: Undo2, title: "Withdrawal requested" },
  dispute: { icon: MessageSquareWarning, title: "Dismissal disputed" },
  flag: { icon: Flag, title: "Flagged as invalid" },
};

function requestStatusLine(req) {
  if (!req.decided) return req.seenAt ? "Seen by the city · decision pending" : "Sent to the city";
  const what = req.type === "withdraw" ? "Withdrawal" : req.type === "dispute" ? "Dispute" : "Flag";
  return req.decided.verdict === "approved" ? `${what} approved` : `${what} declined${req.decided.reason ? `: ${req.decided.reason}` : ""}`;
}

/* ---------------- citizen (report drawer, own report) ---------------- */
export function CitizenRemoval({ issue, user }) {
  const [mode, setMode] = useState(null); // "withdraw" | "request" | "dispute"
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { setMode(null); setReason(""); setNote(""); }, [issue?.id]);
  if (!issue || !user || issue.reporterId !== user.id) return null;

  const open = openRequest(issue);
  const last = lastRequest(issue);
  const removed = issue.removed;
  const direct = canWithdraw(issue, user);
  const canRequest = !removed && !direct && issue.status !== "resolved" && !open;
  const disputed = (issue.requests || []).some((r) => r.type === "dispute" && r.decided && new Date(r.at) > new Date(removed?.at || 0));
  const canDispute = removed?.kind === "dismissed" && !open && !disputed;

  const send = () => {
    if (mode === "withdraw") withdrawIssue(issue.id, user, reason, note);
    else requestRemoval(issue.id, user, mode === "dispute" ? "dispute" : "withdraw", mode === "dispute" ? "Report is real" : reason, note);
    setMode(null);
  };

  return (
    <section className="rq-panel">
      {removed ? (
        <div className={`rq-state ${removed.kind}`}>
          <span><Ban size={15} /></span>
          <div>
            <strong>{removed.merged ? `Tracked under ${removed.linkedTo}` : removed.kind === "withdrawn" ? (removed.requestedBy ? "Withdrawal approved" : "Withdrawn by you") : "Dismissed by the city"}</strong>
            <p>{removed.merged ? "Someone reported the same problem first. You count as affected on it and follow it in Saved." : <>{removed.reason}{removed.linkedTo ? ` · same as ${removed.linkedTo}` : ""}</>} · {formatDateTime(removed.at)}</p>
            {removed.kind === "dismissed" && removed.note ? <blockquote>{removed.note}</blockquote> : null}
          </div>
        </div>
      ) : null}

      {last && (open || last.decided) && (!removed || last.type === "dispute" || open) ? (
        <div className="rq-req">
          <p className="rq-req-line">{requestStatusLine(last)}</p>
          <RequestTrack request={last} />
        </div>
      ) : null}

      {mode ? (
        <div className="rq-form">
          <p className="rq-label">
            {mode === "withdraw" ? "Why are you withdrawing it?" : mode === "dispute" ? "Tell the city why this report is real" : "Why should it be withdrawn?"}
          </p>
          {mode !== "dispute" ? <ReasonChips reasons={WITHDRAW_REASONS} value={reason} onChange={setReason} /> : null}
          <NoteField value={note} onChange={setNote} placeholder={mode === "dispute" ? "Example: the manhole is still open, I passed it this morning." : "Anything the city should know."} />
          <div className="rq-row">
            <button type="button" className="rq-ghost" onClick={() => setMode(null)}>Cancel</button>
            {mode === "withdraw" ? (
              <HoldButton label="Hold to withdraw" hint="Keep holding to withdraw" tone="red" icon={Undo2} disabled={!reason || isMash(note)} onConfirm={send} />
            ) : (
              <button type="button" className="rq-go" disabled={(mode === "dispute" ? note.trim().length < 6 : !reason) || isMash(note)} onClick={send}>
                <Send size={13} /> {mode === "dispute" ? "Send dispute" : "Send request"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rq-row start">
          {direct ? <button type="button" className="rq-ghost red" onClick={() => setMode("withdraw")}><Undo2 size={13} /> Withdraw report</button> : null}
          {canRequest ? <button type="button" className="rq-ghost" onClick={() => setMode("request")}><Undo2 size={13} /> Request withdrawal</button> : null}
          {canDispute ? <button type="button" className="rq-ghost" onClick={() => setMode("dispute")}><MessageSquareWarning size={13} /> Dispute this decision</button> : null}
          {direct ? <span className="rq-hint">You can withdraw it yourself until a crew is assigned.</span> : canRequest ? <span className="rq-hint">A crew is assigned, so the city decides.</span> : null}
        </div>
      )}
    </section>
  );
}

/* ---------------- staff (own work file) ----------------
   Duplicate: from the desk, naming the original. Not a city issue, Location
   not found, Already fixed: on-site findings, so only after Start work, with
   a note on what the crew found. The window keeps running while it waits. */
export function StaffFlag({ issue, user }) {
  const [on, setOn] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [dup, setDup] = useState("");
  useEffect(() => { setOn(false); setReason(""); setNote(""); setDup(""); }, [issue?.id]);
  if (!issue || !user || issue.assignedTo !== user.name || issue.removed || issue.status === "resolved") return null;
  const open = openRequest(issue);
  const last = lastRequest(issue);
  const mineLast = last && last.type === "flag" ? last : null;
  const here = onSite(issue);
  const locked = here ? [] : FLAG_ON_SITE;
  const isDup = reason === "Duplicate report";
  const twins = isDup ? getIssues().filter((i) => i.id !== issue.id && i.ward === issue.ward && i.category === issue.category).slice(0, 8) : [];
  const ready = reason && canFlagWith(issue, reason) && (isDup ? Boolean(dup) : note.trim().length >= 10) && !isMash(note);
  const send = () => { if (requestRemoval(issue.id, user, "flag", reason, note, isDup ? dup : null)) setOn(false); };

  return (
    <section className="rq-panel fld">
      {mineLast ? (
        <div className="rq-req">
          <p className="rq-req-line">{mineLast.decided ? requestStatusLine(mineLast) : `Flag sent · ${mineLast.reason}`}</p>
          <RequestTrack request={mineLast} />
          {!mineLast.decided ? <p className="rq-clock">Service window still running · the file stays on you</p> : null}
        </div>
      ) : null}
      {on ? (
        <div className="rq-form">
          <p className="rq-label">Why is this report invalid?</p>
          <ReasonChips reasons={FLAG_REASONS} value={reason} onChange={(r) => { setReason(r); setDup(""); }} locked={locked} />
          {!here ? <p className="rq-lockline"><Lock size={12} /> Start work on site to flag the other reasons. A duplicate can be flagged from here.</p> : null}
          {isDup ? (
            <label className="rq-dup">
              <span>Original report <b>· required</b></span>
              <select value={dup} onChange={(e) => setDup(e.target.value)}>
                <option value="">{twins.length ? "Pick the report it repeats" : "No matching report in this zone and category"}</option>
                {twins.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}
              </select>
            </label>
          ) : null}
          {reason && !isDup ? <NoteField value={note} onChange={setNote} required label="What you found on site" placeholder="Example: private building's own light on the gate, not a city pole." /> : null}
          {isDup ? <NoteField value={note} onChange={setNote} placeholder="Anything command should know." /> : null}
          <div className="rq-row">
            <button type="button" className="rq-ghost" onClick={() => setOn(false)}>Cancel</button>
            <button type="button" className="rq-go" disabled={!ready} onClick={send}><Flag size={13} /> Send to command</button>
          </div>
        </div>
      ) : !open ? (
        <div className="rq-row start">
          <button type="button" className="rq-ghost" onClick={() => setOn(true)}><Flag size={13} /> {here ? "Flag as invalid" : "Flag as duplicate"}</button>
          <span className="rq-hint">{here ? "Command decides. The file stays on you until then." : "Other reasons unlock once you start work on site."}</span>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------- admin (desk drawer) ---------------- */
export function AdminRemoval({ issue, user }) {
  const [on, setOn] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [dup, setDup] = useState("");
  useEffect(() => { setOn(false); setReason(""); setNote(""); setDup(""); }, [issue?.id]);
  if (!issue || !user) return null;
  const open = openRequest(issue);

  if (issue.removed) {
    return (
      <section className="rq-panel">
        <div className={`rq-state ${issue.removed.kind}`}>
          <span><Ban size={15} /></span>
          <div>
            <strong>{issue.removed.merged ? `Merged into ${issue.removed.linkedTo}` : issue.removed.kind === "withdrawn" ? "Withdrawn by the citizen" : "Dismissed"} · off the board</strong>
            <p>{issue.removed.merged ? "Its reporter now counts as affected on the original" : issue.removed.reason}{!issue.removed.merged && issue.removed.linkedTo ? ` · same as ${issue.removed.linkedTo}` : ""} · {issue.removed.by} · {formatDateTime(issue.removed.at)}</p>
          </div>
        </div>
        {open ? <RequestCard issue={issue} user={user} inline /> : canRestore(issue) ? (
          <div className="rq-row start">
            <HoldButton label={issue.removed.merged ? "Hold to unmerge" : "Hold to restore"} hint="Keep holding to restore" icon={RotateCcw} onConfirm={() => restoreIssue(issue.id, user.name)} />
            <span className="rq-hint">{issue.removed.merged ? "Back on the board as its own report; its reporter leaves the original's count." : "Puts it back on the board with its full history."}</span>
          </div>
        ) : (
          <p className="rq-hint">The citizen withdrew it, so it stays withdrawn. Only they can file it again.</p>
        )}
      </section>
    );
  }

  const twins = reason === "Duplicate report"
    ? getIssues().filter((i) => i.id !== issue.id && i.ward === issue.ward && i.category === issue.category).slice(0, 8)
    : [];
  const likely = possibleDuplicates(issue);

  const confirm = () => {
    // a duplicate with its original picked is merged, not discarded
    const undo = reason === "Duplicate report" && dup ? mergeIssue(issue.id, dup, user.name, note) : dismissIssue(issue.id, user.name, reason, note, dup || null);
    if (undo) showUndo(reason === "Duplicate report" && dup ? `${issue.id} merged into ${dup}` : `${issue.id} dismissed`, undo);
    setOn(false);
  };
  const merge = (into) => {
    const undo = mergeIssue(issue.id, into, user.name);
    if (undo) showUndo(`${issue.id} merged into ${into}`, undo);
  };

  return (
    <section className="rq-panel">
      {likely.length && !open && !on ? (
        <div className="rq-dupe">
          <p><b>Possible duplicate</b> of <span className="ac-id">{likely[0].issue.id}</span> · {likely[0].m} m away · reported earlier</p>
          <small>{likely[0].issue.title}</small>
          <div className="rq-row start">
            <HoldButton label={`Hold to merge into ${likely[0].issue.id}`} hint="Keep holding to merge" icon={RotateCcw} onConfirm={() => merge(likely[0].issue.id)} />
            <span className="rq-hint">Its reporter is counted on the original and follows it there.</span>
          </div>
        </div>
      ) : null}
      {open ? <RequestCard issue={issue} user={user} inline /> : null}
      {on ? (
        <div className="rq-form">
          <p className="rq-label">Why is it leaving the board?</p>
          <ReasonChips reasons={DISMISS_REASONS} value={reason} onChange={(r) => { setReason(r); setDup(""); }} />
          {twins.length ? (
            <label className="rq-dup">
              <span>Original report</span>
              <select value={dup} onChange={(e) => setDup(e.target.value)}>
                <option value="">Pick the report it repeats</option>
                {twins.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}
              </select>
            </label>
          ) : null}
          <NoteField value={note} onChange={setNote} placeholder="Shown to the citizen with the reason." />
          <div className="rq-row">
            <button type="button" className="rq-ghost" onClick={() => setOn(false)}>Cancel</button>
            <HoldButton label={reason === "Duplicate report" && dup ? "Hold to merge" : "Hold to dismiss"} hint="Keep holding" tone={reason === "Duplicate report" && dup ? "" : "red"} icon={Trash2} disabled={!reason || (reason === "Duplicate report" && twins.length > 0 && !dup) || isMash(note)} onConfirm={confirm} />
          </div>
        </div>
      ) : !open ? (
        <div className="rq-row start">
          <button type="button" className="rq-ghost red" onClick={() => setOn(true)}><Trash2 size={13} /> Dismiss issue</button>
          <span className="rq-hint">Spam, a duplicate, or not a city matter. It stays in the audit log and can be restored.</span>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------- request card (decision queue + admin drawer) ---------------- */
export function RequestCard({ issue, user, inline = false, onOpen }) {
  const req = openRequest(issue);
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [gone, setGone] = useState(null);
  const ref = useRef(null);
  if (!req && !gone) return null;
  if (gone) return <div className="rq-filed" role="status"><Check size={12} /> {gone} · recorded in audit log</div>;

  const T = TYPE_COPY[req.type];
  const Icon = T.icon;
  const decide = (verdict) => {
    if (verdict === "declined" && !why.trim()) { setDeclining(true); return; }
    const ok = decideRequest(issue.id, verdict, user.name, why);
    if (ok) setGone(`${issue.id} · ${verdict === "approved" ? "approved" : "declined"}`);
  };
  const keys = (e) => {
    if (e.target.tagName === "TEXTAREA") return;
    if (e.key === "a" || e.key === "A") { e.preventDefault(); decide("approved"); }
    if (e.key === "d" || e.key === "D") { e.preventDefault(); setDeclining(true); }
  };
  const approveText = req.type === "dispute" ? "Approve · restore" : "Approve · remove";

  return (
    <div ref={ref} className={`rq-card${inline ? " inline" : ""}`} tabIndex={0} onKeyDown={keys} aria-label={`${T.title} on ${issue.id}. A to approve, D to decline.`}>
      <div className="rq-card-top">
        <span className={`rq-card-ic ${req.type}`}><Icon size={15} /></span>
        <div style={{ minWidth: 0 }}>
          <strong>{inline ? T.title : issue.title}</strong>
          <small>
            {!inline ? <><span className="ac-id">{issue.id}</span> · </> : null}
            {nameFor(req.by)} · {req.role === "staff" ? "field" : "citizen"} · {waited(req.at)}
          </small>
        </div>
        {!inline && onOpen ? <button type="button" className="rq-ghost sm" onClick={() => onOpen(issue.id)}>Open</button> : null}
      </div>
      <div className="rq-card-why">
        <span className="rq-chip">{req.reason}{req.linkedTo ? ` · same as ${req.linkedTo}` : ""}</span>
        {req.note ? <q>{req.note}</q> : null}
      </div>
      {declining ? (
        <div className="rq-form tight">
          {/* the decline goes back to whoever asked: the field crew for a flag, the citizen otherwise */}
          <NoteField
            value={why}
            onChange={setWhy}
            required
            label={req.role === "staff" ? `Reason for ${nameFor(req.by)} (field)` : "Reason for the citizen"}
            placeholder={
              req.type === "flag"
                ? req.reason === "Duplicate report"
                  ? `Example: ${req.linkedTo || "the other report"} is a different spot, 300 m away.`
                  : "Example: our records show a city asset at this spot. Carry on with the work."
                : req.type === "dispute"
                  ? "Example: the zone office confirmed this is a private connection."
                  : "Example: the crew is already on site and found the problem."
            }
          />
          <div className="rq-row">
            <button type="button" className="rq-ghost" onClick={() => { setDeclining(false); setWhy(""); }}>Cancel</button>
            <button type="button" className="rq-go dark" disabled={!why.trim() || isMash(why)} onClick={() => decide("declined")}><XCircle size={13} /> Send decline</button>
          </div>
        </div>
      ) : (
        <div className="rq-row">
          <button type="button" className="rq-ghost" onClick={() => setDeclining(true)}><XCircle size={13} /> Decline <kbd>D</kbd></button>
          <button type="button" className="rq-go" onClick={() => decide("approved")}><CheckCircle2 size={13} /> {approveText} <kbd>A</kbd></button>
        </div>
      )}
    </div>
  );
}

function waited(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 60) return `waiting ${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `waiting ${h}h` : `waiting ${Math.round(h / 24)}d`;
}

/* ---------------- Undo notice ---------------- */
const UNDO_MS = 8000;
let undoState = null;
const undoListeners = new Set();
const setUndo = (v) => { undoState = v; undoListeners.forEach((l) => l()); };
export function showUndo(text, undo, icon = "trash") { setUndo({ id: Date.now(), text, undo, icon }); }

export function UndoBar() {
  const u = useSyncExternalStore((cb) => { undoListeners.add(cb); return () => undoListeners.delete(cb); }, () => undoState);
  useEffect(() => {
    if (!u) return undefined;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [u]);
  if (!u) return null;
  return createPortal(
    <div className="rq-undo" role="status" key={u.id} style={{ "--undo-ms": `${UNDO_MS}ms` }}>
      {u.icon === "send" ? <Send size={14} /> : <Trash2 size={14} />}
      <span>{u.text}</span>
      <button type="button" onClick={() => { u.undo(); setUndo(null); }}><Undo2 size={13} /> Undo</button>
      <i aria-hidden />
    </div>,
    document.body
  );
}

/* ---------------- field: "ISS-2438 removed · Submitted by mistake" ----------------
   When command (or the citizen) takes one of my files off the board, it
   leaves my list with a short line saying why, for a few seconds. */
const NOTICE_MS = 9000;
export function RemovedNotices({ audit, everything, me }) {
  const [now, setNow] = useState(() => Date.now());
  const recent = (audit || []).filter((e) => e.kind === "removal" && /^(Dismissed|Withdrew|Approved withdrawal|Approved invalid flag)/.test(e.action) && Date.now() - new Date(e.at) < NOTICE_MS);
  const mine = recent
    .map((e) => ({ e, issue: everything.find((i) => i.id === e.issueId) }))
    .filter(({ issue }) => issue && issue.removed && issue.assignedTo === me);
  useEffect(() => {
    if (!mine.length) return undefined;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [mine.length, now]);
  if (!mine.length) return null;
  return (
    <div className="rq-notices" role="status">
      {mine.map(({ e, issue }) => (
        <p key={e.id} className="rq-notice"><Ban size={13} /> <b>{issue.id}</b> removed · {issue.removed.reason}</p>
      ))}
    </div>
  );
}
