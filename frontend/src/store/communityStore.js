import { useSyncExternalStore } from "react";
import { getAllIssues, logEvent, addIssue, nextIssueId } from "./issueStore";
import { isMash, MASH_MESSAGE } from "../utils/textGuard";
import { windowFor } from "./slaPolicyStore";
import { WARDS } from "../constants/issueConstants";
import { SERVER_ON } from "../config/server";
import { api } from "../lib/api";
import { getUser, subscribeRole } from "./authStore";
import { onEvent, EVENTS, STREAM_RESUMED } from "../services/events";
import { serverNotice } from "../services/notice";

/* ------------------------------------------------------------------
   Community: proposals, polls, announcements, work notices and the
   signals citizens send on fixed issues. One store, saved in this
   browser (community-v1) and kept in step across its tabs, the same
   way as the issue board.

   No free text from citizens except a proposal's own title and short
   description. Everything else is a structured signal:
     proposal  "Affects me" / "I'd use this" (one per person),
               a concern with a reason (one per person), a photo
     poll      one vote per person (can be changed while it's open)
     issue     "Fixed now" / "Still happening" on a fixed issue near you
   The only open text after that is official (admin and field crews),
   with a role badge, kept on the record.

   Residents: people whose home zone (their account) is the proposal's
   zone. Everyone else who backs it counts as a supporter.

   Every change is written to the community trail with a structured
   notice (n), and the notifications inbox reads it (notifyStore).

   WITH THE SERVER (signed in through it): the board is GET /community,
   masked per role by the server (no other person's id or name reaches a
   citizen). Every action runs the same checks here, shows at once, is sent
   to its endpoint, and the server's copy replaces the screen's. The server
   writes the trail, the audit rows and the work order a proposal becomes.
   community:changed and a reconnect read the board again.
   WITHOUT A SERVER: an empty board kept in this browser.
   API names follow Person 5's original contract: /community-posts
   (proposals), /voting-slots (polls), /notifications/broadcast
   (announcements). See docs/backend/BACKEND-HANDOVER.md · B3.
------------------------------------------------------------------- */

const KEY = "community-v1";
const H = 36e5;
const D = 24 * H;
const now = () => new Date().toISOString();
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export const PROPOSAL_ANSWER_DAYS = 7; // the city answers every proposal within a week
export const RESIDENT_TARGET = { default: 50 };

export const CONCERNS = ["Safety", "Cost", "Wrong location", "Already exists", "Better alternative"];
export const PROPOSAL_STATUS = {
  review: { label: "Under review", tone: "acc" },
  approved: { label: "Approved", tone: "ok" },
  planned: { label: "Planned", tone: "ok" },
  issue: { label: "Turned into an issue", tone: "ok" },
  poll: { label: "Moved to a poll", tone: "acc" },
  notnow: { label: "Not now", tone: "muted" },
};
export const NOTICE_KINDS = ["Power off", "Road closed", "Water off", "Crew on site", "Noise"];

/* The board starts empty: everything comes from the server (GET /community). */
function freshCommunity() {
  return { proposals: [], polls: [], announcements: [], notices: [], issueSignals: [], checks: [], trail: [], anchor: Date.now() };
}

/* ---------------- load / save / sync ---------------- */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshCommunity();
    const v = JSON.parse(raw);
    if (!Array.isArray(v.proposals) || !Array.isArray(v.polls)) return freshCommunity();
    return { notices: [], issueSignals: [], trail: [], announcements: [], checks: [], ...v };
  } catch {
    return freshCommunity();
  }
}

const onServer = () => SERVER_ON && getUser()?.source === "server";
const EMPTY = { proposals: [], polls: [], announcements: [], notices: [], issueSignals: [], checks: [], trail: [] };

let state = SERVER_ON ? EMPTY : load();
const subs = new Set();
function save() {
  state = { ...state, anchor: Date.now(), trail: state.trail.slice(0, 400) };
  if (!onServer()) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: kept for this tab */ }
  }
  subs.forEach((f) => f());
}

