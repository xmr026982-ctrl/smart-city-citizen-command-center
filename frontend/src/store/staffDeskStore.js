import { useSyncExternalStore } from "react";
import { isExpertiseId, expertiseLabel } from "../config/expertise";
import { logEvent, releaseIssuesOf, getIssues } from "./issueStore";
import { getUser } from "./authStore";

/* ------------------------------------------------------------------
   Staff Desk roster + clearance queue.
   Load and closed counts are NOT stored here: they come live from the
   issue board (see store/fieldRoster.js). "closedPrior" is the history
   a person brought from before this board existed.
   Every admin action here is written to the command audit trail, with
   a snapshot of the person (subject) so the Audit Log can open their
   file, even after they leave the system.
------------------------------------------------------------------- */

const actor = () => getUser()?.name || "Priti Sarkar";

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

const ago = (hours) => new Date(Date.now() - hours * 36e5).toISOString();

// helper for seeded people who joined long ago
const joined = (requested, accepted, uplinked) => ({
  uplink: "live",
  dispatch: "sent",
  requestedAt: requested,
  acceptedAt: accepted,
  keySentAt: accepted,
  uplinkedAt: uplinked,
});

const SEED_ROSTER = [
  { id: "stf-koushik", name: "Koushik Bhowmik", email: "", rank: "Field Operative", expertise: "electrical", experience: "2 Years", verified: true, zone: "Shyambazar", onDuty: true, closedPrior: 11, ...joined("2026-06-02T09:00:00.000Z", "2026-06-03T10:20:00.000Z", "2026-06-03T18:05:00.000Z") },
  { id: "stf-subhomoy", name: "Subhomoy Ghosh", email: "", rank: "Field Operative", expertise: "roads", experience: "Field Active", verified: true, zone: "B.B.D. Bagh", onDuty: true, closedPrior: 8, ...joined("2026-06-10T08:30:00.000Z", "2026-06-11T07:10:00.000Z", "2026-06-11T12:40:00.000Z") },
  { id: "stf-arnab", name: "Arnab Saha", email: "arnab.saha@example.com", rank: "Field Operative", expertise: "waste", experience: "Field Active", verified: false, zone: "Ballygunge", onDuty: true, closedPrior: 6, ...joined("2026-07-01T06:00:00.000Z", "2026-07-02T09:00:00.000Z", "2026-07-02T15:30:00.000Z") },
  { id: "stf-sourav", name: "Sourav Kundu", email: "sourav.kundu@example.com", rank: "Specialist", expertise: "electrical", experience: "5 Years", verified: true, zone: "College Street", onDuty: false, closedPrior: 14, ...joined("2026-05-14T10:00:00.000Z", "2026-05-15T08:00:00.000Z", "2026-05-15T11:45:00.000Z") },
  { id: "stf-debasish", name: "Debasish Roy", email: "debasish.roy@example.com", rank: "Field Operative", expertise: "water", experience: "2 Years", verified: false, zone: "Dharmatala", onDuty: true, closedPrior: 7, ...joined("2026-07-20T07:30:00.000Z", "2026-07-21T09:15:00.000Z", "2026-07-22T06:50:00.000Z") },
  { id: "stf-rupa", name: "Rupa Chatterjee", email: "rupa.chatterjee@example.com", rank: "Zone Lead", expertise: "civic", experience: "10 Years", verified: true, zone: "B.P. Township", onDuty: true, closedPrior: 23, ...joined("2026-03-04T09:00:00.000Z", "2026-03-04T13:00:00.000Z", "2026-03-04T16:20:00.000Z") },
  { id: "stf-arjun", name: "Arjun Dutta", email: "arjun.dutta@example.com", rank: "Senior Specialist", expertise: "roads", experience: "Senior Field", verified: true, zone: "Shyambazar", onDuty: true, closedPrior: 19, ...joined("2026-04-11T08:00:00.000Z", "2026-04-12T07:30:00.000Z", "2026-04-12T09:10:00.000Z") },
  { id: "stf-moumita", name: "Moumita Pal", email: "moumita.pal@example.com", rank: "Specialist", expertise: "water", experience: "5 Years", verified: true, zone: "Ballygunge", onDuty: false, closedPrior: 12, ...joined("2026-05-28T11:00:00.000Z", "2026-05-29T10:00:00.000Z", "2026-05-29T14:30:00.000Z") },
  { id: "stf-ritam", name: "Ritam Sen", email: "ritam.sen@example.com", rank: "Field Operative", expertise: "waste", experience: "Field Active", verified: false, zone: "College Street", onDuty: true, closedPrior: 0, ...joined(ago(80), ago(30), ago(3)) },
  { id: "stf-tanmoy", name: "Tanmoy Ghoshal", email: "tanmoy.ghoshal@example.com", rank: "Command Fellow", expertise: "electrical", experience: "Senior Field", verified: true, zone: "Dharmatala", onDuty: true, closedPrior: 31, ...joined("2026-01-08T09:00:00.000Z", "2026-01-08T12:00:00.000Z", "2026-01-08T13:10:00.000Z") },
  { id: "stf-priyanka", name: "Priyanka Das", email: "priyanka.das@example.com", rank: "Field Operative", expertise: "civic", experience: "Field Active", verified: false, zone: "B.B.D. Bagh", onDuty: false, closedPrior: 0, uplink: "awaiting", dispatch: "sent", requestedAt: ago(70), acceptedAt: ago(26), keySentAt: ago(26), uplinkedAt: null },
  { id: "stf-nilanjan", name: "Nilanjan Bose", email: "nilanjan.bose@example.com", rank: "Specialist", expertise: "roads", experience: "5 Years", verified: true, zone: "B.P. Township", onDuty: true, closedPrior: 9, ...joined("2026-06-18T09:40:00.000Z", "2026-06-19T08:00:00.000Z", "2026-06-19T10:25:00.000Z") },
  { id: "stf-sreya", name: "Sreya Mondal", email: "sreya.mondal@example.com", rank: "Field Operative", expertise: "electrical", experience: "2 Years", verified: false, zone: "Ballygunge", onDuty: false, closedPrior: 0, uplink: "awaiting", dispatch: "sent", requestedAt: ago(150), acceptedAt: ago(100), keySentAt: ago(100), uplinkedAt: null },
];

