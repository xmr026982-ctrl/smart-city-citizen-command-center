import { useSyncExternalStore } from "react";
import { STATUS_LABEL } from "../constants/issueStatuses";
import { PRIORITY_LABEL } from "../constants/issuePriorities";
import { EVENTS, emitEvent } from "../services/events";
import { windowFor } from "./slaPolicyStore";
import { isMash } from "../utils/textGuard";

/* ------------------------------------------------------------------
   Issue board: every civic issue + the command audit trail.
   Saved in this browser so the board survives a reload.
   Staff are referenced by name (assignedTo), the same name the
   Staff Desk roster uses, so load and closed counts line up.

   Audit event: { id, at, actor, role, action, issueId, kind, verb?, subject? }
   kind: "filed" | "dispatch" | "status" | "priority" | "desk"
   Staff Desk events ("desk") also carry:
     verb:    "cleared" | "rejected" | "removed" | "rank" | "verify" | "uplink" | "key"
     subject: a snapshot of the person at that moment
              { id, name, email, rank, expertise, zone, experience, closed?, released? }
   The snapshot keeps the record readable after someone leaves the system.

   Every change is also sent on the live event channel
   (services/events.js), so notifications and the real-time backend can
   follow the board without touching any page.

   With the server (VITE_API_URL + a server sign-in) services/issueSync.js
   connects here: the board comes from GET /issues, every change below is
   shown at once AND sent to its endpoint (send()), and the server's copy
   of the issue replaces the local one (or puts it back if refused).
   Nothing is saved in this browser then. docs/backend/BACKEND-HANDOVER.md · A7.
------------------------------------------------------------------- */

const KEY = "issue-board-v2";
const ADMIN = "City Command";

/* The board starts empty: every issue comes from the server (GET /issues). */
function freshBoard() {
  return { issues: [], audit: [] };
}

/* Boards saved before per-person saves and "me too" support: one shared
   `saved` flag becomes the reporter's own save; supporters start empty. */
function normalizeIssue(issue) {
  const out = { ...issue };
  if (!Array.isArray(out.savedBy)) out.savedBy = out.saved && out.reporterId ? [out.reporterId] : [];
  if (!Array.isArray(out.supporters)) out.supporters = [];
  if (!Array.isArray(out.photos)) out.photos = [];
  // photos kept as temporary blob: links died with the tab that made them
  out.photos = out.photos.filter((ph) => typeof ph?.url === "string" && (ph.url.startsWith("data:") || /^https?:\/\//.test(ph.url)));
  delete out.saved;
  return out;
}

/* Boards saved before the trail carried structured notices (n): read the
   notice back from the action line, so older events still notify. */
const LABEL_STATUS = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]));
function withNotice(e) {
  if (e.n || !e.action) return e;
  const a = e.action;
  let m;
  let n = null;
  if (e.kind === "filed") n = /^Also reported/.test(a) ? { type: "supported" } : { type: "filed" };
  else if (e.kind === "dispatch") {
    if ((m = a.match(/^Reassigned ISS-\d+ from (.+?) to (.+?)(?: \(| ·|$)/))) n = { type: "assign", from: m[1], to: m[2] };
    else if ((m = a.match(/^Assigned ISS-\d+ to (.+?)(?: \(| ·|$)/))) n = { type: "assign", from: null, to: m[1] };
    else if ((m = a.match(/^Unassigned ISS-\d+ from (.+?)(?: ·|$)/))) n = { type: "assign", from: m[1], to: null };
    else if ((m = a.match(/^Returned ISS-\d+ to dispatch \((.+) left the field\)/))) n = { type: "assign", from: m[1], to: null, left: true };
  } else if (e.kind === "status") {
    const reason = a.includes(": ") ? a.split(": ").slice(1).join(": ") : undefined;
    if (/^Requested close/.test(a)) n = { type: "status", to: "pending_review" };
    else if (/^Confirmed close/.test(a)) n = { type: "status", to: "resolved", ...(reason ? { reason } : {}) };
    else if (/^Sent ISS-\d+ back/.test(a)) n = { type: "status", from: "pending_review", to: "in_progress", sentBack: true, ...(reason ? { reason } : {}) };
    else if (/^Recalled close/.test(a)) n = { type: "status", from: "pending_review", to: "in_progress", recalled: true };
    else if (/^Started work/.test(a)) n = { type: "status", from: "acknowledged", to: "in_progress" };
    else if ((m = a.match(/^Moved ISS-\d+ to (.+)$/)) && LABEL_STATUS[m[1]]) n = { type: "status", to: LABEL_STATUS[m[1]] };
  } else if (e.kind === "priority" && (m = a.match(/priority to (\w+)/))) n = { type: "priority", to: m[1].toLowerCase() };
  else if (e.kind === "request") {
    const reason = a.split(" · ").slice(1).join(" · ");
    if (/^Requested withdrawal/.test(a)) n = { type: "request", req: "withdraw", reason };
    else if (/^Disputed/.test(a)) n = { type: "request", req: "dispute", reason };
    else if (/^Flagged/.test(a)) n = { type: "request", req: "flag", reason };
  } else if (e.kind === "removal") {
    const reason = a.split(" · ")[1];
    if (/^Withdrew/.test(a)) n = { type: "withdrawn", reason };
    else if ((m = a.match(/^Merged ISS-\d+ into (ISS-\d+)/))) n = { type: "merged", into: m[1] };
    else if (/^Dismissed/.test(a)) n = { type: "dismissed", reason };
    else if (/^Restored/.test(a)) n = { type: "restored" };
    else if ((m = a.match(/^(Approved|Declined) (withdrawal|dispute|invalid flag) on/))) n = { type: "decided", verdict: m[1] === "Approved" ? "approved" : "declined", req: m[2] === "withdrawal" ? "withdraw" : m[2] === "dispute" ? "dispute" : "flag" };
  }
  return n ? { ...e, n } : e;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshBoard();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.issues) || !Array.isArray(parsed.audit)) return freshBoard();
    const board = parsed;
    return {
      ...board,
      issues: board.issues.map(normalizeIssue),
      audit: board.audit.map(withNotice),
    };
  } catch {
    return freshBoard();
  }
}