/* ---------------- server ---------------- */
let loading = null;
let again = false;
/** Read the board again from the server (one request at a time). */
export function refreshCommunity() {
  if (!onServer()) return Promise.resolve();
  if (loading) {
    again = true;
    return loading;
  }
  loading = (async () => {
    try {
      const { data } = await api.get("/community");
      state = { ...EMPTY, ...data, anchor: Date.now() };
      subs.forEach((f) => f());
    } catch (err) {
      if (err?.status && err.status !== 401) serverNotice(err.message || "The community board couldn't be loaded.");
    } finally {
      loading = null;
      if (again) {
        again = false;
        refreshCommunity();
      }
    }
  })();
  return loading;
}

/* one change to the server; the screen already shows it. Refused: the message, then the server's copy. */
function send(method, url, body) {
  api[method](url, body)
    .catch((err) => { if (err?.status !== 401) serverNotice(err?.message || "The server didn't accept that change."); })
    .finally(() => refreshCommunity());
}

let who = "";
subscribeRole(() => {
  const me = getUser();
  const next = onServer() ? `${me.serverId}:${me.role}` : me ? "local" : "";
  if (next === who) return;
  who = next;
  if (onServer()) {
    state = EMPTY;
    subs.forEach((f) => f());
    refreshCommunity();
  } else {
    state = SERVER_ON ? EMPTY : load();
    subs.forEach((f) => f());
  }
});
let changedTimer = null;
onEvent(EVENTS.COMMUNITY_CHANGED, () => { clearTimeout(changedTimer); changedTimer = setTimeout(refreshCommunity, 250); });
onEvent(STREAM_RESUMED, () => refreshCommunity());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue || onServer()) return;
    try { state = JSON.parse(e.newValue); subs.forEach((f) => f()); } catch { /* half-written: the next save brings it */ }
  });
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const getCommunity = () => state;
export function useCommunity() {
  return useSyncExternalStore(subscribe, getCommunity, getCommunity);
}

function trail(actor, role, n) {
  state = { ...state, trail: [{ id: uid("ct"), at: now(), actor, role, n }, ...state.trail] };
}
function patchList(list, id, fn) {
  state = { ...state, [list]: state[list].map((x) => (x.id === id ? fn(x) : x)) };
}

/* ---------------- proposals ---------------- */
export const residentsOf = (p) => p.signals.filter((s) => s.resident).length;
export const supportersOf = (p) => p.signals.filter((s) => !s.resident).length;
export const signalOf = (p, userId) => p.signals.find((s) => s.userId === userId)?.kind || null;
export const concernOf = (p, userId) => p.concerns.find((c) => c.userId === userId)?.reason || null;
export const answerDue = (p) => new Date(new Date(p.at).getTime() + PROPOSAL_ANSWER_DAYS * D);
export const visiblePhotos = (p) => p.photos.filter((ph) => !ph.hidden);

function nextId(prefix, list) {
  const nums = list.map((x) => Number(String(x.id).split("-")[1])).filter(Number.isFinite);
  return `${prefix}-${String((nums.length ? Math.max(...nums) : 100) + 1).padStart(4, "0")}`;
}

const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
/* a proposal already open in the same zone that says much the same thing */
export function similarProposal(ward, title) {
  const mine = new Set(words(title));
  if (mine.size < 2) return null;
  let best = null;
  state.proposals.forEach((p) => {
    if (p.ward !== ward || p.status !== "review") return;
    const theirs = words(p.title);
    const same = theirs.filter((w) => mine.has(w)).length;
    const score = same / Math.max(3, Math.min(mine.size, theirs.length));
    if (score >= 0.5 && (!best || score > best.score)) best = { p, score };
  });
  return best?.p || null;
}

