import { addComment, updateStatus, getIssues } from "../store/issueStore";
import { isMash, MASH_MESSAGE } from "../utils/textGuard";

/* ------------------------------------------------------------------
   Issue service: the moves on an issue's work, field and command.
   Pages call these, never the store directly, so the rules live in
   one place and the backend can take over later without touching a page.

   The field can only move its own issues, one step at a time:
     Acknowledged  --start-->           In Progress
     In Progress   --request close-->   Pending confirmation   (note: what was done)
     Pending       --recall request-->  In Progress            (reason: why)
   Command decides at the close gate:
     Pending       --seal the close-->  Resolved               (closing note: the official last word)
     Pending       --send back-->       In Progress            (reason: what is missing)
   Once Resolved, the notes lock for everyone: the closing note stays the
   last entry on the record.

   Every move at the close gate carries words. They
   land on the timeline, the audit line, the live event and the comms log.
   Each move re-checks the issue's current status first, so two people
   acting at once can't both win (e.g. a recall racing a send-back).

   Each call returns { ok: true } or { ok: false, reason }.
   When the backend is connected (VITE_API_URL), each move becomes one
   request; the rules here stay as the client-side guard.
------------------------------------------------------------------- */

export const CLOSE_NOTE_MIN = 12; // what was done on site
export const RECALL_NOTE_MIN = 8; // why the field takes its request back
export const RETURN_NOTE_MIN = 12; // what command says is still missing
export const SEAL_NOTE_MIN = 8; // command's closing note (one quick fill is enough)

const isMine = (issue, user) => Boolean(issue && user && issue.assignedTo === user.name);
const find = (id) => getIssues().find((i) => i.id === id) || null;
const clean = (text) => String(text || "").trim().replace(/\s+/g, " ");

// command's closing note is stored as a note with this prefix; the log shows it as the seal
export const SEAL_PREFIX = "Closed by command: ";

/** What the field can do with this issue right now. */
export function fieldMoves(issue, user) {
  const mine = isMine(issue, user);
  return {
    mine,
    start: mine && issue.status === "acknowledged",
    requestClose: mine && issue.status === "in_progress",
    withdraw: mine && issue.status === "pending_review",
    waiting: mine && issue.status === "pending_review",
    done: issue?.status === "resolved",
  };
}

/** Who may read and write the internal notes on a file. */
export function notesAccess(issue, user) {
  if (!issue || !user) return { read: false, write: false };
  if (user.role === "admin") return { read: true, write: issue.status !== "resolved" };
  if (user.role === "staff" && isMine(issue, user)) return { read: true, write: issue.status !== "resolved" };
  return { read: false, write: false };
}

/** The field's latest close note on this issue (what command reads at the gate). */
export function lastCloseNote(issue) {
  const note = [...(issue?.comments || [])].reverse().find((c) => c.role === "staff" && /^Close request: /.test(c.body));
  return note ? { ...note, body: note.body.replace(/^Close request: /, "") } : null;
}

export function startWork(id, user) {
  const issue = find(id);
  if (!fieldMoves(issue, user).start) return { ok: false, reason: "Only your own acknowledged issues can be started." };
  updateStatus(id, "in_progress", user.name, "staff");
  return { ok: true };
}

export function requestClose(id, note, user) {
  const issue = find(id);
  if (!fieldMoves(issue, user).requestClose) return { ok: false, reason: "This issue is no longer in progress on you." };
  const body = clean(note);
  if (body.length < CLOSE_NOTE_MIN) return { ok: false, reason: `Say what was done on site (at least ${CLOSE_NOTE_MIN} characters).` };
  if (isMash(body)) return { ok: false, reason: MASH_MESSAGE };
  addComment(id, `Close request: ${body}`, user.name, "staff", true);
  updateStatus(id, "pending_review", user.name, "staff", { reason: body }); // the server checks the note on the move itself
  return { ok: true };
}

export function withdrawClose(id, reason, user) {
  const issue = find(id);
  if (!fieldMoves(issue, user).withdraw) return { ok: false, reason: "There is no close request of yours waiting on this issue." };
  const why = clean(reason);
  if (why.length < RECALL_NOTE_MIN) return { ok: false, reason: `Tell command why (at least ${RECALL_NOTE_MIN} characters).` };
  if (isMash(why)) return { ok: false, reason: MASH_MESSAGE };
  addComment(id, `Recalled close request: ${why}`, user.name, "staff", true);
  updateStatus(id, "in_progress", user.name, "staff", { reason: why });
  return { ok: true };
}

export function confirmClose(id, note, user) {
  const issue = find(id);
  if (user?.role !== "admin") return { ok: false, reason: "Only command can confirm a close." };
  if (issue?.status !== "pending_review") return { ok: false, reason: "There is no close request waiting on this issue." };
  const body = clean(note);
  if (body.length < SEAL_NOTE_MIN) return { ok: false, reason: `Leave a closing note (at least ${SEAL_NOTE_MIN} characters).` };
  if (isMash(body)) return { ok: false, reason: MASH_MESSAGE };
  addComment(id, `${SEAL_PREFIX}${body}`, user.name, "admin", true);
  updateStatus(id, "resolved", user.name, "admin", { reason: body });
  return { ok: true };
}

export function sendBack(id, reason, user) {
  const issue = find(id);
  if (user?.role !== "admin") return { ok: false, reason: "Only command can send a close back." };
  if (issue?.status !== "pending_review") return { ok: false, reason: "There is no close request waiting on this issue." };
  const why = clean(reason);
  if (why.length < RETURN_NOTE_MIN) return { ok: false, reason: `Say what is still missing (at least ${RETURN_NOTE_MIN} characters).` };
  if (isMash(why)) return { ok: false, reason: MASH_MESSAGE };
  addComment(id, `Sent back to the field: ${why}`, user.name, "admin", true);
  updateStatus(id, "in_progress", user.name, "admin", { reason: why });
  return { ok: true };
}

export function addFieldNote(id, body, user) {
  const text = String(body || "").trim();
  if (!text) return { ok: false, reason: "The note is empty." };
  if (isMash(text)) return { ok: false, reason: MASH_MESSAGE };
  const issue = find(id);
  if (!issue) return { ok: false, reason: "This issue no longer exists." };
  if (!notesAccess(issue, user).write) return { ok: false, reason: "Notes on this file are closed to you." };
  addComment(id, text, user.name, user.role, true);
  return { ok: true };
}