const boot = load();
let issues = boot.issues; // every issue, removed ones included
let audit = boot.audit;
// the board everyone works from: withdrawn and dismissed issues leave it
const onBoard = (list) => list.filter((i) => !i.removed);
let active = onBoard(issues);
const listeners = new Set();

/* the server connection (services/issueSync.js); null = this browser's own board */
let remote = null;
export function connectRemote(r) { remote = r; }
const onServer = () => Boolean(remote && remote.active());
const send = (action, payload) => { if (onServer()) remote.send(action, payload); };

/* server mode: the server's lists replace this board */
export function replaceBoard(list, auditList) {
  issues = (list || []).map(normalizeIssue);
  if (auditList) audit = auditList;
  active = onBoard(issues);
  listeners.forEach((fn) => fn());
}
export function setAudit(list) {
  audit = list || [];
  listeners.forEach((fn) => fn());
}
/* one issue as the server has it (new, changed, or no longer visible: null) */
export function upsertIssue(id, issue) {
  const has = issues.some((i) => i.id === id);
  if (!issue) issues = issues.filter((i) => i.id !== id);
  else issues = has ? issues.map((i) => (i.id === id ? normalizeIssue(issue) : i)) : [normalizeIssue(issue), ...issues];
  active = onBoard(issues);
  listeners.forEach((fn) => fn());
}

// Saves the board. Returns false when the browser refused (storage full, usually
// photos, or blocked): the board still works for this tab, but won't survive a reload.
function emit() {
  let stored = true;
  if (onServer()) { active = onBoard(issues); listeners.forEach((fn) => fn()); return true; } // the server keeps it
  try {
    localStorage.setItem(KEY, JSON.stringify({ issues, audit: audit.slice(0, 600), anchor: Date.now() }));
  } catch {
    stored = false;
  }
  active = onBoard(issues);
  listeners.forEach((fn) => fn());
  return stored;
}

/* another tab changed the board (e.g. command dispatched in one tab, the
   crew's desk is open in another): take its copy and redraw, without saving */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue || onServer()) return;
    try {
      const next = JSON.parse(e.newValue);
      if (!Array.isArray(next.issues) || !Array.isArray(next.audit)) return;
      issues = next.issues.map(normalizeIssue);
      audit = next.audit;
      active = onBoard(issues);
      listeners.forEach((fn) => fn());
    } catch { /* a half-written value: the next save brings it */ }
  });
}

function now() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushAudit(event) {
  audit = [{ id: uid("a"), at: now(), issueId: null, kind: "status", ...event }, ...audit];
}

/* the working board (no withdrawn or dismissed issues) */
export function getIssues() {
  return active;
}

/* everything, removed issues included (My Reports, the audit trail, restore) */
export function getAllIssues() {
  return issues;
}

export function getAudit() {
  return audit;
}