/* citizen. Returns { ok, id } or { ok: false, reason } */
export function proposeImprovement(user, { title, summary, category, ward }) {
  const t = String(title || "").trim();
  const s = String(summary || "").trim();
  if (!user || user.role !== "citizen") return { ok: false, reason: "Only citizens can propose improvements." };
  if (t.length < 12) return { ok: false, reason: "Give it a title of at least 12 characters." };
  if (s.length < 20) return { ok: false, reason: "Describe it in at least 20 characters." };
  if (isMash(t, { title: true }) || isMash(s) || s.toLowerCase() === t.toLowerCase()) return { ok: false, reason: "That doesn't read like a proposal. Please write it in plain words." };
  if (state.proposals.some((p) => p.by.id === user.id && p.status === "review" && Date.now() - new Date(p.at).getTime() < D)) {
    return { ok: false, reason: "You can send one proposal a day. Your last one is still under review." };
  }
  const id = nextId("PRP", state.proposals);
  const p = {
    id, title: t.slice(0, 90), summary: s.slice(0, 280), category: category || "other", ward, at: now(), status: "review", target: RESIDENT_TARGET.default,
    by: { id: user.id, name: user.name },
    signals: [{ userId: user.id, name: user.name, kind: "affects", resident: user.ward === ward, at: now() }],
    concerns: [], photos: [], responses: [], decision: null, hidden: [],
  };
  state = { ...state, proposals: [p, ...state.proposals] };
  trail(user.name, "citizen", { type: "proposed", ref: id, ward });
  save();
  if (onServer()) send("post", "/community/proposals", { title: t, summary: s, category: category || "other", ward });
  return { ok: true, id };
}

const MILESTONES = [10, 25, 50, 100];
/* "Affects me" / "I'd use this": one per person; the same again takes it back */
export function signalProposal(id, user, kind) {
  const p = state.proposals.find((x) => x.id === id);
  if (!p || !user || user.role !== "citizen" || p.status !== "review") return false;
  const had = p.signals.find((s) => s.userId === user.id);
  const before = residentsOf(p);
  let signals = p.signals.filter((s) => s.userId !== user.id);
  if (!had || had.kind !== kind) signals = [...signals, { userId: user.id, name: user.name, kind, resident: user.ward === p.ward, at: now() }];
  patchList("proposals", id, (x) => ({ ...x, signals }));
  const after = residentsOf(state.proposals.find((x) => x.id === id));
  const crossed = MILESTONES.find((m) => before < m && after >= m) || (before < p.target && after >= p.target ? p.target : null);
  if (crossed) trail(user.name, "citizen", { type: "backed", ref: id, ward: p.ward, residents: after, target: p.target, reached: after >= p.target });
  save();
  if (onServer()) send("post", `/community/proposals/${encodeURIComponent(id)}/signal`, { kind });
  return true;
}

export function raiseConcern(id, user, reason) {
  const p = state.proposals.find((x) => x.id === id);
  if (!p || !user || user.role !== "citizen" || p.status !== "review") return false;
  if (reason && !CONCERNS.includes(reason)) return false;
  const rest = p.concerns.filter((c) => c.userId !== user.id);
  patchList("proposals", id, (x) => ({ ...x, concerns: reason ? [...rest, { userId: user.id, reason, at: now() }] : rest }));
  save();
  if (onServer()) send("post", `/community/proposals/${encodeURIComponent(id)}/concern`, { reason: reason || null });
  return true;
}

/* one photo per person per proposal (a new one replaces theirs) */
export function addProposalPhoto(id, user, photo) {
  const p = state.proposals.find((x) => x.id === id);
  if (!p || !user || !photo?.url) return false;
  const rest = p.photos.filter((ph) => ph.userId !== user.id);
  if (rest.length >= 12) return false;
  patchList("proposals", id, (x) => ({ ...x, photos: [...rest, { id: photo.id, url: photo.url, userId: user.id, at: now(), hidden: false }] }));
  save();
  if (onServer()) send("post", `/community/proposals/${encodeURIComponent(id)}/photo`, { url: photo.url });
  return true;
}

/* admin / field crew: an official response on the record */
export function respondToProposal(id, user, body) {
  const text = String(body || "").trim();
  const p = state.proposals.find((x) => x.id === id);
  if (!p || !user || (user.role !== "admin" && user.role !== "staff") || text.length < 6 || isMash(text)) return false;
  patchList("proposals", id, (x) => ({ ...x, responses: [...x.responses, { id: uid("rsp"), by: user.name, role: user.role, body: text.slice(0, 400), at: now() }] }));
  trail(user.name, user.role, { type: "responded", ref: id, ward: p.ward });
  save();
  if (onServer()) send("post", `/community/proposals/${encodeURIComponent(id)}/responses`, { body: text });
  return true;
}

