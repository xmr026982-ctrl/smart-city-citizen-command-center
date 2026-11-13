import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, RotateCcw, CornerUpLeft, X, Send, MessageSquareText, AlertTriangle, Check, BadgeCheck } from "lucide-react";
import { StatusPill, PriorityPill, SlaMeter, ago } from "../admin/CommandKit";
import { useAuth } from "../../../store/authStore";
import {
  requestClose, withdrawClose, sendBack, confirmClose, lastCloseNote, CLOSE_NOTE_MIN, RECALL_NOTE_MIN, RETURN_NOTE_MIN, SEAL_NOTE_MIN,
} from "../../../services/issueService";
import "../../../styles/gate-door.css";
import { nameFor } from "../../../store/profileStore";
import TextHint from "../../ui/TextHint";
import { isMash } from "../../../utils/textGuard";

/* ------------------------------------------------------------------
   Gate door: the one panel for every move at the close gate that must
   carry words. Same layout, three tones and three voices:
     close     (field, amber)  Request close    what was done on site
     recall    (field, teal)   Recall request   why the request comes back
     sendback  (command, violet) Return to field  what is still missing
     confirm   (command, green)  Seal the close   the official closing note
                                                  (the last entry; notes lock after it)
   Each door shows the other side's last word for context, re-checks the
   issue's live status (if someone else moved it first, the door says so
   and won't send), and slides in above the issue file. Esc or the veil
   closes only the door.
   onSent(issueId, mode) runs after the move went through.
------------------------------------------------------------------- */

const MODES = {
  close: {
    tone: "amber",
    icon: ShieldCheck,
    kicker: "Close request · Command gate",
    title: () => "Ask command to close this issue",
    lead: "The field never marks an issue Resolved. Command reads your note, then confirms the close or sends it back.",
    label: "What was done on site",
    min: CLOSE_NOTE_MIN,
    status: "in_progress",
    stale: "This issue is no longer in progress on you. Close the door and check the file.",
    placeholder: "Example: Replaced the blown fuse and tested all six lights after dark.",
    quick: [
      ["Repaired & tested", "Repaired and tested on site."],
      ["Cleared & clean", "Cleared and the area is clean."],
      ["Part replaced", "Part replaced and working."],
      ["Made safe", "Site made safe and barricades removed."],
    ],
    steps: [
      "The issue moves to Pending confirmation and waits at command's close gate.",
      "The citizen keeps seeing In Progress until command confirms.",
      "Changed your mind? Recall the request, with a reason, and keep working.",
    ],
    send: "Send to command",
    run: requestClose,
  },
  recall: {
    tone: "teal",
    icon: RotateCcw,
    kicker: "Recall request · Command gate",
    title: () => "Take your close request back",
    lead: "The issue returns to In Progress on you and leaves command's close gate. Command reads your reason in the file.",
    label: "Why you are recalling it",
    min: RECALL_NOTE_MIN,
    status: "pending_review",
    stale: "Command already acted on this request. There is nothing left to recall.",
    placeholder: "Example: Found a second fault on the same pole, needs another visit.",
    quick: [
      ["Work not finished", "Work is not finished yet."],
      ["More damage found", "Found more damage on site."],
      ["Sent by mistake", "Sent the close request by mistake."],
      ["Citizen reported again", "The citizen reported the problem again."],
    ],
    steps: [
      "The issue goes back to In Progress and stays on you.",
      "Your reason is posted to the file and the audit log.",
      "Request close again when the work is really done.",
    ],
    send: "Recall request",
    run: withdrawClose,
  },
  confirm: {
    tone: "green",
    icon: BadgeCheck,
    kicker: "Seal the close · Command gate",
    title: (issue) => `Confirm ${(issue.assignedTo || "the field").split(" ")[0]}'s close`,
    lead: "The issue becomes Resolved for everyone, the citizen included. Your closing note is the official last word on the file.",
    label: "Closing note",
    min: SEAL_NOTE_MIN,
    status: "pending_review",
    stale: "This close request is no longer waiting. The field may have recalled it.",
    placeholder: "Example: Verified on site. Good work.",
    quick: [
      ["Verified · good work", "Verified. Good work."],
      ["Citizen confirmed", "Citizen confirmed the fix."],
      ["Checked photos", "Checked against site photos."],
      ["Inside the window", "Closed inside the window. Thank you."],
    ],
    steps: [
      "The issue moves to Resolved and leaves every open list.",
      "Your note lands in the log as the closing seal, read by the crew.",
      "Notes lock for everyone. The record is final.",
    ],
    send: "Seal the close",
    run: confirmClose,
  },
  sendback: {
    tone: "violet",
    icon: CornerUpLeft,
    kicker: "Return to field · Command gate",
    title: (issue) => `Send this back to ${(issue.assignedTo || "the field").split(" ")[0]}`,
    lead: "The close is not confirmed. The issue returns to In Progress and the field sees your reason at once.",
    label: "What is still missing",
    min: RETURN_NOTE_MIN,
    status: "pending_review",
    stale: "This close request is no longer waiting. The field may have recalled it.",
    placeholder: "Example: The citizen reports the light is still off after dark.",
    quick: [
      ["Work incomplete", "The work is not complete."],
      ["Citizen still reports it", "The citizen still reports the problem."],
      ["Wrong fix", "This does not fix the reported problem."],
      ["Needs proof", "Needs proof from site before the close."],
    ],
    steps: [
      "The issue returns to In Progress on the same crew.",
      "They see a Returned by command banner with your reason.",
      "The return is counted on the file and in the audit log.",
    ],
    send: "Send back to field",
    run: sendBack,
  },
};