export function nextIssueId() {
  const nums = issues.map((i) => Number(i.id.replace("ISS-", ""))).filter(Boolean);
  return `ISS-${(nums.length ? Math.max(...nums) : 2400) + 1}`;
}

/* Record a command event that is not tied to an issue change
   (Staff Desk clearance, rank, verify, removal, uplink).
   subject: snapshot of the person the event is about (see the header). */
export function logEvent({ actor, role = "admin", action, issueId = null, kind = "desk", verb, subject }) {
  if (!action) return;
  const extra = {};
  if (verb) extra.verb = verb;
  if (subject) extra.subject = subject;
  pushAudit({ actor: actor || ADMIN, role, action, issueId, kind, ...extra });
  emit();
}

/* Returns true when the board (with this report) was stored in the browser. */
export function addIssue(issue) {
  issues = [normalizeIssue(issue), ...issues];
  pushAudit({ actor: issue.reportedBy, role: "citizen", action: `Filed ${issue.id}${issue.danger ? " · danger flagged" : ""}`, issueId: issue.id, kind: "filed", n: { type: "filed", reporterId: issue.reporterId || null } });
  const stored = emit();
  emitEvent(EVENTS.ISSUE_FILED, { id: issue.id, title: issue.title, category: issue.category, ward: issue.ward, priority: issue.priority, danger: Boolean(issue.danger), by: issue.reportedBy, role: "citizen" });
  return stored;
}

/* A report could not be stored with its photos: keep the report, drop the photos. */
export function dropPhotos(id) {
  issues = issues.map((issue) => (issue.id !== id ? issue : { ...issue, photos: [], photosDropped: (issue.photos || []).length }));
  return emit();
}

/* Another citizen confirms the same problem ("me too"). They follow the report
   from then on. The reporter can't support their own report, nobody twice. */
export function supportIssue(id, user) {
  const current = issues.find((issue) => issue.id === id);
  if (!current || !user || current.status === "resolved") return false;
  if (current.reporterId === user.id || (current.supporters || []).some((s) => s.id === user.id)) return false;
  const supporters = [...(current.supporters || []), { id: user.id, name: user.name, at: now() }];
  issues = issues.map((issue) => (issue.id !== id ? issue : {
    ...issue,
    supporters,
    savedBy: [...new Set([...(issue.savedBy || []), user.id])],
  }));
  pushAudit({ actor: user.name, role: "citizen", action: `Also reported ${id} (${supporters.length + 1} citizens affected)`, issueId: id, kind: "filed", n: { type: "supported", userId: user.id, count: supporters.length + 1 } });
  emit();
  emitEvent(EVENTS.ISSUE_SUPPORTED, { id, count: supporters.length + 1, by: user.name, role: "citizen" });
  send("support", { id });
  return true;
}

/* meta.reason: why the move happened (close-gate moves always carry one).
   It goes on the timeline step, the audit line and the live event.
   Command sending a close request back also counts the return on the issue
   (returned, lastReturn) so the field sees why, and command sees repeats. */
export function updateStatus(id, status, by, role = "staff", meta = {}) {
  const current = issues.find((issue) => issue.id === id);
  if (!current || current.status === status) return;
  const reason = String(meta.reason || "").trim();
  const at = now();
  const sentBack = status === "in_progress" && current.status === "pending_review" && role === "admin";
  const withdrawn = status === "in_progress" && current.status === "pending_review" && role === "staff";

  issues = issues.map((issue) => {
    if (issue.id !== id) return issue;
    const next = {
      ...issue,
      status,
      updatedAt: at,
      timeline: [...issue.timeline, { status, at, by, ...(reason ? { note: reason } : {}) }],
    };
    if (sentBack) {
      next.returned = (issue.returned || 0) + 1;
      next.lastReturn = { reason, by, at };
    }
    // a fresh close request answers the last return; a confirmed close ends it
    if (status === "pending_review" || status === "resolved") next.lastReturn = null;
    return next;
  });
  let action = `Moved ${id} to ${STATUS_LABEL[status] || status}`;
  if (status === "pending_review") action = `Requested close on ${id}`;
  if (status === "resolved" && role === "admin") action = `Confirmed close on ${id}`;
  if (sentBack) action = `Sent ${id} back to the field`;
  if (withdrawn) action = `Recalled close request on ${id}`;
  if (status === "in_progress" && current.status === "acknowledged" && role === "staff") action = `Started work on ${id}`;
  if (reason && (sentBack || withdrawn || (status === "resolved" && role === "admin"))) action += `: ${reason}`;
  pushAudit({ actor: by, role, action, issueId: id, kind: "status", n: { type: "status", from: current.status, to: status, owner: current.assignedTo || null, ...(reason ? { reason } : {}), ...(sentBack ? { sentBack: true } : {}), ...(withdrawn ? { recalled: true } : {}) } });
  emit();
  send("status", { id, status, ...(reason ? { note: reason } : {}) });

  const base = { id, owner: current.assignedTo || null, by, role };
  emitEvent(EVENTS.ISSUE_STATUS, { ...base, from: current.status, to: status, ...(reason ? { reason } : {}) });
  if (status === "pending_review") emitEvent(EVENTS.ISSUE_CLOSE_REQUESTED, base);
  if (status === "resolved") emitEvent(EVENTS.ISSUE_RESOLVED, { ...base, ...(reason ? { note: reason } : {}) });
  if (sentBack) emitEvent(EVENTS.ISSUE_SENT_BACK, { ...base, reason, returned: (current.returned || 0) + 1 });
  if (withdrawn) emitEvent(EVENTS.ISSUE_CLOSE_WITHDRAWN, { ...base, reason });
}