/* ---------------- polls ---------------- */
export const pollTotals = (poll) => {
  const counts = Object.fromEntries(poll.options.map((o) => [o.id, o.base || 0]));
  Object.values(poll.votes || {}).forEach((v) => { if (counts[v] !== undefined) counts[v] += 1; });
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return { counts, total };
};
export const pollOpen = (poll) => poll.status === "open" && new Date(poll.closesAt).getTime() > Date.now();

/* one vote per person; it can be changed while the poll is open */
export function votePoll(id, user, optionId) {
  const poll = state.polls.find((x) => x.id === id);
  if (!poll || !user || user.role !== "citizen" || !pollOpen(poll)) return false;
  if (!poll.options.some((o) => o.id === optionId)) return false;
  patchList("polls", id, (x) => ({ ...x, votes: { ...x.votes, [user.id]: optionId } }));
  save();
  if (onServer()) send("post", `/community/polls/${encodeURIComponent(id)}/vote`, { optionId });
  return true;
}

/* ---------------- fixed issues near you ---------------- */
export const issueSignalOf = (issueId, userId) => state.issueSignals.find((s) => s.issueId === issueId && s.userId === userId)?.kind || null;
export const issueSignalCount = (issueId, kind) => state.issueSignals.filter((s) => s.issueId === issueId && s.kind === kind).length;

/* "Fixed now" / "Still happening" on a fixed issue: one per person, the same again takes it back.
   "Still happening" is logged for command and the crew (it may need to reopen). */
export function signalIssue(issueId, user, kind) {
  if (!user || user.role !== "citizen" || !["fixed", "still"].includes(kind)) return false;
  const issue = getAllIssues().find((i) => i.id === issueId);
  if (!issue || issue.status !== "resolved") return false;
  const had = issueSignalOf(issueId, user.id);
  const rest = state.issueSignals.filter((s) => !(s.issueId === issueId && s.userId === user.id));
  state = { ...state, issueSignals: had === kind ? rest : [...rest, { issueId, userId: user.id, kind, at: now() }] };
  if (had !== kind && kind === "still") {
    trail(user.name, "citizen", { type: "still", issueId, ward: issue.ward, owner: issue.assignedTo || null });
    if (!onServer()) logEvent({ actor: user.name, role: "citizen", action: `Reported ${issueId} still happening after the fix`, issueId, kind: "filed" });
  }
  save();
  if (onServer()) send("post", `/community/issues/${encodeURIComponent(issueId)}/signal`, { kind });
  return true;
}

/* ---------------- the board for one zone ---------------- */
export function announcementLive(a) {
  return !a.hidden && (!a.until || new Date(a.until).getTime() > Date.now());
}
export const reachesZone = (a, ward) => a.zones.includes("all") || a.zones.includes(ward);
export function noticeLive(n, issues) {
  const issue = issues.find((i) => i.id === n.issueId);
  return !n.hidden && issue && issue.status !== "resolved" && !issue.removed && new Date(n.to).getTime() > Date.now();
}

/* ==================================================================
   Command (admin). Every action is on the record: the community trail
   (notifications) and the command audit log (kind "community").
================================================================== */
export const MODERATION_REASONS = ["Personal information", "Offensive", "Off-topic", "Not a city matter", "Duplicate"];
export const POLL_HOURS = [24, 48, 72, 168];
const isAdmin = (u) => u?.role === "admin";
// the server writes command's audit rows itself; this is the no-server desk
const audit = (by, action) => { if (!onServer()) logEvent({ actor: by, role: "admin", action, kind: "community" }); };

