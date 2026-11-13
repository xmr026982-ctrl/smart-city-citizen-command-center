import { useSyncExternalStore } from "react";
import { isExpertiseId, expertiseLabel } from "../config/expertise";
import { logEvent, releaseIssuesOf, getIssues, setAudit } from "./issueStore";
import { getUser, getAccount, subscribeRole } from "./authStore";
import { SERVER_ON } from "../config/server";
import { api } from "../lib/api";
import { onEvent, EVENTS, STREAM_RESUMED } from "../services/events";
import { serverNotice } from "../services/notice";

/* ------------------------------------------------------------------
   Staff Desk roster + clearance queue.

   WITH THE SERVER (signed in through it): everything is the server's.
     command  GET /staff (staff accounts + cleared people awaiting uplink)
              GET /staff-requests?status=pending
              rank, verify, remove, reject: PATCH/DELETE, then read again
     staff    their own record (from their account) + crew coverage counts
     citizen  crew coverage counts only (GET /staff/coverage: no names)
     Read again on staff:changed, staff:duty, profile:updated, reconnect.
     The server writes every audit row; nothing is invented here.
   WITHOUT A SERVER: an empty roster kept in this browser.

   Load and closed counts are NOT stored here: they come live from the
   issue board (see store/fieldRoster.js). "closedPrior" is the history
   a person brought from before this board existed.
   Every admin action here is written to the command audit trail, with
   a snapshot of the person (subject) so the Audit Log can open their
   file, even after they leave the system.
------------------------------------------------------------------- */

const actor = () => getUser()?.name || "City Command";
const onServer = () => SERVER_ON && getUser()?.source === "server";

// Who an audit event is about, as they were at that moment.
function snap(p, extra = {}) {
  return {
    id: p.id,
    name: p.name,
    email: p.email || "",
    rank: p.rank || "",
    expertise: p.expertise,
    zone: p.zone,
    experience: p.experience || "",
    ...extra,
  };
}

function desk(verb, person, action, opts = {}) {
  logEvent({ actor: opts.actor || actor(), role: opts.role || "admin", action, verb, subject: snap(person, opts.extra) });
}

const KEY = "staff-desk-roster-v6";
const OLD_KEYS = ["staff-desk-roster-v5", "staff-desk-roster-v4", "staff-desk-roster-v3"];

export const RANKS = [
  "Field Operative",
  "Specialist",
  "Senior Specialist",
  "Zone Lead",
  "Command Fellow",
];

// Expertise lives in config/expertise.js (shared by the whole system).
// Re-exported here so existing imports keep working.
export { EXPERTISE, expertiseLabel, matchesExpertise, isExpertiseId } from "../config/expertise";

// Same options as the Staff Request form.
export const EXPERIENCE = ["Field Active", "2 Years", "5 Years", "10 Years", "Senior Field"];

export const ZONES = [
  "Shyambazar",
  "B.B.D. Bagh",
  "Ballygunge",
  "College Street",
  "B.P. Township",
  "Dharmatala",
];

/* Uplink: after Accept, a cleared staff member is "awaiting" until their
   first sign-in, then "live".
   dispatch: state of the activation key email: "sending" | "sent" | "failed". */
export const UPLINK_STALL_DAYS = 3; // awaiting longer than this = stalled
export const UPLINK_FRESH_HOURS = 24; // "Uplinked" chip shows this long

// The roster starts empty: every person comes from the server (GET /staff).
const SEED_ROSTER = [];
const SEED_REQUESTS = [];

/* ---------------------------------------------------------- uplink helpers */

const hoursSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity);

// "awaiting" | "stalled" | "failed" | "sending" | "fresh" (uplinked < 24h) | "live"
export function uplinkPhase(person) {
  if (person.uplink === "awaiting") {
    if (person.dispatch === "sending") return "sending";
    if (person.dispatch === "failed") return "failed";
    if (hoursSince(person.keySentAt || person.acceptedAt) >= UPLINK_STALL_DAYS * 24) return "stalled";
    return "awaiting";
  }
  if (hoursSince(person.uplinkedAt) < UPLINK_FRESH_HOURS) return "fresh";
  return "live";
}