function GateDoor({ mode = "close", issue, onClose, onSent }) {
  const user = useAuth();
  const m = MODES[mode] || MODES.close;
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const openKey = issue ? `${issue.id}-${mode}` : null;

  useEffect(() => { setNote(""); setError(""); }, [openKey]);

  useEffect(() => {
    if (!openKey) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Esc closes this door only (capture, so the issue file underneath stays open)
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => boxRef.current?.focus(), 60);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [openKey]);

  if (!issue) return null;

  const Icon = m.icon;
  const stale = issue.status !== m.status;
  const len = note.trim().replace(/\s+/g, " ").length;
  const left = Math.max(0, m.min - len);
  const mash = isMash(note);
  const ready = left === 0 && !stale && !mash;
  const closeNote = mode !== "close" ? lastCloseNote(issue) : null;
  const returned = mode === "close" && issue.lastReturn ? issue.lastReturn : null;

  const send = () => {
    if (!ready) return;
    const res = m.run(issue.id, note, user);
    if (!res.ok) { setError(res.reason); return; }
    onSent?.(issue.id, mode);
    onClose();
  };
  const add = (line) => {
    setNote((n) => (n.trim() ? `${n.trim()} ${line}` : line));
    setError("");
    boxRef.current?.focus();
  };

  return createPortal(
    <div className="ix">
      <div className="gd-veil" onClick={onClose} />
      <aside className={`gd ${m.tone}`} role="dialog" aria-modal="true" aria-label={`${m.send} · ${issue.id}`}>
        <span className="gd-edge" aria-hidden />
        <header className="gd-head">
          <div className="gd-id">
            <span className="gd-mark"><Icon size={18} /></span>
            <div>
              <p className="gd-kicker">{m.kicker}</p>
              <p className="gd-code">{issue.id}</p>
            </div>
          </div>
          <button type="button" className="gd-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="gd-body">
          <div>
            <h2>{m.title(issue)}</h2>
            <p className="gd-lead">{m.lead}</p>
          </div>

          <div className="gd-ticket">
            <p>Issue</p>
            <strong>{issue.title}</strong>
            <div><StatusPill status={issue.status} /><PriorityPill priority={issue.priority} /><SlaMeter issue={issue} /></div>
          </div>

          {closeNote ? (
            <blockquote className="gd-quote">
              <MessageSquareText size={13} />
              <div>
                <p>{closeNote.body}</p>
                <cite>{mode === "recall" ? "Your close note" : `${nameFor(closeNote.author)}'s close note`} · {ago(closeNote.createdAt)}</cite>
              </div>
            </blockquote>
          ) : null}
          {mode === "sendback" && issue.returned ? (
            <p className="gd-repeat"><AlertTriangle size={13} /> Returned {issue.returned}× before. Another return may mean this needs a different crew.</p>
          ) : null}
          {returned ? (
            <blockquote className="gd-quote back">
              <CornerUpLeft size={13} />
              <div>
                <p>{returned.reason}</p>
                <cite>Command returned this · {nameFor(returned.by)} · {ago(returned.at)}</cite>
              </div>
            </blockquote>
          ) : null}

          {stale ? (
            <p className="gd-stale" role="alert"><AlertTriangle size={14} /> {m.stale}</p>
          ) : (
            <div className="gd-field">
              <label className="gd-label" htmlFor={`gd-${openKey}`}>{m.label}</label>
              <div className="gd-quick">
                <span>Quick fill</span>
                <div>
                  {m.quick.map(([label, line]) => <button key={label} type="button" onClick={() => add(line)}>{label}</button>)}
                </div>
              </div>
              <textarea
                id={`gd-${openKey}`}
                ref={boxRef}
                rows={5}
                value={note}
                placeholder={m.placeholder}
                onChange={(e) => { setNote(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
              />
              <p className={`gd-count${ready ? " ok" : ""}`} aria-live="polite">
                {ready ? <><Check size={12} /> Ready to send · Ctrl + Enter</> : left ? `${left} more character${left === 1 ? "" : "s"} needed` : "Write it in plain words to send"}
              </p>
              <TextHint text={note} />
              {error ? <p className="gd-err" role="alert">{error}</p> : null}
            </div>
          )}

          <ol className="gd-steps">
            {m.steps.map((s, i) => <li key={s}><b>{i + 1}</b>{s}</li>)}
          </ol>
        </div>

        <footer className="gd-foot">
          <button type="button" className="gd-btn" onClick={onClose}>{stale ? "Close" : "Cancel"}</button>
          <button type="button" className="gd-btn go" onClick={send} disabled={!ready}>
            <Send size={14} /> {m.send}
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}

export default GateDoor;