/* the proposal becomes a work order on the issue board, filed for its author */
function issueFromProposal(p, priority, by) {
  const w = WARDS.find((x) => x.name === p.ward) || WARDS[0];
  const id = nextIssueId();
  const at = now();
  const category = p.category === "other" ? "other" : p.category;
  addIssue({
    id, title: p.title, description: `${p.summary}\n\nFrom community proposal ${p.id} (${residentsOf(p)} residents backed it).`,
    category, location: `${p.ward} · community proposal`, ward: p.ward, lat: w.lat, lng: w.lng, photos: [],
    reportedBy: p.by.name, reporterId: p.by.id, status: "submitted", priority, danger: false,
    assignedTo: null, assignedAt: null, comments: [], timeline: [{ status: "submitted", at, by, note: `From community proposal ${p.id}` }],
    createdAt: at, updatedAt: at, savedBy: [], supporters: [], slaHours: windowFor(priority, category), fromProposal: p.id,
  });
  return id;
}

/* status: approved | planned | notnow | issue | poll
   extra: { priority } for issue, { options, hours, question } for poll */
export function decideProposal(id, user, status, reason, extra = {}) {
  const p = state.proposals.find((x) => x.id === id);
  const why = String(reason || "").trim();
  if (!p || !isAdmin(user) || p.status !== "review" || !PROPOSAL_STATUS[status] || status === "review") return { ok: false, reason: "This proposal can't be decided." };
  if (why.length < 6) return { ok: false, reason: "Give the reason people will read (6 characters or more)." };
  if (isMash(why)) return { ok: false, reason: MASH_MESSAGE };
  const decision = { status, reason: why.slice(0, 240), by: user.name, at: now() };
  if (onServer()) {
    if (status === "poll") {
      const opts = (extra.options || []).map((o) => String(o || "").trim()).filter(Boolean);
      if (opts.length < 2 || opts.length > 4) return { ok: false, reason: "Give 2 to 4 options." };
    }
    // the server files the work order or opens the poll, and writes the trail and audit
    patchList("proposals", id, (x) => ({ ...x, status, decision }));
    save();
    send("patch", `/community/proposals/${encodeURIComponent(id)}/decision`, { status, reason: why, priority: extra.priority, question: extra.question, options: extra.options, hours: extra.hours });
    return { ok: true, ...decision };
  }
  if (status === "issue") decision.issueId = issueFromProposal(p, extra.priority || "medium", user.name);
  if (status === "poll") {
    const res = openPoll(user, { question: extra.question || p.title, ward: p.ward, options: extra.options, hours: extra.hours, from: { type: "proposal", id: p.id } }, { silent: true });
    if (!res.ok) return res;
    decision.pollId = res.id;
  }
  patchList("proposals", id, (x) => ({ ...x, status, decision }));
  trail(user.name, "admin", { type: "decided", ref: id, status, ward: p.ward });
  audit(user.name, `Decided ${id}: ${PROPOSAL_STATUS[status].label}${decision.issueId ? ` → ${decision.issueId}` : ""}${decision.pollId ? ` → ${decision.pollId}` : ""} · ${why}`);
  save();
  return { ok: true, ...decision };
}

export function openPoll(user, { question, ward, options, hours = 48, from = null }, { silent = false } = {}) {
  const q = String(question || "").trim();
  const opts = (options || []).map((o) => String(o || "").trim()).filter(Boolean);
  if (!isAdmin(user)) return { ok: false, reason: "Only command opens polls." };
  if (q.length < 8) return { ok: false, reason: "Write the question (8 characters or more)." };
  if (isMash(q, { title: true }) || opts.some((o) => isMash(o, { title: true }))) return { ok: false, reason: MASH_MESSAGE };
  if (opts.length < 2 || opts.length > 4) return { ok: false, reason: "Give 2 to 4 options." };
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return { ok: false, reason: "Each option must be different." };
  const id = nextId("POL", state.polls);
  const poll = {
    id, question: q.slice(0, 120), ward: ward || "all", from,
    options: opts.map((label, k) => ({ id: String.fromCharCode(97 + k), label: label.slice(0, 60), base: 0 })),
    votes: {}, opensAt: now(), closesAt: new Date(Date.now() + Number(hours || 48) * H).toISOString(), status: "open", outcome: null, by: user.name,
  };
  state = { ...state, polls: [poll, ...state.polls] };
  trail(user.name, "admin", { type: "poll-opened", ref: id, ward: poll.ward });
  audit(user.name, `Opened poll ${id} · ${poll.ward === "all" ? "every zone" : poll.ward} · ${q}${from ? ` (from ${from.id})` : ""}`);
  if (!silent) save();
  if (onServer() && !silent) send("post", "/community/polls", { question: q, ward: poll.ward, options: opts, hours: Number(hours || 48), from });
  return { ok: true, id };
}