export function isAwaiting(person) {
  return person.uplink === "awaiting";
}

/* ---------------------------------------------------------- store */

// older saved rosters: no uplink fields = already live; old "closed" = prior history
function normalize(p) {
  const base = { ...p, closedPrior: p.closedPrior ?? p.closed ?? 0 };
  delete base.load;
  delete base.closed;
  // a key send can't survive a reload: if it was mid-flight, show it as not sent so it can be re-transmitted
  if (base.dispatch === "sending") base.dispatch = "failed";
  if (base.uplink === "awaiting" || base.uplink === "live") return base;
  return { ...base, uplink: "live", dispatch: "sent", uplinkedAt: base.uplinkedAt || null };
}

function load() {
  try {
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(KEY);
    if (!raw) return { roster: SEED_ROSTER, requests: SEED_REQUESTS };
    const parsed = JSON.parse(raw);
    return {
      roster: Array.isArray(parsed.roster) ? parsed.roster.map(normalize) : SEED_ROSTER,
      requests: Array.isArray(parsed.requests) ? parsed.requests : SEED_REQUESTS,
    };
  } catch {
    return { roster: SEED_ROSTER, requests: SEED_REQUESTS };
  }
}

const EMPTY = { roster: [], requests: [] };
let state = SERVER_ON ? EMPTY : load();
const listeners = new Set();

function emit() {
  if (!onServer()) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked */
    }
  }
  listeners.forEach((fn) => fn());
}

/* ---------------------------------------------------------- server */

/* the signed-in staff member's own roster record, from their account */
function ownEntry() {
  const me = getUser();
  const a = getAccount();
  if (!me || me.role !== "staff" || !a) return null;
  return {
    id: me.serverId,
    name: a.name,
    displayName: a.displayName || "",
    email: a.email || "",
    rank: a.rank || "Field Operative",
    expertise: a.expertise || "civic",
    experience: a.experience || "",
    verified: Boolean(a.verified),
    zone: a.zone || "",
    duty: a.dutyStatus || "off",
    onDuty: a.dutyStatus === "on",
    closedPrior: 0,
    uplink: "live",
    dispatch: "sent",
  };
}

/* crews on duty as anonymous entries (counts by zone and expertise, never names) */
function coverageEntries(items = []) {
  const out = [];
  items.forEach((c) => {
    for (let i = 0; i < Number(c.onDuty || 0); i += 1) {
      out.push({ id: `cov-${c.zone}-${c.expertise}-${i}`, name: "", anonymous: true, zone: c.zone, expertise: c.expertise, onDuty: true, duty: "on", uplink: "live", dispatch: "sent", closedPrior: 0, rank: "", verified: false });
    }
  });
  return out;
}

let loading = null;
let again = false;
/** Read the desk again from the server (debounced: one request at a time). */
export function refreshDesk() {
  if (!onServer()) return Promise.resolve();
  if (loading) {
    again = true;
    return loading;
  }
  const role = getUser()?.role;
  loading = (async () => {
    try {
      if (role === "admin") {
        const [staff, requests] = await Promise.all([api.get("/staff"), api.get("/staff-requests?status=pending")]);
        state = { roster: staff.data?.items || [], requests: requests.data?.items || [] };
      } else {
        const { data } = await api.get("/staff/coverage");
        const mine = ownEntry();
        const others = coverageEntries(data?.items || []);
        // the signed-in crew member is counted in the coverage too: drop one anonymous match for them
        if (mine?.onDuty) {
          const i = others.findIndex((p) => p.zone === mine.zone && p.expertise === mine.expertise);
          if (i >= 0) others.splice(i, 1);
        }
        state = { roster: mine ? [mine, ...others] : others, requests: [] };
      }
      listeners.forEach((fn) => fn());
    } catch (err) {
      if (err?.status && err.status !== 401) serverNotice(err.message || "The Staff Desk couldn't be loaded.");
    } finally {
      loading = null;
      if (again) {
        again = false;
        refreshDesk();
      }
    }
  })();
  return loading;
}