/* note: optional tag added to the audit line, e.g. "off-expertise".
   Work in motion (In Progress / Pending Review) belongs to its owner: when the
   owner changes or is taken off, the file goes back to Acknowledged so the new
   owner starts it fresh (and nobody inherits someone else's close request). */
export function assignIssue(id, staffName, by, role = "admin", note = "") {
  if (role !== "admin") return null;
  const current = issues.find((issue) => issue.id === id);
  if (!current) return null;
  const previous = current.assignedTo;
  if ((previous || null) === (staffName || null)) return null;

  const inMotion = current.status === "in_progress" || current.status === "pending_review";
  let step = null;
  if (staffName && current.status === "submitted") step = `Assigned to ${staffName}`;
  else if (staffName && previous && inMotion) step = `Reassigned from ${previous} to ${staffName}`;
  else if (!staffName && inMotion) step = `Returned to dispatch: unassigned from ${previous}`;

  issues = issues.map((issue) =>
    issue.id !== id
      ? issue
      : {
          ...issue,
          assignedTo: staffName || null,
          assignedAt: staffName ? now() : null,
          updatedAt: now(),
          status: step ? "acknowledged" : issue.status,
          timeline: step ? [...issue.timeline, { status: "acknowledged", at: now(), by, note: step }] : issue.timeline,
          // a new owner starts clean: no return banner or return count from someone else's attempt
          returned: staffName !== previous ? 0 : issue.returned || 0,
          lastReturn: staffName !== previous ? null : issue.lastReturn || null,
        }
  );
  let action = `Assigned ${id} to ${staffName}`;
  if (!staffName) action = `Unassigned ${id} from ${previous}`;
  else if (previous) action = `Reassigned ${id} from ${previous} to ${staffName}`;
  if (staffName && note) action += ` (${note})`;
  if (inMotion && step) action += current.status === "pending_review" ? " · close request withdrawn" : " · back to Acknowledged";
  const eventId = uid("a");
  audit = [{ id: eventId, at: now(), issueId: id, actor: by, role: "admin", action, kind: "dispatch", ...(staffName ? { to: staffName } : {}), n: { type: "assign", to: staffName || null, from: previous || null } }, ...audit];
  emit();
  emitEvent(EVENTS.ISSUE_ASSIGNED, { id, to: staffName || null, from: previous || null, by, role: "admin" });
  send("assign", { id, staff: staffName || null, ...(note ? { note } : {}) });
  // undo (the few-second Undo notice): the issue exactly as it was, and the dispatch leaves the trail
  return () => {
    issues = issues.map((issue) => (issue.id === id ? current : issue));
    audit = audit.filter((e) => e.id !== eventId);
    emit();
    emitEvent(EVENTS.ISSUE_ASSIGNED, { id, to: previous || null, from: staffName || null, by, role: "admin", undo: true });
    send("assign", { id, staff: previous || null, undo: true });
  };
}

/* A priority change also resets the service window from the policy table
   (store/slaPolicyStore.js), still counted from the original report time.
   A closed issue keeps its window: its record is final. */