/* close with the outcome people will read (the winning option is suggested, command can pick another) */
export function closePoll(id, user, optionId, note) {
  const poll = state.polls.find((x) => x.id === id);
  const why = String(note || "").trim();
  if (!poll || !isAdmin(user) || poll.status === "closed") return { ok: false, reason: "This poll is already closed." };
  if (!poll.options.some((o) => o.id === optionId)) return { ok: false, reason: "Pick the outcome." };
  if (why.length < 6) return { ok: false, reason: "Say what happens next (6 characters or more)." };
  if (isMash(why)) return { ok: false, reason: MASH_MESSAGE };
  const outcome = { optionId, note: why.slice(0, 200), by: user.name, at: now() };
  patchList("polls", id, (x) => ({ ...x, status: "closed", closesAt: new Date(Math.min(Date.now(), new Date(x.closesAt).getTime())).toISOString(), outcome }));
  trail(user.name, "admin", { type: "poll-closed", ref: id, ward: poll.ward });
  audit(user.name, `Closed poll ${id} · ${poll.options.find((o) => o.id === optionId).label} · ${why}`);
  save();
  if (onServer()) send("patch", `/community/polls/${encodeURIComponent(id)}/close`, { optionId, note: why });
  return { ok: true };
}

export function publishAnnouncement(user, { title, body, zones, citizens = true, staff = true, hours = 72 }) {
  const t = String(title || "").trim();
  if (!isAdmin(user)) return { ok: false, reason: "Only command publishes announcements." };
  if (t.length < 8) return { ok: false, reason: "Write a title (8 characters or more)." };
  if (isMash(t, { title: true }) || isMash(body)) return { ok: false, reason: MASH_MESSAGE };
  if (!zones?.length) return { ok: false, reason: "Pick at least one zone." };
  if (!citizens && !staff) return { ok: false, reason: "Pick who it reaches." };
  const id = nextId("ANN", state.announcements);
  const a = { id, title: t.slice(0, 110), body: String(body || "").trim().slice(0, 300), zones, audience: { citizens, staff }, by: user.name, at: now(), until: new Date(Date.now() + Number(hours) * H).toISOString(), hidden: false };
  state = { ...state, announcements: [a, ...state.announcements] };
  trail(user.name, "admin", { type: "announced", ref: id, zones, citizens, staff });
  audit(user.name, `Published ${id} · ${zones.includes("all") ? "every zone" : zones.join(", ")} · ${t}`);
  save();
  if (onServer()) send("post", "/community/announcements", { title: t, body: String(body || "").trim(), zones, citizens, staff, hours: Number(hours) });
  return { ok: true, id };
}

/* moderation: hide (never delete) with a reason, on the record.
   what: { type: "photo", proposalId, photoId } | { type: "announcement" | "notice", id } */
export function moderate(user, what, reason) {
  if (!isAdmin(user) || !MODERATION_REASONS.includes(reason)) return false;
  const stamp = { by: user.name, at: now(), reason };
  let label = "";
  if (what.type === "photo") {
    const p = state.proposals.find((x) => x.id === what.proposalId);
    if (!p) return false;
    patchList("proposals", p.id, (x) => ({ ...x, photos: x.photos.map((ph) => (ph.id === what.photoId ? { ...ph, hidden: stamp } : ph)) }));
    label = `a photo on ${p.id}`;
  } else if (what.type === "announcement" || what.type === "notice") {
    const list = what.type === "announcement" ? "announcements" : "notices";
    if (!state[list].some((x) => x.id === what.id)) return false;
    patchList(list, what.id, (x) => ({ ...x, hidden: stamp }));
    label = what.id;
  } else return false;
  trail(user.name, "admin", { type: "moderated", what, reason, label });
  audit(user.name, `Hid ${label} · ${reason}`);
  save();
  if (onServer()) send("post", "/community/moderate", { what, reason });
  return true;
}