/* command's trail after a desk change (the server wrote the row) */
let auditTimer = null;
function rereadAudit() {
  if (getUser()?.role !== "admin") return;
  clearTimeout(auditTimer);
  auditTimer = setTimeout(async () => {
    try {
      const { data } = await api.get("/audit");
      setAudit(data?.items || []);
    } catch {
      /* the next change tries again */
    }
  }, 500);
}

/* send one desk change; the screen already shows it. Refused: the message, then the server's copy. */
async function send(method, url, body) {
  try {
    const { data } = await api[method](url, body);
    return data;
  } catch (err) {
    if (err?.status !== 401) serverNotice(err?.message || "The server didn't accept that change.");
    return null;
  } finally {
    refreshDesk();
    rereadAudit();
  }
}

let who = "";
subscribeRole(() => {
  const me = getUser();
  const next = onServer() ? `${me.serverId}:${me.role}` : me ? "local" : "";
  if (next === who) return;
  who = next;
  if (onServer()) {
    state = EMPTY;
    listeners.forEach((fn) => fn());
    refreshDesk();
  } else if (next === "local") {
    state = load();
    listeners.forEach((fn) => fn());
  } else {
    state = SERVER_ON ? EMPTY : load();
    listeners.forEach((fn) => fn());
  }
});
[EVENTS.STAFF_CHANGED, EVENTS.STAFF_DUTY, STREAM_RESUMED].forEach((name) => onEvent(name, () => refreshDesk()));
// a staff member's own account changed (rank, zone, duty): their record follows
// command: a crew member renamed or changed photo. Staff: their own record changed (rank, zone, duty).
onEvent(EVENTS.PROFILE_UPDATED, (e) => {
  const me = getUser();
  if (me?.role === "admin" || (me?.role === "staff" && String(e?.id) === me.serverId)) setTimeout(refreshDesk, 600);
});

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export { subscribe as subscribeDesk };

// another tab changed the roster (a crew went off duty, command cleared someone): follow it
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || onServer()) return;
    state = load();
    listeners.forEach((fn) => fn());
  });
}

export function useDesk() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getDesk() {
  return state;
}

function patch(id, fields) {
  state = { ...state, roster: state.roster.map((p) => (p.id === id ? { ...p, ...fields } : p)) };
  emit();
}

/* Accept: the person joins On field as "awaiting" (not on duty, no work yet).
   Returns the new record so the uplink service can send the activation key.
   Use acceptAndDispatch() from services/staffUplinkService.js, not this directly. */
export function acceptRequest(id, rank = "Field Operative") {
  const req = state.requests.find((r) => r.id === id);
  if (!req) return null;
  const now = new Date().toISOString();
  const person = {
    id: `stf-${Date.now()}`,
    requestId: req.id,
    name: req.name,
    email: req.email || "",
    rank: RANKS.includes(rank) ? rank : "Field Operative",
    expertise: isExpertiseId(req.expertise) ? req.expertise : "civic",
    experience: req.experience || "",
    note: req.note || "",
    verified: false,
    zone: req.zone,
    onDuty: false,
    closedPrior: 0,
    uplink: "awaiting",
    dispatch: "sending",
    requestedAt: req.filedAt,
    acceptedAt: now,
    keySentAt: null,
    uplinkedAt: null,
  };
  state = { roster: [person, ...state.roster], requests: state.requests.filter((r) => r.id !== id) };
  emit();
  if (onServer()) return person; // the server clears them and writes the trail (approve)
  desk("cleared", person, `Cleared ${person.name} as ${person.rank} · ${expertiseLabel(person.expertise)} · ${person.zone}`);
  return person;
}

export function setDispatch(id, dispatch) {
  const fields = { dispatch };
  if (dispatch === "sent") fields.keySentAt = new Date().toISOString();
  patch(id, fields);
  if (onServer()) return;
  const person = state.roster.find((p) => p.id === id);
  if (person && dispatch === "failed") desk("key", person, `Activation key for ${person.name} was not sent`, { actor: "System" });
}