const SEED_REQUESTS = [
  { id: "req-anika", name: "Anika Roy", email: "anika.roy@example.com", zone: "Ballygunge", expertise: "waste", experience: "2 Years", note: "Requests field clearance for waste and street cleaning.", filedAt: "2026-10-21T09:12:00.000Z" },
  { id: "req-dev", name: "Dev Banerjee", email: "dev.banerjee@example.com", zone: "College Street", expertise: "electrical", experience: "Field Active", note: "Requests clearance for power and street-light files.", filedAt: "2026-10-22T06:40:00.000Z" },
  { id: "req-ishita", name: "Ishita Saha", email: "ishita.saha@example.com", zone: "Dharmatala", expertise: "water", experience: "5 Years", note: "Drainage crew lead. Requests clearance for monsoon water files.", filedAt: "2026-10-18T11:05:00.000Z" },
  { id: "req-kunal", name: "Kunal Mitra", email: "kunal.mitra@example.com", zone: "Shyambazar", expertise: "roads", experience: "10 Years", note: "Senior road works. Requests clearance for pothole and footpath repair.", filedAt: "2026-10-23T15:30:00.000Z" },
  { id: "req-pallabi", name: "Pallabi Ghosh", email: "pallabi.ghosh@example.com", zone: "B.P. Township", expertise: "civic", experience: "Field Active", note: "", filedAt: "2026-10-24T08:20:00.000Z" },
  { id: "req-soumik", name: "Soumik Halder", email: "soumik.halder@example.com", zone: "B.B.D. Bagh", expertise: "electrical", experience: "Senior Field", note: "Licensed electrician. Requests clearance for substation and power files.", filedAt: "2026-10-16T07:45:00.000Z" },
  { id: "req-ananya", name: "Ananya Kar", email: "ananya.kar@example.com", zone: "Ballygunge", expertise: "waste", experience: "Field Active", note: "Requests clearance for market-area sanitation rounds.", filedAt: "2026-10-20T13:10:00.000Z" },
  { id: "req-rahul", name: "Rahul Paul", email: "rahul.paul@example.com", zone: "College Street", expertise: "water", experience: "2 Years", note: "Requests clearance for pipeline leak response.", filedAt: "2026-10-24T17:55:00.000Z" },
];

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

let state = load();
const listeners = new Set();

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export { subscribe as subscribeDesk };

// another tab changed the roster (a crew went off duty, command cleared someone): follow it
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
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
  desk("cleared", person, `Cleared ${person.name} as ${person.rank} · ${expertiseLabel(person.expertise)} · ${person.zone}`);
  return person;
}

export function setDispatch(id, dispatch) {
  const fields = { dispatch };
  if (dispatch === "sent") fields.keySentAt = new Date().toISOString();
  patch(id, fields);
  const person = state.roster.find((p) => p.id === id);
  if (person && dispatch === "failed") desk("key", person, `Activation key for ${person.name} was not sent`, { actor: "System" });
}

// First successful sign-in. Matched by email (the backend knows the email).
export function markUplinked(emailOrId, at = new Date().toISOString()) {
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
  if (req) desk("rejected", { ...req, rank: "" }, `Rejected clearance for ${req.name} · ${expertiseLabel(req.expertise)} · ${req.zone}`, { extra: { filedAt: req.filedAt, note: req.note || "" } });
}

/* Remove from the system. Their open issues go back to dispatch.
   Returns how many issues were released. */
export function removeStaff(id) {
  const person = state.roster.find((p) => p.id === id);
  state = { ...state, roster: state.roster.filter((p) => p.id !== id) };
  emit();
  if (!person) return 0;
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
  desk("verify", person, on ? `Gave ${person.name} the Verified badge` : `Removed the Verified badge from ${person.name}`);
  return true;
}