export const pollEnded = (poll) => poll.status === "open" && new Date(poll.closesAt).getTime() <= Date.now();

/* ==================================================================
   Field crews (staff)
================================================================== */
const isStaff = (u) => u?.role === "staff";

/* a structured work notice on one of your own open files, for that zone */
export function postWorkNotice(user, { issueId, kind, from, to, note }) {
  const issue = getAllIssues().find((i) => i.id === issueId);
  const text = String(note || "").trim();
  if (!isStaff(user)) return { ok: false, reason: "Only field crews post work notices." };
  if (!issue || issue.assignedTo !== user.name || issue.status === "resolved" || issue.removed) return { ok: false, reason: "Pick one of your own open files." };
  if (!NOTICE_KINDS.includes(kind)) return { ok: false, reason: "Pick what's happening." };
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return { ok: false, reason: "The window must end after it starts." };
  if (b - a > 3 * D) return { ok: false, reason: "Keep a notice to three days or less; post another for longer works." };
  if (b < Date.now()) return { ok: false, reason: "That window is already over." };
  if (text && isMash(text)) return { ok: false, reason: MASH_MESSAGE };
  const id = nextId("WN", state.notices);
  const n = { id, issueId, ward: issue.ward, kind, from: new Date(a).toISOString(), to: new Date(b).toISOString(), note: text.slice(0, 140), by: user.name, at: now(), hidden: false };
  state = { ...state, notices: [n, ...state.notices] };
  trail(user.name, "staff", { type: "notice", ref: id, ward: issue.ward, issueId });
  if (onServer()) send("post", "/community/notices", { issueId, kind, from: n.from, to: n.to, note: n.note });
  else logEvent({ actor: user.name, role: "staff", action: `Posted work notice ${id} on ${issueId} · ${kind}`, issueId, kind: "community" });
  save();
  return { ok: true, id };
}

/* the crew ends its own notice early (work finished sooner) */
export function endWorkNotice(user, id) {
  const n = state.notices.find((x) => x.id === id);
  if (!n || !isStaff(user) || (n.by !== user.name && n.byId !== user.id)) return false;
  patchList("notices", id, (x) => ({ ...x, to: now() }));
  save();
  if (onServer()) send("patch", `/community/notices/${encodeURIComponent(id)}/end`, {});
  return true;
}

/* "Still happening" on a closed file: the crew checks and answers.
   verdict: "fixed" (checked, it's fixed: the note goes to the people who said otherwise)
          | "revisit" (needs another visit: command decides the next step) */
export const stillCount = (issueId) => state.issueSignals.filter((s) => s.issueId === issueId && s.kind === "still").length;
export const checkOf = (issueId) => [...(state.checks || [])].reverse().find((c) => c.issueId === issueId) || null;
export function answerStill(user, issueId, verdict, note) {
  const issue = getAllIssues().find((i) => i.id === issueId);
  const text = String(note || "").trim();
  if (!isStaff(user) || !issue || issue.assignedTo !== user.name || !["fixed", "revisit"].includes(verdict)) return { ok: false, reason: "Only the crew on this file can answer." };
  if (text.length < 6) return { ok: false, reason: "Say what you found (6 characters or more)." };
  if (isMash(text)) return { ok: false, reason: MASH_MESSAGE };
  const check = { id: uid("chk"), issueId, verdict, note: text.slice(0, 200), by: user.name, at: now() };
  state = { ...state, checks: [...(state.checks || []), check] };
  trail(user.name, "staff", { type: verdict === "fixed" ? "checked" : "revisit", issueId, ward: issue.ward, ref: check.id });
  if (onServer()) send("post", `/community/issues/${encodeURIComponent(issueId)}/check`, { verdict, note: text });
  else logEvent({ actor: user.name, role: "staff", action: verdict === "fixed" ? `Checked ${issueId} after "still happening": fixed · ${text}` : `Asked to revisit ${issueId} · ${text}`, issueId, kind: "community" });
  save();
  return { ok: true };
}