// First successful sign-in. Matched by email (the backend knows the email).
export function markUplinked(emailOrId, at = new Date().toISOString()) {
  if (onServer()) {
    refreshDesk(); // the server records the first sign-in itself
    return true;
  }
  const key = String(emailOrId).toLowerCase();
  const person = state.roster.find((p) => p.id === emailOrId || (p.email || "").toLowerCase() === key);
  if (!person || person.uplink === "live") return false;
  patch(person.id, { uplink: "live", dispatch: "sent", uplinkedAt: at, onDuty: true });
  desk("uplink", person, `${person.name} uplinked (first sign-in)`, { actor: person.name, role: "staff" });
  return true;
}

export function rejectRequest(id) {
  const req = state.requests.find((r) => r.id === id);
  state = { ...state, requests: state.requests.filter((r) => r.id !== id) };
  emit();
  if (onServer()) {
    send("patch", `/staff-requests/${encodeURIComponent(id)}/reject`, {});
    return;
  }
  if (req) desk("rejected", { ...req, rank: "" }, `Rejected clearance for ${req.name} · ${expertiseLabel(req.expertise)} · ${req.zone}`, { extra: { filedAt: req.filedAt, note: req.note || "" } });
}

/* Remove from the system. Their open issues go back to dispatch.
   Returns how many issues were released. */
export function removeStaff(id) {
  const person = state.roster.find((p) => p.id === id);
  state = { ...state, roster: state.roster.filter((p) => p.id !== id) };
  emit();
  if (!person) return 0;
  if (onServer()) {
    // the server returns their open files to dispatch; the board follows from the issue events
    send("delete", `/staff/${encodeURIComponent(id)}`);
    return 0;
  }
  // closed count at the moment of removal (history + resolved on the board), kept in the record
  const closed = (person.closedPrior || 0) + getIssues().filter((i) => i.assignedTo === person.name && i.status === "resolved").length;
  const released = releaseIssuesOf(person.name, actor());
  desk(
    "removed",
    person,
    `Removed ${person.name} from the field${released ? ` · ${released} open issue${released === 1 ? "" : "s"} returned to dispatch` : ""}`,
    { extra: { closed, released, verified: Boolean(person.verified), acceptedAt: person.acceptedAt || null, uplinked: person.uplink === "live" } }
  );
  return released;
}

export function setRank(id, rank) {
  if (!RANKS.includes(rank)) return;
  const person = state.roster.find((p) => p.id === id);
  if (!person || person.rank === rank) return;
  const up = RANKS.indexOf(rank) > RANKS.indexOf(person.rank);
  patch(id, { rank });
  if (onServer()) {
    send("patch", `/staff/${encodeURIComponent(id)}/rank`, { rank });
    return;
  }
  desk("rank", { ...person, rank }, `${up ? "Promoted" : "Moved"} ${person.name} ${up ? "to" : "back to"} ${rank}`);
}

/* Duty: "on" | "break" | "off". Only "on" takes new work (onDuty).
   Set by the person themselves (profile menu or Settings), written to the trail. */
export const DUTY_LABEL = { on: "on duty", break: "on break", off: "off duty" };
export function setDuty(id, status, by, role = "staff") {
  if (!DUTY_LABEL[status]) return false;
  const person = state.roster.find((p) => p.id === id);
  if (!person) return false;
  const was = person.duty || (person.onDuty ? "on" : "off");
  if (was === status) return true;
  patch(id, { onDuty: status === "on", duty: status });
  if (onServer()) return true; // services: dutyStore sends PATCH /staff/me/duty
  desk("duty", { ...person, onDuty: status === "on" }, `${person.name} is ${DUTY_LABEL[status]}`, { actor: by || person.name, role });
  return true;
}

// The Verified badge unlocks only after uplink: nobody can vouch for an account
// that has not been activated yet.
export function canVerify(person) {
  return Boolean(person) && person.uplink !== "awaiting";
}

export function setVerified(id, on) {
  const person = state.roster.find((p) => p.id === id);
  if (on && !canVerify(person)) return false;
  if (!person || Boolean(person.verified) === Boolean(on)) return true;
  patch(id, { verified: on });
  if (onServer()) {
    send("patch", `/staff/${encodeURIComponent(id)}/verify`, { verified: Boolean(on) });
    return true;
  }
  desk("verify", person, on ? `Gave ${person.name} the Verified badge` : `Removed the Verified badge from ${person.name}`);
  return true;
}