export function setPriority(id, priority, by, role = "admin") {
  if (role !== "admin") return;
  const current = issues.find((issue) => issue.id === id);
  if (!current || current.priority === priority) return;
  const open = current.status !== "resolved";
  const hours = open ? windowFor(priority, current.category) : current.slaHours;
  const moved = open && hours !== current.slaHours;

  issues = issues.map((issue) =>
    issue.id !== id ? issue : { ...issue, priority, slaHours: hours, updatedAt: now() }
  );
  let action = `Set ${id} priority to ${PRIORITY_LABEL[priority] || priority}`;
  if (moved) action += ` · window ${current.slaHours ? `${current.slaHours}h` : "none"} → ${hours}h`;
  pushAudit({ actor: by, role: "admin", action, issueId: id, kind: "priority", n: { type: "priority", from: current.priority, to: priority, owner: current.assignedTo || null } });
  emit();
  emitEvent(EVENTS.ISSUE_PRIORITY, { id, from: current.priority, to: priority, window: hours, by, role: "admin" });
  send("priority", { id, priority });
}

/* A staff member left the field: their open issues go back to dispatch.
   In-progress work returns to Acknowledged so it shows as needing a new owner.
   Returns how many issues were released. */
export function releaseIssuesOf(staffName, by = ADMIN) {
  const open = issues.filter((i) => i.assignedTo === staffName && i.status !== "resolved");
  if (!open.length) return 0;
  const ids = new Set(open.map((i) => i.id));
  issues = issues.map((issue) => {
    if (!ids.has(issue.id)) return issue;
    const back = issue.status === "in_progress" || issue.status === "pending_review";
    return {
      ...issue,
      assignedTo: null,
      assignedAt: null,
      updatedAt: now(),
      status: back ? "acknowledged" : issue.status,
      timeline: back
        ? [...issue.timeline, { status: "acknowledged", at: now(), by, note: `Returned to dispatch: ${staffName} left the field` }]
        : issue.timeline,
    };
  });
  open.forEach((i) => pushAudit({ actor: by, role: "admin", action: `Returned ${i.id} to dispatch (${staffName} left the field)`, issueId: i.id, kind: "dispatch", n: { type: "assign", to: null, from: staffName, left: true } }));
  emit();
  open.forEach((i) => emitEvent(EVENTS.ISSUE_ASSIGNED, { id: i.id, to: null, from: staffName, by, role: "admin" }));
  return open.length;
}

/* Saves are per person: savedBy holds the citizen ids following this report. */
export function toggleSaved(id, userId) {
  if (!userId) return;
  issues = issues.map((issue) => {
    if (issue.id !== id) return issue;
    const list = issue.savedBy || [];
    return { ...issue, savedBy: list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId] };
  });
  emit();
  const after = issues.find((i) => i.id === id);
  send("follow", { id, on: Boolean(after?.savedBy?.includes(userId)) });
}

export function addComment(id, body, author, role, internal = false) {
  if (!issues.some((issue) => issue.id === id) || isMash(body)) return;
  issues = issues.map((issue) =>
    issue.id !== id
      ? issue
      : {
          ...issue,
          updatedAt: now(),
          comments: [
            ...issue.comments,
            { id: uid("c"), author, role, body, createdAt: now(), internal },
          ],
        }
  );
  emit();
  emitEvent(EVENTS.ISSUE_NOTE, { id, author, internal, by: author, role });
  send("comment", { id, body, internal: Boolean(internal) });
}


/* ------------------------------------------------------------------
   Removal from the board. Nothing is ever erased: a removed issue keeps
   its whole record and drops off every board, count, map and chart.
     removed: { kind: "withdrawn" | "dismissed", reason, note, by, role, at, linkedTo }
   Requests (one message each way, kept on the issue):
     requests: [{ id, type: "withdraw" | "dispute" | "flag", by, byId, role, reason, note, at,
                  seenAt, decided: { verdict: "approved" | "declined", reason, by, at } }]
   - citizen, report still New (no crew): withdraw at once
   - citizen, crew assigned: request withdrawal → admin decides
   - citizen, report dismissed: dispute → admin decides (approve = restore)
   - staff: flag as invalid → admin decides
   - admin: dismiss (reason required), undo for a few seconds, restore later
------------------------------------------------------------------- */
export const WITHDRAW_REASONS = ["Submitted by mistake", "Duplicate report", "Already fixed", "Wrong location"];
export const DISMISS_REASONS = ["Spam or test", "Duplicate report", "Not a city issue", "Location not found"];
export const FLAG_REASONS = ["Duplicate report", "Not a city issue", "Location not found", "Already fixed"];

const REQUEST_LABEL = { withdraw: "withdrawal", dispute: "dispute", flag: "invalid flag" };
export const openRequest = (issue) => [...(issue?.requests || [])].reverse().find((r) => !r.decided) || null;
export const lastRequest = (issue) => (issue?.requests || [])[(issue?.requests || []).length - 1] || null;

function patch(id, fn) {
  issues = issues.map((issue) => (issue.id !== id ? issue : fn(issue)));
}

/* citizen, own report, still New with no crew */
export function canWithdraw(issue, user) {
  return Boolean(issue && user && !issue.removed && issue.reporterId === user.id && issue.status === "submitted" && !issue.assignedTo);
}

export function withdrawIssue(id, user, reason, note = "") {
  if (isMash(note)) return false;
  const current = issues.find((i) => i.id === id);
  if (!canWithdraw(current, user) || !reason) return false;
  const at = now();
  patch(id, (i) => ({ ...i, updatedAt: at, removed: { kind: "withdrawn", reason, note: note.trim(), by: user.name, role: "citizen", at } }));
  pushAudit({ actor: user.name, role: "citizen", action: `Withdrew ${id} · ${reason}`, issueId: id, kind: "removal", n: { type: "withdrawn", reason } });
  emit();
  emitEvent(EVENTS.ISSUE_STATUS, { id, owner: null, by: user.name, role: "citizen", from: current.status, to: "withdrawn", reason });
  send("withdraw", { id, reason, note: note.trim() });
  return true;
}

/* type: "withdraw" (citizen, crew assigned) · "dispute" (citizen, dismissed) · "flag" (staff) */
/* Field flags: a duplicate can be checked from the desk (name the original);
   the other reasons are on-site findings, so only once work has started,
   and they need a note saying what the crew found. */
export const FLAG_ON_SITE = ["Not a city issue", "Location not found", "Already fixed"];
export const onSite = (issue) => issue?.status === "in_progress" || issue?.status === "pending_review";
export function canFlagWith(issue, reason) {
  if (reason === "Duplicate report") return true;
  return FLAG_ON_SITE.includes(reason) && onSite(issue);
}

export function requestRemoval(id, user, type, reason, note = "", linkedTo = null) {
  if (isMash(note)) return false;
  const current = issues.find((i) => i.id === id);
  if (!current || !user || !reason || openRequest(current)) return false;
  if (type === "flag") {
    if (!canFlagWith(current, reason)) return false;
    if (reason === "Duplicate report" && !linkedTo) return false;
    if (reason !== "Duplicate report" && String(note).trim().length < 10) return false;
  }
  if (type === "withdraw" && (current.removed || current.reporterId !== user.id)) return false;
  if (type === "dispute" && (current.removed?.kind !== "dismissed" || current.reporterId !== user.id)) return false;
  if (type === "flag" && (current.removed || current.assignedTo !== user.name)) return false;
  const req = { id: uid("rq"), type, by: user.name, byId: user.id, role: type === "flag" ? "staff" : "citizen", reason, note: note.trim(), at: now(), seenAt: null, decided: null, ...(linkedTo ? { linkedTo } : {}) };
  patch(id, (i) => ({ ...i, requests: [...(i.requests || []), req] }));
  const verb = type === "withdraw" ? `Requested withdrawal of ${id}` : type === "dispute" ? `Disputed the dismissal of ${id}` : `Flagged ${id} as invalid`;
  pushAudit({ actor: user.name, role: req.role, action: `${verb} · ${reason}`, issueId: id, kind: "request", n: { type: "request", req: type, reason, ...(linkedTo ? { linkedTo } : {}) } });
  emit();
  send("request", { id, type, reason, note: note.trim(), ...(linkedTo ? { linkedTo } : {}) });
  return true;
}

/* the admin opened the file: the requester's track lights "Seen" */
export function markRequestSeen(id) {
  const current = issues.find((i) => i.id === id);
  const req = openRequest(current);
  if (!req || req.seenAt) return;
  patch(id, (i) => ({ ...i, requests: i.requests.map((r) => (r.id === req.id ? { ...r, seenAt: now() } : r)) }));
  emit();
  send("seen", { id, reqId: req.id });
}

function dismissIn(issue, by, reason, note, linkedTo, at) {
  return { ...issue, updatedAt: at, removed: { kind: "dismissed", reason, note: (note || "").trim(), by, role: "admin", at, ...(linkedTo ? { linkedTo } : {}) } };
}

/* admin. Returns an undo function (for the few-second Undo notice), or null. */
export function dismissIssue(id, by, reason, note = "", linkedTo = null) {
  if (isMash(note)) return null;
  const before = issues.find((i) => i.id === id);
  if (!before || before.removed || !reason) return null;
  const at = now();
  patch(id, (i) => dismissIn(i, by, reason, note, linkedTo, at));
  const eventId = uid("a");
  audit = [{ id: eventId, at, actor: by, role: "admin", action: `Dismissed ${id} · ${reason}${linkedTo ? ` (duplicate of ${linkedTo})` : ""}`, issueId: id, kind: "removal", n: { type: "dismissed", reason, owner: before.assignedTo || null, ...(linkedTo ? { linkedTo } : {}) } }, ...audit];
  emit();
  emitEvent(EVENTS.ISSUE_STATUS, { id, owner: before.assignedTo || null, by, role: "admin", from: before.status, to: "dismissed", reason });
  send("dismiss", { id, reason, note: (note || "").trim(), ...(linkedTo ? { linkedTo } : {}) });
  return () => {
    // undo: exactly as it was, and the dismissal leaves the trail
    issues = issues.map((i) => (i.id === id ? before : i));
    audit = audit.filter((e) => e.id !== eventId);
    emit();
    send("restore", { id, note: "Dismissal undone", undo: true });
  };
}

/* Only the city's own call can be undone by the city: a dismissal (including an
   approved field flag). A citizen's withdrawal is theirs, so it stays withdrawn. */
export const canRestore = (issue) => issue?.removed?.kind === "dismissed";

export function restoreIssue(id, by, note = "") {
  if (isMash(note)) return false;
  const current = issues.find((i) => i.id === id);
  if (!canRestore(current)) return false;
  const was = current.removed;
  unmerge(current);
  patch(id, (i) => {
    const next = { ...i, updatedAt: now(), restored: { from: was, by, at: now(), note } };
    delete next.removed;
    return next;
  });
  pushAudit({ actor: by, role: "admin", action: `Restored ${id}${was.merged ? ` (unmerged from ${was.linkedTo})` : ""}${note ? ` · ${note}` : ""}`, issueId: id, kind: "removal", n: { type: "restored", ...(was.merged ? { unmerged: was.linkedTo } : {}) } });
  emit();
  send("restore", { id, note });
  return true;
}

/* ------------------------------------------------------------------
   Duplicates. Two open reports in the same category, within 200 m and
   within 7 days of each other are "possible duplicates"; the older one is
   the original. Merging (admin, or an approved field flag) takes the
   newer one off the board linked to the original, and its reporter (and
   anyone who joined it) count as affected on the original, so nobody's
   report is thrown away. A merge is the city's call, so it can be undone.
------------------------------------------------------------------- */
const DUP_M = 200;
const DUP_DAYS = 7;
const metres = (a, b) => {
  const R = 6371000;
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* the older open reports this one may repeat, nearest first: [{ issue, m }] */
export function possibleDuplicates(issue, list = active) {
  if (!issue || issue.removed || issue.status === "resolved" || !Number.isFinite(issue.lat)) return [];
  const t = new Date(issue.createdAt).getTime();
  return list
    .filter((o) => o.id !== issue.id && !o.removed && o.status !== "resolved" && o.category === issue.category && Number.isFinite(o.lat))
    .filter((o) => new Date(o.createdAt).getTime() <= t && t - new Date(o.createdAt).getTime() <= DUP_DAYS * 864e5)
    .map((o) => ({ issue: o, m: Math.round(metres(issue, o)) }))
    .filter((x) => x.m <= DUP_M)
    .sort((a, b) => a.m - b.m);
}

function mergeInto(issue, intoId, by, at, note = "") {
  const original = issues.find((i) => i.id === intoId);
  if (!original) return { dup: issue, added: [] };
  const have = new Set([original.reporterId, ...(original.supporters || []).map((s) => s.id)]);
  const people = [{ id: issue.reporterId, name: issue.reportedBy, at }, ...(issue.supporters || [])].filter((p) => p.id && !have.has(p.id));
  issues = issues.map((i) => (i.id !== intoId ? i : {
    ...i,
    supporters: [...(i.supporters || []), ...people],
    savedBy: [...new Set([...(i.savedBy || []), ...people.map((p) => p.id)])],
    updatedAt: at,
  }));
  const dup = { ...dismissIn(issue, by, "Duplicate report", note, intoId, at) };
  dup.removed = { ...dup.removed, merged: true, addedTo: people.map((p) => p.id) };
  return { dup, added: people };
}

/* admin: merge a report into the original it repeats. Returns an undo, or null. */
export function mergeIssue(id, intoId, by, note = "") {
  if (isMash(note)) return null;
  const before = issues.find((i) => i.id === id);
  const originalBefore = issues.find((i) => i.id === intoId);
  if (!before || before.removed || !originalBefore || id === intoId) return null;
  const at = now();
  const { dup, added } = mergeInto(before, intoId, by, at, note);
  issues = issues.map((i) => (i.id === id ? dup : i));
  const eventId = uid("a");
  audit = [{ id: eventId, at, actor: by, role: "admin", action: `Merged ${id} into ${intoId} · duplicate report`, issueId: id, kind: "removal", n: { type: "merged", into: intoId, owner: before.assignedTo || null } }, ...audit];
  emit();
  emitEvent(EVENTS.ISSUE_SUPPORTED, { id: intoId, count: 1 + (originalBefore.supporters || []).length + added.length, by, role: "admin" });
  send("merge", { id, into: intoId, note });
  return () => {
    issues = issues.map((i) => (i.id === id ? before : i.id === intoId ? originalBefore : i));
    audit = audit.filter((e) => e.id !== eventId);
    emit();
    send("restore", { id, note: "Merge undone", undo: true });
  };
}

/* undoing a merge later (restore): the people it added leave the original again */
function unmerge(dupIssue) {
  const r = dupIssue.removed;
  if (!r?.merged || !r.linkedTo) return;
  const gone = new Set(r.addedTo || []);
  issues = issues.map((i) => (i.id !== r.linkedTo ? i : {
    ...i,
    supporters: (i.supporters || []).filter((s) => !gone.has(s.id)),
    savedBy: (i.savedBy || []).filter((x) => !gone.has(x) || x === i.reporterId),
  }));
}

/* admin decides the open request. Approving a withdrawal or a flag dismisses
   the issue; approving a dispute restores it. A decline must say why. */
export function decideRequest(id, verdict, by, reason = "") {
  if (isMash(reason)) return false;
  const current = issues.find((i) => i.id === id);
  const req = openRequest(current);
  const reqId = req?.id;
  if (!req || !["approved", "declined"].includes(verdict)) return false;
  const why = String(reason || "").trim();
  if (verdict === "declined" && !why) return false;
  const at = now();
  patch(id, (i) => {
    let next = { ...i, requests: i.requests.map((r) => (r.id === req.id ? { ...r, seenAt: r.seenAt || at, decided: { verdict, reason: why, by, at } } : r)) };
    if (verdict === "approved" && req.type === "flag" && req.reason === "Duplicate report" && req.linkedTo) {
      // merged below, outside this map: the merge also updates the original
    } else if (verdict === "approved" && (req.type === "withdraw" || req.type === "flag")) {
      next = dismissIn(next, by, req.reason, req.note, req.linkedTo || null, at);
      if (req.type === "withdraw") next.removed = { ...next.removed, kind: "withdrawn", requestedBy: req.by };
    }
    if (verdict === "approved" && req.type === "dispute") {
      next = { ...next, updatedAt: at, restored: { from: next.removed, by, at, note: "Dispute approved" } };
      delete next.removed;
    }
    return next;
  });
  const merged = verdict === "approved" && req.type === "flag" && req.reason === "Duplicate report" && req.linkedTo;
  if (merged) {
    // a field duplicate flag merges into the original; it doesn't discard the report
    const cur = issues.find((i) => i.id === id);
    const { dup } = mergeInto(cur, req.linkedTo, by, at, req.note);
    issues = issues.map((i) => (i.id === id ? dup : i));
  }
  const label = REQUEST_LABEL[req.type];
  pushAudit({ actor: by, role: "admin", action: `${verdict === "approved" ? "Approved" : "Declined"} ${label} on ${id}${merged ? ` · merged into ${req.linkedTo}` : ""}${why ? ` · ${why}` : ""}`, issueId: id, kind: "removal", n: { type: "decided", req: req.type, verdict, by: req.by, byId: req.byId || null, ...(why ? { reason: why } : {}), ...(merged ? { into: req.linkedTo } : {}) } });
  emit();
  send("decide", { id, reqId, verdict, ...(why ? { reason: why } : {}) });
  return true;
}

/* Report quality: the keyboard-mash check lives in utils/textGuard.js,
   shared by every place people write. Kept under this name for callers. */
export { isMash as looksLikeMash };

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useIssues() {
  return useSyncExternalStore(subscribe, getIssues, getIssues);
}

export function useAllIssues() {
  return useSyncExternalStore(subscribe, getAllIssues, getAllIssues);
}

export function useAudit() {
  return useSyncExternalStore(subscribe, getAudit, getAudit);
}