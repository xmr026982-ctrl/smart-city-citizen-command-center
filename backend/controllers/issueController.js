/* ------------------------------------------------------------------
   Issues (contract A7). Every change: checks who may do it, saves,
   writes one audit row (A8), emits its live events (A5) and answers
   { issue, related? } in the caller's own view.

   Privacy lives in one place, viewOf():
   - admin: everything.
   - staff on the file (assigned): everything.
   - other staff: the work itself, without citizens' names, internal
     notes, timeline notes, return reasons or other people's requests.
   - citizens: the public form. Staff are "Field crew", command is
     "City Command"; no internal notes, timeline notes, crew names,
     return reasons or account ids; "pending confirmation" shows as
     In Progress; someone else's report carries no reporter.
   Live events follow the same rule: full detail goes only to command
   and the crew on the file; citizens get "read it again" pings for
   changes they can see, never the pending state or any reason.
------------------------------------------------------------------- */
const crypto = require("crypto");
const mongoose = require("mongoose");

const Issue = require("../models/Issue");
const User = require("../models/User");
const Policy = require("../models/Policy");
const { nextIssueId } = require("../models/Counter");
const { textProblem } = require("../utils/textGuard");
const { writeAudit, actorFrom } = require("../services/audit");
const live = require("../services/live");

const WARDS = ["Shyambazar", "B.B.D. Bagh", "Ballygunge", "College Street", "B.P. Township", "Dharmatala"];
const CATEGORIES = ["roads", "lighting", "water", "waste", "electricity", "safety", "other"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const STATUS_LABEL = { submitted: "New", acknowledged: "Acknowledged", in_progress: "In Progress", pending_review: "Pending Confirmation", resolved: "Resolved" };
const WITHDRAW_REASONS = ["Submitted by mistake", "Duplicate report", "Already fixed", "Wrong location"];
const DISMISS_REASONS = ["Spam or test", "Duplicate report", "Not a city issue", "Location not found"];
const FLAG_REASONS = ["Duplicate report", "Not a city issue", "Location not found", "Already fixed"];
const FLAG_ON_SITE = ["Not a city issue", "Location not found", "Already fixed"];
const REQUEST_LABEL = { withdraw: "withdrawal", dispute: "dispute", flag: "invalid flag" };
const FIELD_CREW = "Field crew";
const CITY_COMMAND = "City Command";
const DUP_M = 200;
const DUP_DAYS = 7;
const UNDO_MS = 2 * 60 * 1000; // command's Undo shows for a few seconds; the server allows up to 2 minutes

const sid = (v) => (v === null || v === undefined ? "" : String(v._id || v));
const clean = (v) => String(v || "").trim().replace(/\s+/g, " ");
const publicStatus = (s) => (s === "pending_review" ? "in_progress" : s);
const masked = (role) => (role === "staff" ? FIELD_CREW : role === "admin" ? CITY_COMMAND : "");
const displayOf = (u) => String(u?.displayName || u?.name || "").trim();

function fail(res, status, message) {
  res.status(status).json({ message });
  return null;
}

/* ============================ people ============================ */

/* Current names for every account an issue mentions, in one query. */
function idsIn(issue) {
  const out = new Set([sid(issue.reportedBy), sid(issue.assignedTo)]);
  (issue.timeline || []).forEach((s) => out.add(s.byId));
  (issue.comments || []).forEach((c) => out.add(c.authorId));
  (issue.supporters || []).forEach((s) => out.add(sid(s.id)));
  (issue.requests || []).forEach((r) => { out.add(r.byId); out.add(r.decided?.byId); });
  [issue.removed, issue.restored, issue.lastReturn].forEach((x) => out.add(x?.byId));
  out.delete("");
  out.delete(undefined);
  out.delete(null);
  return [...out].filter((id) => mongoose.isValidObjectId(id));
}

async function peopleFor(issues) {
  const ids = new Set();
  issues.forEach((i) => idsIn(i).forEach((id) => ids.add(id)));
  if (!ids.size) return new Map();
  const users = await User.find({ _id: { $in: [...ids] } }).select("name displayName role").lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

/* ============================ the view ============================ */

function viewOf(doc, viewer, people) {
  const i = doc.toObject ? doc.toObject() : doc;
  const me = String(viewer._id);
  const role = viewer.role;
  const reporterId = sid(i.reportedBy);
  const ownerId = sid(i.assignedTo);
  const owner = people.get(ownerId);
  const reporter = people.get(reporterId);
  const admin = role === "admin";
  const onFile = role === "staff" && ownerId === me;
  const full = admin || onFile; // everything in the file
  const staff = role === "staff";
  const citizen = role === "citizen";
  const own = citizen && reporterId === me;

  // a person's current name for command and crews, the public mask for citizens
  const nameFor = (id, snapshot, personRole) => {
    const p = people.get(id);
    const r = p?.role || personRole;
    if (citizen) {
      if (r === "staff" || r === "admin") return masked(r);
      return id && id === me ? displayOf(p) || snapshot || "" : "";
    }
    return displayOf(p) || snapshot || "";
  };
  // timeline steps saved before roles were recorded: the reporter's own step is the first
  const stepRole = (s, idx) => s.role || people.get(s.byId)?.role || (idx === 0 && s.status === "submitted" ? "citizen" : s.status === "in_progress" || s.status === "pending_review" ? "staff" : "admin");

  const out = {
    id: i.publicId,
    title: i.title,
    description: i.description,
    category: i.category,
    location: i.locationText,
    ward: i.ward,
    lat: i.lat,
    lng: i.lng,
    photos: (i.photos || []).map((p) => ({ id: p.id, name: p.name, url: p.url, w: p.w ?? null, h: p.h ?? null, kb: p.kb ?? null })),
    danger: Boolean(i.danger),
    priority: i.priority,
    slaHours: i.slaHours,
    status: citizen ? publicStatus(i.status) : i.status,
    reporterId: full || own ? reporterId : null,
    reportedBy: full || own ? displayOf(reporter) || "Citizen" : "",
    // the account name: the screens match it against the signed-in person's name
    assignedTo: ownerId ? (citizen ? FIELD_CREW : owner?.name || "") : null,
    assignedAt: i.assignedAt || null,
    timeline: (i.timeline || [])
      .map((s, idx) => ({ s, r: stepRole(s, idx) }))
      .filter(({ s }) => !(citizen && s.status === "pending_review"))
      .map(({ s, r }) => {
        const step = { status: s.status, at: s.at, by: nameFor(s.byId, s.by, r), role: r };
        if (full && s.note) step.note = s.note; // notes carry reasons and names: only on the file
        return step;
      }),
    comments: (i.comments || [])
      .filter((c) => full || !c.internal)
      .map((c) => ({
        id: c.id,
        author: nameFor(c.authorId, c.author, c.role),
        role: c.role,
        body: c.body,
        createdAt: c.createdAt,
        internal: Boolean(c.internal),
      })),
    savedBy: full ? (i.savedBy || []).map(String) : (i.savedBy || []).some((x) => String(x) === me) ? [me] : [],
    supporters: (i.supporters || []).map((s) => {
      const id = sid(s.id);
      if (full || id === me) return { id, name: nameFor(id, s.name, "citizen"), at: s.at };
      return { id: "", name: "", at: s.at }; // the count stays (people affected); who stays private
    }),
    requests: (i.requests || [])
      .filter((r) => admin || r.byId === me)
      .map((r) => ({
        id: r.id,
        type: r.type,
        by: nameFor(r.byId, r.by, r.role),
        byId: r.byId,
        role: r.role,
        reason: r.reason,
        note: r.note || "",
        ...(r.linkedTo ? { linkedTo: r.linkedTo } : {}),
        at: r.at,
        seenAt: r.seenAt || null,
        decided: r.decided
          ? { verdict: r.decided.verdict, reason: r.decided.reason || "", by: nameFor(r.decided.byId, r.decided.by, "admin"), at: r.decided.at }
          : null,
      })),
    removed: null,
    restored: null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    ...(i.fromProposal ? { fromProposal: i.fromProposal } : {}),
  };

  if (full) {
    out.assignedToId = ownerId || null;
    out.returned = i.returned || 0;
    out.lastReturn = i.lastReturn?.reason
      ? { reason: i.lastReturn.reason, by: nameFor(i.lastReturn.byId, i.lastReturn.by, "admin"), at: i.lastReturn.at }
      : null;
  } else if (staff) {
    out.assignedToId = ownerId || null;
  }

  if (i.removed) {
    const r = i.removed;
    const base = { kind: r.kind, reason: r.reason, by: nameFor(r.byId, r.by, r.role), role: r.role, at: r.at };
    if (r.linkedTo) base.linkedTo = r.linkedTo;
    if (r.merged) base.merged = true;
    if (citizen) {
      // a dismissal's note is written for the reporter; a withdrawal note is their own
      if (r.note) base.note = r.note;
      if (r.requestedBy) base.requestedBy = nameFor(r.requestedById, r.requestedBy, "citizen") || "you";
    } else {
      base.note = r.note || "";
      if (r.requestedBy) base.requestedBy = nameFor(r.requestedById, r.requestedBy, "citizen");
      if (full) base.addedTo = (r.addedTo || []).map(String);
    }
    out.removed = base;
  }
  if (i.restored) {
    const r = i.restored;
    out.restored = citizen
      ? { by: CITY_COMMAND, at: r.at }
      : { by: nameFor(r.byId, r.by, "admin"), at: r.at, note: r.note || "", ...(full && r.from ? { from: { kind: r.from.kind, reason: r.from.reason, at: r.from.at, ...(r.from.linkedTo ? { linkedTo: r.from.linkedTo } : {}), ...(r.from.merged ? { merged: true } : {}) } } : {}) };
  }
  return out;
}

/* ============================ helpers ============================ */

function canSee(issue, user) {
  if (user.role === "admin") return true;
  const me = String(user._id);
  if (user.role === "staff") return !issue.removed || sid(issue.assignedTo) === me;
  return !issue.removed || sid(issue.reportedBy) === me;
}

async function load(req, res, extra = "") {
  const issue = await Issue.findOne({ publicId: String(req.params.id || "") }).select(extra);
  if (!issue || !canSee(issue, req.user)) return fail(res, 404, "That issue wasn't found.");
  return issue;
}

async function answer(res, user, issue, status = 200, related = []) {
  const all = [issue, ...related];
  const people = await peopleFor(all);
  const body = { issue: viewOf(issue, user, people) };
  if (related.length) body.related = related.map((r) => viewOf(r, user, people));
  return res.status(status).json(body);
}

const me = (req) => ({ id: String(req.user._id), role: req.user.role, name: displayOf(req.user), account: req.user.name });

function step(req, status, note) {
  const who = me(req);
  return { status, at: new Date(), by: who.name, byId: who.id, role: who.role, ...(note ? { note } : {}) };
}

async function audit(req, kind, action, issueId, n) {
  await writeAudit({ ...actorFrom(req), kind, action, issueId, n });
}

async function windowFor(priority, category) {
  const policy = await Policy.findOne().sort({ version: -1 }).lean();
  const table = policy?.priority || { critical: 12, high: 24, medium: 48, low: 120 };
  const ceilings = policy?.ceilings instanceof Map ? Object.fromEntries(policy.ceilings) : policy?.ceilings || { safety: 12, electricity: 12 };
  const hours = Number(table[priority]) || 48;
  return Number.isInteger(ceilings[category]) ? Math.min(hours, ceilings[category]) : hours;
}

const inKolkata = (lat, lng) => lat >= 22.35 && lat <= 22.75 && lng >= 88.2 && lng <= 88.55;

function metres(a, b) {
  const R = 6371000;
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const openRequest = (issue) => [...(issue.requests || [])].reverse().find((r) => !r.decided) || null;

/* ============================ live events ============================
   ownerRoom: the crew on the file. citizenRooms: the issue room (reporter,
   followers, backers) plus every citizen when the board's public face changed. */

function toCommand(req, event, payload, issue, extra = []) {
  const owner = sid(issue.assignedTo);
  live.emit(event, payload, ["role:admin", owner && `user:${owner}`, ...extra], req);
}

/* a public "read it again" for everyone who can see the issue on a board:
   the issue room, all citizens and all staff. Only the masked status. */
function toPublic(req, issue, event = "issue:status", fields = {}) {
  live.emit(event, { id: issue.publicId, ...fields }, [`issue:${issue.publicId}`, "role:citizen", "role:staff"], req);
}

/* ============================ reads ============================ */

const getIssues = async (req, res) => {
  try {
    const user = req.user;
    const filter = {};
    if (user.role === "citizen") filter.$or = [{ removed: null }, { reportedBy: user._id }];
    else if (user.role === "staff") filter.$or = [{ removed: null }, { assignedTo: user._id }];
    const docs = await Issue.find(filter).sort({ createdAt: -1 });
    const people = await peopleFor(docs);
    const items = docs.map((d) => viewOf(d, user, people));
    return res.json({ items, total: items.length });
  } catch (error) {
    console.error("Get issues error:", error);
    return res.status(500).json({ message: "Issues couldn't be loaded. Try again." });
  }
};

const getIssueById = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Get issue error:", error);
    return res.status(500).json({ message: "That issue couldn't be loaded. Try again." });
  }
};

/* ============================ filing (citizen) ============================ */

const createIssue = async (req, res) => {
  try {
    const user = req.user;
    const b = req.body || {};
    const title = clean(b.title);
    const description = String(b.description || "").trim();
    const location = clean(b.location);
    const lat = Number(b.lat);
    const lng = Number(b.lng);

    const problem =
      textProblem(title, { min: 6, what: "a title", title: true }) ||
      textProblem(description, { min: 20, what: "what's wrong" }) ||
      textProblem(location, { min: 4, what: "a landmark or address" });
    if (problem) return fail(res, 400, problem);
    if (title.length > 90) return fail(res, 400, "Keep the title to 90 characters.");
    if (description.length > 600) return fail(res, 400, "Keep the description to 600 characters.");
    if (location.length > 120) return fail(res, 400, "Keep the landmark to 120 characters.");
    if (description.toLowerCase() === title.toLowerCase()) return fail(res, 400, "Describe the problem in more detail than the title.");
    if (!CATEGORIES.includes(b.category)) return fail(res, 400, "Pick what kind of problem it is.");
    if (!WARDS.includes(b.ward)) return fail(res, 400, "Pick one of the six zones.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKolkata(lat, lng)) return fail(res, 400, "Pin the spot on the map inside Kolkata.");
    if (![true, false, "true", "false", undefined, ""].includes(b.danger)) return fail(res, 400, "The danger flag isn't valid.");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await Issue.countDocuments({ reportedBy: user._id, createdAt: { $gte: since } })) >= 10) {
      return fail(res, 429, "You've sent 10 reports in the past day. Try again tomorrow.");
    }

    const files = req.files || [];
    const base = String(process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");
    if (files.length && !/^https?:\/\//i.test(base)) return fail(res, 503, "Photos can't be stored right now. Send the report without them.");

    const danger = b.danger === true || b.danger === "true";
    const priority = danger ? "high" : "medium";
    const slaHours = await windowFor(priority, b.category);
    const publicId = await nextIssueId();
    const now = new Date();

    const issue = await Issue.create({
      publicId,
      title,
      description,
      category: b.category,
      location: { type: "Point", coordinates: [lng, lat] },
      locationText: location,
      ward: b.ward,
      lat,
      lng,
      danger,
      priority,
      slaHours,
      photos: files.map((f) => ({ id: crypto.randomUUID(), name: `photo-${crypto.randomBytes(3).toString("hex")}.${(f.filename.split(".").pop() || "jpg").toLowerCase()}`, url: `${base}/uploads/issues/${f.filename}`, kb: Math.ceil(f.size / 1024) })),
      reportedBy: user._id,
      status: "submitted",
      timeline: [{ status: "submitted", at: now, by: displayOf(user), byId: String(user._id), role: "citizen" }],
      savedBy: [],
      supporters: [],
    });

    await audit(req, "filed", `Filed ${publicId}${danger ? " · danger flagged" : ""}`, publicId, { type: "filed", reporterId: String(user._id) });
    live.joinIssue(String(user._id), publicId);
    live.emit("issue:filed", { id: publicId, title, category: b.category, ward: b.ward, priority, danger }, ["role:admin", `zone:${b.ward}`, "role:citizen", "role:staff"], req);
    return answer(res, user, issue, 201);
  } catch (error) {
    console.error("Create issue error:", error);
    return res.status(500).json({ message: "The report couldn't be saved. Try again." });
  }
};

/* ============================ status (A7 §3.1) ============================ */

const updateIssueStatus = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const who = me(req);
    const to = String(req.body?.status || "");
    const note = clean(req.body?.note);
    const from = issue.status;
    const admin = who.role === "admin";
    const onFile = who.role === "staff" && sid(issue.assignedTo) === who.id;

    if (!admin && !onFile) return fail(res, 403, "Only the crew on this file or command can move it.");
    if (issue.removed) return fail(res, 409, "This issue is off the board.");

    let move = null;
    if (onFile && from === "acknowledged" && to === "in_progress") move = { kind: "start", min: 0 };
    else if (onFile && from === "in_progress" && to === "pending_review") move = { kind: "request", min: 12, what: "what was done" };
    else if (onFile && from === "pending_review" && to === "in_progress") move = { kind: "recall", min: 8, what: "why you're taking it back" };
    else if (admin && from === "pending_review" && to === "resolved") move = { kind: "confirm", min: 8, what: "a closing note" };
    else if (admin && from === "pending_review" && to === "in_progress") move = { kind: "sendback", min: 12, what: "what is still missing" };
    if (!move) return fail(res, 409, `That move isn't allowed from ${STATUS_LABEL[from] || from}.`);
    if (move.min) {
      const problem = textProblem(note, { min: move.min, what: move.what });
      if (problem) return fail(res, 400, problem);
      if (note.length > 700) return fail(res, 400, "Keep the note to 700 characters.");
    }

    issue.status = to;
    issue.timeline.push(step(req, to, note));
    if (move.kind === "sendback") {
      issue.returned = (issue.returned || 0) + 1;
      issue.lastReturn = { reason: note, by: who.name, byId: who.id, at: new Date() };
    }
    if (to === "pending_review" || to === "resolved") issue.lastReturn = null;
    await issue.save();

    const id = issue.publicId;
    const actions = {
      start: `Started work on ${id}`,
      request: `Requested close on ${id}`,
      recall: `Recalled close request on ${id}: ${note}`,
      confirm: `Confirmed close on ${id}: ${note}`,
      sendback: `Sent ${id} back to the field: ${note}`,
    };
    const owner = sid(issue.assignedTo);
    const ownerName = (await User.findById(owner).select("name").lean())?.name || null;
    await audit(req, "status", actions[move.kind], id, {
      type: "status", from, to, owner: ownerName, ownerId: owner || null,
      ...(note ? { reason: note } : {}), ...(move.kind === "sendback" ? { sentBack: true } : {}), ...(move.kind === "recall" ? { recalled: true } : {}),
    });

    // command and the crew: the full move
    const base = { id, owner: owner || null };
    toCommand(req, "issue:status", { ...base, from, to, ...(note && move.kind !== "request" ? { reason: note } : {}) }, issue);
    if (move.kind === "request") toCommand(req, "issue:close-requested", base, issue);
    if (move.kind === "recall") toCommand(req, "issue:close-withdrawn", { ...base, reason: note }, issue);
    if (move.kind === "sendback") toCommand(req, "issue:sent-back", { ...base, reason: note, returned: issue.returned }, issue);
    if (move.kind === "confirm") toCommand(req, "issue:resolved", { ...base, note }, issue);

    // citizens see only what changed in public: work started, or resolved. The close gate stays internal.
    if (publicStatus(from) !== publicStatus(to)) toPublic(req, issue, "issue:status", { from: publicStatus(from), to: publicStatus(to) });

    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Update status error:", error);
    return res.status(500).json({ message: "The status couldn't be changed. Try again." });
  }
};

/* ============================ dispatch ============================ */

const assignIssue = async (req, res) => {
  try {
    const issue = await load(req, res, "+lastDispatch");
    if (!issue) return;
    const who = me(req);
    const { staff = null, note = "", undo = false } = req.body || {};
    const id = issue.publicId;
    if (issue.removed) return fail(res, 409, "This issue is off the board.");
    if (issue.status === "resolved") return fail(res, 409, "A resolved issue can't be dispatched.");

    const previousId = sid(issue.assignedTo);
    const previous = previousId ? await User.findById(previousId).select("name").lean() : null;

    // Undo of the last dispatch: put the file back exactly as it was
    if (undo === true) {
      const d = issue.lastDispatch;
      const fresh = d && Date.now() - new Date(d.at).getTime() < UNDO_MS && sid(d.to) === previousId;
      if (!fresh) return fail(res, 409, "That dispatch can't be undone any more.");
      issue.assignedTo = d.before.assignedTo || null;
      issue.assignedAt = d.before.assignedAt || null;
      issue.status = d.before.status;
      issue.returned = d.before.returned || 0;
      issue.lastReturn = d.before.lastReturn || null;
      issue.timeline = issue.timeline.slice(0, d.before.timelineLength);
      issue.lastDispatch = null;
      await issue.save();
      const back = sid(issue.assignedTo);
      const backName = back ? (await User.findById(back).select("name").lean())?.name : null;
      await audit(req, "dispatch", `Undid the dispatch of ${id}`, id, { type: "assign", to: backName || null, from: previous?.name || null, toId: back || null, fromId: previousId || null, undo: true });
      if (previousId) live.leaveIssue(previousId, id);
      if (back) live.joinIssue(back, id);
      live.emit("issue:assigned", { id, to: back || null, from: previousId || null, undo: true }, ["role:admin", previousId && `user:${previousId}`, back && `user:${back}`], req);
      toPublic(req, issue);
      return answer(res, req.user, issue);
    }

    let next = null;
    if (staff !== null) {
      const name = clean(staff);
      if (!name) return fail(res, 400, "Pick a field crew member.");
      const matches = await User.find({ role: "staff", isActive: true, name }).select("name").lean();
      if (matches.length !== 1) return fail(res, 409, matches.length ? "Two staff accounts share that name. Rename one on the Staff Desk first." : "That staff member isn't on the active roster.");
      next = matches[0];
    }
    const nextId = next ? String(next._id) : "";
    if (nextId === previousId) return fail(res, 409, next ? `${id} is already with ${next.name}.` : `${id} has no crew to unassign.`);
    const tag = clean(note);
    if (tag && textProblem(tag)) return fail(res, 400, textProblem(tag));

    const before = {
      assignedTo: issue.assignedTo || null,
      assignedAt: issue.assignedAt || null,
      status: issue.status,
      returned: issue.returned || 0,
      lastReturn: issue.lastReturn || null,
      timelineLength: issue.timeline.length,
    };
    const inMotion = issue.status === "in_progress" || issue.status === "pending_review";
    let line = null;
    if (next && issue.status === "submitted") line = `Assigned to ${next.name}`;
    else if (next && previous && inMotion) line = `Reassigned from ${previous.name} to ${next.name}`;
    else if (!next && inMotion) line = `Returned to dispatch: unassigned from ${previous?.name || "the crew"}`;

    const was = issue.status;
    issue.assignedTo = next ? next._id : null;
    issue.assignedAt = next ? new Date() : null;
    if (line) {
      issue.status = "acknowledged";
      issue.timeline.push(step(req, "acknowledged", line));
    }
    // a new owner starts clean
    issue.returned = 0;
    issue.lastReturn = null;
    issue.lastDispatch = { at: new Date(), to: nextId || null, before };
    await issue.save();

    let action = next ? (previous ? `Reassigned ${id} from ${previous.name} to ${next.name}` : `Assigned ${id} to ${next.name}`) : `Unassigned ${id} from ${previous?.name || "the crew"}`;
    if (next && tag) action += ` (${tag})`;
    if (inMotion && line) action += was === "pending_review" ? " · close request withdrawn" : " · back to Acknowledged";
    await audit(req, "dispatch", action, id, { type: "assign", to: next?.name || null, from: previous?.name || null, toId: nextId || null, fromId: previousId || null });

    if (previousId) live.leaveIssue(previousId, id);
    if (nextId) live.joinIssue(nextId, id);
    live.emit("issue:assigned", { id, to: nextId || null, from: previousId || null }, ["role:admin", previousId && `user:${previousId}`, nextId && `user:${nextId}`], req);
    toPublic(req, issue); // the reporter sees "a crew is on it" (the name never leaves)
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Assign issue error:", error);
    return res.status(500).json({ message: "The dispatch couldn't be saved. Try again." });
  }
};

const updateIssuePriority = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const priority = String(req.body?.priority || "");
    if (!PRIORITIES.includes(priority)) return fail(res, 400, "Pick a priority: low, medium, high or critical.");
    if (issue.priority === priority) return fail(res, 409, `${issue.publicId} is already ${PRIORITY_LABEL[priority]}.`);
    const from = issue.priority;
    const was = issue.slaHours;
    issue.priority = priority;
    // an open issue gets the window under the live table, still counted from the report time
    if (issue.status !== "resolved") issue.slaHours = await windowFor(priority, issue.category);
    await issue.save();

    const id = issue.publicId;
    let action = `Set ${id} priority to ${PRIORITY_LABEL[priority]}`;
    if (issue.slaHours !== was) action += ` · window ${was}h → ${issue.slaHours}h`;
    const owner = sid(issue.assignedTo);
    const ownerName = owner ? (await User.findById(owner).select("name").lean())?.name : null;
    await audit(req, "priority", action, id, { type: "priority", from, to: priority, owner: ownerName || null, ownerId: owner || null });
    toCommand(req, "issue:priority", { id, from, to: priority, window: issue.slaHours }, issue);
    // the reporter's promise may have moved: a bare re-read, no details
    live.emit("issue:status", { id }, [`issue:${id}`], req);
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Priority error:", error);
    return res.status(500).json({ message: "The priority couldn't be changed. Try again." });
  }
};

/* ============================ notes ============================ */

const addIssueComment = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const who = me(req);
    const onFile = who.role === "staff" && sid(issue.assignedTo) === who.id;
    if (who.role !== "admin" && !onFile) return fail(res, 403, "Only the crew on this file or command can add notes.");
    if (issue.status === "resolved") return fail(res, 409, "This file is closed. Notes can't be added.");
    const body = String(req.body?.body || "").trim();
    const internal = req.body?.internal === true;
    const problem = textProblem(body, { min: 1, what: "a note" });
    if (problem) return fail(res, 400, problem);
    if (body.length > 700) return fail(res, 400, "Keep the note to 700 characters.");

    issue.comments.push({ id: crypto.randomUUID(), author: who.name, authorId: who.id, role: who.role, body, createdAt: new Date(), internal });
    await issue.save();
    // notes notify, they don't write audit rows in the frontend's trail; command still sees them on the file
    const id = issue.publicId;
    toCommand(req, "issue:note", { id, author: who.id, internal }, issue);
    if (!internal) live.emit("issue:note", { id, internal: false }, [`issue:${id}`], req);
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Comment error:", error);
    return res.status(500).json({ message: "The note couldn't be saved. Try again." });
  }
};

/* ============================ citizens ============================ */

const supportIssue = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const uid = String(req.user._id);
    if (issue.removed) return fail(res, 409, "This report is off the board.");
    if (issue.status === "resolved") return fail(res, 409, "This one is already fixed.");
    if (sid(issue.reportedBy) === uid) return fail(res, 409, "This is your own report.");
    if (issue.supporters.some((s) => sid(s.id) === uid)) return fail(res, 409, "You're already counted on this report.");

    issue.supporters.push({ id: req.user._id, name: displayOf(req.user), at: new Date() });
    if (!issue.savedBy.some((x) => String(x) === uid)) issue.savedBy.push(req.user._id);
    await issue.save();
    const count = issue.supporters.length + 1;
    await audit(req, "filed", `Also reported ${issue.publicId} (${count} citizens affected)`, issue.publicId, { type: "supported", userId: uid, count });
    live.joinIssue(uid, issue.publicId);
    live.emit("issue:supported", { id: issue.publicId, count }, ["role:admin", `issue:${issue.publicId}`, sid(issue.assignedTo) && `user:${sid(issue.assignedTo)}`], req);
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Support error:", error);
    return res.status(500).json({ message: "That couldn't be saved. Try again." });
  }
};

const followIssue = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const on = req.body?.on;
    if (typeof on !== "boolean") return fail(res, 400, "Say whether to follow (true or false).");
    const uid = String(req.user._id);
    const has = issue.savedBy.some((x) => String(x) === uid);
    if (on && !has) issue.savedBy.push(req.user._id);
    if (!on && has) issue.savedBy = issue.savedBy.filter((x) => String(x) !== uid);
    if (on !== has) await issue.save();
    // following is private: no audit row, no event to others. The person's other tabs re-read.
    const stays = on || sid(issue.reportedBy) === uid || issue.supporters.some((s) => sid(s.id) === uid);
    if (stays) live.joinIssue(uid, issue.publicId);
    else live.leaveIssue(uid, issue.publicId);
    live.emit("issue:status", { id: issue.publicId }, [`user:${uid}`], req);
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Follow error:", error);
    return res.status(500).json({ message: "That couldn't be saved. Try again." });
  }
};

/* citizen, own report, still New with no crew: off the board at once */
const withdrawIssue = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const uid = String(req.user._id);
    if (sid(issue.reportedBy) !== uid) return fail(res, 403, "Only the person who filed it can withdraw it.");
    if (issue.removed) return fail(res, 409, "This report is already off the board.");
    if (issue.status !== "submitted" || issue.assignedTo) return fail(res, 409, "A crew is on it now. Ask command to withdraw it instead.");
    const reason = String(req.body?.reason || "");
    const note = clean(req.body?.note);
    if (!WITHDRAW_REASONS.includes(reason)) return fail(res, 400, "Pick why you're withdrawing it.");
    if (note && textProblem(note)) return fail(res, 400, textProblem(note));
    if (note.length > 280) return fail(res, 400, "Keep the note to 280 characters.");

    issue.removed = { kind: "withdrawn", reason, note, by: displayOf(req.user), byId: uid, role: "citizen", at: new Date() };
    await issue.save();
    await audit(req, "removal", `Withdrew ${issue.publicId} · ${reason}`, issue.publicId, { type: "withdrawn", reason });
    live.emit("issue:removed", { id: issue.publicId, kind: "withdrawn", reason }, ["role:admin"], req);
    toPublic(req, issue, "issue:removed", { kind: "withdrawn" });
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ message: "The report couldn't be withdrawn. Try again." });
  }
};

/* ============================ requests (A7 §3.2) ============================ */

const createIssueRequest = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const who = me(req);
    const type = String(req.body?.type || "");
    const reason = String(req.body?.reason || "");
    const note = clean(req.body?.note);
    const linkedTo = req.body?.linkedTo ? String(req.body.linkedTo) : null;
    const reporter = sid(issue.reportedBy) === who.id;
    const onFile = who.role === "staff" && sid(issue.assignedTo) === who.id;

    if (!REQUEST_LABEL[type]) return fail(res, 400, "That request type isn't known.");
    if (openRequest(issue)) return fail(res, 409, "There's already an open request on this file.");
    if (note && textProblem(note)) return fail(res, 400, textProblem(note));
    if (note.length > 280) return fail(res, 400, "Keep the note to 280 characters.");

    if (type === "withdraw") {
      if (who.role !== "citizen" || !reporter) return fail(res, 403, "Only the person who filed it can ask to withdraw it.");
      if (issue.removed) return fail(res, 409, "This report is already off the board.");
      if (issue.status === "submitted" && !issue.assignedTo) return fail(res, 409, "No crew yet: withdraw it directly.");
      if (!WITHDRAW_REASONS.includes(reason)) return fail(res, 400, "Pick why you want it withdrawn.");
    }
    if (type === "dispute") {
      if (who.role !== "citizen" || !reporter) return fail(res, 403, "Only the person who filed it can dispute the dismissal.");
      if (issue.removed?.kind !== "dismissed") return fail(res, 409, "Only a dismissed report can be disputed.");
      const problem = textProblem(reason, { min: 6, what: "why the dismissal is wrong" });
      if (problem) return fail(res, 400, problem);
    }
    if (type === "flag") {
      if (!onFile) return fail(res, 403, "Only the crew on this file can flag it.");
      if (issue.removed) return fail(res, 409, "This issue is already off the board.");
      if (!FLAG_REASONS.includes(reason)) return fail(res, 400, "Pick why the issue isn't valid.");
      if (reason === "Duplicate report") {
        if (!linkedTo) return fail(res, 400, "Name the original issue.");
      } else {
        if (!FLAG_ON_SITE.includes(reason) || !["in_progress", "pending_review"].includes(issue.status)) return fail(res, 409, "That reason needs the crew on site first: start work, then flag it.");
        if (note.length < 10) return fail(res, 400, "Say what the crew found (at least 10 characters).");
      }
    }
    if (linkedTo) {
      if (linkedTo === issue.publicId) return fail(res, 400, "An issue can't repeat itself.");
      const original = await Issue.findOne({ publicId: linkedTo }).select("publicId removed").lean();
      if (!original || original.removed) return fail(res, 404, `${linkedTo} isn't an open issue.`);
    }

    const role = type === "flag" ? "staff" : "citizen";
    issue.requests.push({ id: crypto.randomUUID(), type, by: who.name, byId: who.id, role, reason, note, ...(linkedTo ? { linkedTo } : {}), at: new Date(), seenAt: null, decided: null });
    issue.markModified("requests");
    await issue.save();
    const id = issue.publicId;
    const verb = type === "withdraw" ? `Requested withdrawal of ${id}` : type === "dispute" ? `Disputed the dismissal of ${id}` : `Flagged ${id} as invalid`;
    await audit(req, "request", `${verb} · ${reason}`, id, { type: "request", req: type, reason, ...(linkedTo ? { linkedTo } : {}) });
    live.emit("issue:request", { id, req: type, reason }, ["role:admin", `user:${who.id}`], req);
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Request error:", error);
    return res.status(500).json({ message: "The request couldn't be sent. Try again." });
  }
};

const markIssueRequestSeen = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const r = (issue.requests || []).find((x) => x.id === req.params.reqId);
    if (!r) return fail(res, 404, "That request wasn't found.");
    if (!r.seenAt) {
      r.seenAt = new Date();
      issue.markModified("requests");
      await issue.save();
      // the requester's track lights "Seen"
      live.emit("issue:status", { id: issue.publicId }, ["role:admin", `user:${r.byId}`], req);
    }
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Seen error:", error);
    return res.status(500).json({ message: "That couldn't be saved. Try again." });
  }
};

/* merge `dup` into `original`: the dup's reporter and backers count on the original */
function mergeInto(dup, original, who, note) {
  const have = new Set([sid(original.reportedBy), ...original.supporters.map((s) => sid(s.id))]);
  const people = [{ id: dup.reportedBy, name: "", at: new Date() }, ...dup.supporters.map((s) => ({ id: s.id, name: s.name, at: s.at }))]
    .filter((p) => sid(p.id) && !have.has(sid(p.id)));
  people.forEach((p) => {
    original.supporters.push({ id: p.id, name: p.name, at: new Date() });
    if (!original.savedBy.some((x) => String(x) === sid(p.id))) original.savedBy.push(p.id);
  });
  dup.removed = { kind: "dismissed", reason: "Duplicate report", note, by: who.name, byId: who.id, role: "admin", at: new Date(), linkedTo: original.publicId, merged: true, addedTo: people.map((p) => sid(p.id)) };
  return people.map((p) => sid(p.id));
}

/* a merged report restored: the people it added leave the original (its own reporter stays) */
function unmerge(dup, original) {
  const gone = new Set((dup.removed?.addedTo || []).map(String));
  original.supporters = original.supporters.filter((s) => !gone.has(sid(s.id)));
  original.savedBy = original.savedBy.filter((x) => !gone.has(String(x)) || String(x) === sid(original.reportedBy));
  return [...gone];
}

const decideIssueRequest = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const who = me(req);
    const verdict = String(req.body?.verdict || "");
    const why = clean(req.body?.reason);
    if (!["approved", "declined"].includes(verdict)) return fail(res, 400, "Approve or decline the request.");
    if (verdict === "declined") {
      const problem = textProblem(why, { min: 6, what: "why it's declined" });
      if (problem) return fail(res, 400, problem);
    } else if (why && textProblem(why)) return fail(res, 400, textProblem(why));
    const r = (issue.requests || []).find((x) => x.id === req.params.reqId);
    if (!r || r.decided) return fail(res, 404, "That open request wasn't found.");

    const at = new Date();
    r.seenAt = r.seenAt || at;
    r.decided = { verdict, reason: why, by: who.name, byId: who.id, at };
    issue.markModified("requests");

    const id = issue.publicId;
    const related = [];
    let merged = false;
    if (verdict === "approved") {
      if (r.type === "flag" && r.reason === "Duplicate report" && r.linkedTo) {
        const original = await Issue.findOne({ publicId: r.linkedTo });
        if (!original || original.removed) return fail(res, 409, `${r.linkedTo} is no longer open. Decline this flag or dismiss the issue.`);
        mergeInto(issue, original, who, r.note || "");
        await original.save();
        related.push(original);
        merged = true;
      } else if (r.type === "withdraw" || r.type === "flag") {
        if (issue.removed) return fail(res, 409, "This issue is already off the board.");
        issue.removed = {
          kind: r.type === "withdraw" ? "withdrawn" : "dismissed",
          reason: r.reason,
          note: r.note || "",
          by: who.name,
          byId: who.id,
          role: "admin",
          at,
          ...(r.linkedTo ? { linkedTo: r.linkedTo } : {}),
          ...(r.type === "withdraw" ? { requestedBy: r.by, requestedById: r.byId } : {}),
        };
      } else if (r.type === "dispute") {
        if (!issue.removed) return fail(res, 409, "This report is already back on the board.");
        issue.restored = { from: issue.removed, by: who.name, byId: who.id, at, note: "Dispute approved" };
        issue.removed = null;
      }
    }
    await issue.save();

    const ownerName = sid(issue.assignedTo) ? (await User.findById(sid(issue.assignedTo)).select("name").lean())?.name : null;
    await audit(req, "removal",
      `${verdict === "approved" ? "Approved" : "Declined"} ${REQUEST_LABEL[r.type]} on ${id}${merged ? ` · merged into ${r.linkedTo}` : ""}${why ? ` · ${why}` : ""}`,
      id, { type: "decided", req: r.type, verdict, by: r.by, byId: r.byId || null, owner: ownerName || null, ...(why ? { reason: why } : {}), ...(merged ? { into: r.linkedTo } : {}) });

    live.emit("issue:request-decided", { id, req: r.type, verdict }, ["role:admin", `user:${r.byId}`], req);
    if (verdict === "approved" && issue.removed) {
      toCommand(req, "issue:removed", { id, kind: issue.removed.kind, reason: issue.removed.reason }, issue);
      toPublic(req, issue, "issue:removed", { kind: issue.removed.kind });
    }
    if (verdict === "approved" && r.type === "dispute") {
      toCommand(req, "issue:restored", { id }, issue);
      toPublic(req, issue, "issue:restored");
    }
    if (merged) toPublic(req, related[0], "issue:supported", { count: related[0].supporters.length + 1 });
    return answer(res, req.user, issue, 200, related);
  } catch (error) {
    console.error("Decide request error:", error);
    return res.status(500).json({ message: "The decision couldn't be saved. Try again." });
  }
};

/* ============================ removal (command) ============================ */

const dismissIssue = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const who = me(req);
    if (issue.removed) return fail(res, 409, "This issue is already off the board.");
    const reason = String(req.body?.reason || "");
    const note = clean(req.body?.note);
    const linkedTo = req.body?.linkedTo ? String(req.body.linkedTo) : null;
    if (!DISMISS_REASONS.includes(reason)) return fail(res, 400, "Pick why it's dismissed.");
    if (note && textProblem(note)) return fail(res, 400, textProblem(note));
    if (note.length > 280) return fail(res, 400, "Keep the note to 280 characters.");
    if (reason === "Duplicate report" && !linkedTo) return fail(res, 400, "Name the original issue.");
    if (linkedTo && !(await Issue.exists({ publicId: linkedTo }))) return fail(res, 404, `${linkedTo} wasn't found.`);

    const ownerId = sid(issue.assignedTo);
    issue.removed = { kind: "dismissed", reason, note, by: who.name, byId: who.id, role: "admin", at: new Date(), ...(linkedTo ? { linkedTo } : {}) };
    await issue.save();
    const ownerName = ownerId ? (await User.findById(ownerId).select("name").lean())?.name : null;
    const id = issue.publicId;
    await audit(req, "removal", `Dismissed ${id} · ${reason}${linkedTo ? ` (duplicate of ${linkedTo})` : ""}`, id, { type: "dismissed", reason, owner: ownerName || null, ownerId: ownerId || null, ...(linkedTo ? { linkedTo } : {}) });
    toCommand(req, "issue:removed", { id, kind: "dismissed", reason }, issue);
    toPublic(req, issue, "issue:removed", { kind: "dismissed" });
    return answer(res, req.user, issue);
  } catch (error) {
    console.error("Dismiss error:", error);
    return res.status(500).json({ message: "The issue couldn't be dismissed. Try again." });
  }
};

const mergeIssue = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const who = me(req);
    const into = String(req.body?.into || "");
    const note = clean(req.body?.note);
    if (note && textProblem(note)) return fail(res, 400, textProblem(note));
    const original = await Issue.findOne({ publicId: into });
    if (!original || into === issue.publicId) return fail(res, 400, "Pick a different original issue.");
    if (issue.removed || original.removed) return fail(res, 409, "Both issues must be on the board.");
    if (issue.category !== original.category) return fail(res, 409, "Only issues of the same kind can be merged.");
    if (metres(issue, original) > DUP_M || Math.abs(issue.createdAt - original.createdAt) > DUP_DAYS * 864e5) return fail(res, 409, "These two are more than 200 m or 7 days apart.");

    const ownerId = sid(issue.assignedTo);
    mergeInto(issue, original, who, note);
    await issue.save();
    await original.save();
    const id = issue.publicId;
    const ownerName = ownerId ? (await User.findById(ownerId).select("name").lean())?.name : null;
    await audit(req, "removal", `Merged ${id} into ${into} · duplicate report`, id, { type: "merged", into, owner: ownerName || null, ownerId: ownerId || null });
    toCommand(req, "issue:removed", { id, kind: "dismissed", reason: "Duplicate report" }, issue);
    toPublic(req, issue, "issue:removed", { kind: "dismissed" });
    toCommand(req, "issue:supported", { id: into, count: original.supporters.length + 1 }, original);
    toPublic(req, original, "issue:supported", { count: original.supporters.length + 1 });
    return answer(res, req.user, issue, 200, [original]);
  } catch (error) {
    console.error("Merge error:", error);
    return res.status(500).json({ message: "The merge couldn't be saved. Try again." });
  }
};

/* restore a dismissal (also command's Undo for dismiss and merge, undo: true) */
const restoreIssue = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const who = me(req);
    if (issue.removed?.kind !== "dismissed") return fail(res, 409, issue.removed ? "A citizen's withdrawal is theirs; it can't be restored." : "This issue is on the board.");
    const undo = req.body?.undo === true;
    const note = clean(req.body?.note);
    if (note && textProblem(note)) return fail(res, 400, textProblem(note));
    if (undo && Date.now() - new Date(issue.removed.at).getTime() > UNDO_MS) return fail(res, 409, "That can't be undone any more. Restore it instead.");

    const was = issue.removed;
    const related = [];
    if (was.merged && was.linkedTo) {
      const original = await Issue.findOne({ publicId: was.linkedTo });
      if (original) {
        unmerge(issue, original);
        await original.save();
        related.push(original);
      }
    }
    issue.removed = null;
    issue.restored = undo ? null : { from: was, by: who.name, byId: who.id, at: new Date(), note };
    await issue.save();
    const id = issue.publicId;
    const action = undo
      ? `Undid the ${was.merged ? "merge" : "dismissal"} of ${id}`
      : `Restored ${id}${was.merged ? ` (unmerged from ${was.linkedTo})` : ""}${note ? ` · ${note}` : ""}`;
    await audit(req, "removal", action, id, { type: "restored", ...(was.merged ? { unmerged: was.linkedTo } : {}), ...(undo ? { undo: true } : {}) });
    toCommand(req, "issue:restored", { id }, issue);
    toPublic(req, issue, "issue:restored");
    if (related[0]) {
      toCommand(req, "issue:supported", { id: related[0].publicId, count: related[0].supporters.length + 1 }, related[0]);
      toPublic(req, related[0], "issue:supported", { count: related[0].supporters.length + 1 });
    }
    return answer(res, req.user, issue, 200, related);
  } catch (error) {
    console.error("Restore error:", error);
    return res.status(500).json({ message: "The issue couldn't be restored. Try again." });
  }
};

const getPossibleDuplicates = async (req, res) => {
  try {
    const issue = await load(req, res);
    if (!issue) return;
    const t = issue.createdAt.getTime();
    const near = await Issue.find({
      _id: { $ne: issue._id },
      category: issue.category,
      removed: null,
      status: { $ne: "resolved" },
      createdAt: { $gte: new Date(t - DUP_DAYS * 864e5), $lte: issue.createdAt },
      lat: { $gte: issue.lat - 0.003, $lte: issue.lat + 0.003 },
      lng: { $gte: issue.lng - 0.003, $lte: issue.lng + 0.003 },
    });
    const items = near.filter((o) => metres(issue, o) <= DUP_M).sort((a, b) => metres(issue, a) - metres(issue, b));
    const people = await peopleFor(items);
    return res.json({ items: items.map((o) => ({ ...viewOf(o, req.user, people), m: Math.round(metres(issue, o)) })), total: items.length });
  } catch (error) {
    console.error("Duplicates error:", error);
    return res.status(500).json({ message: "Possible duplicates couldn't be checked." });
  }
};

const WARD_CENTRE = {
  Shyambazar: [22.6015, 88.3736],
  "B.B.D. Bagh": [22.5726, 88.349],
  Ballygunge: [22.527, 88.363],
  "College Street": [22.576, 88.3635],
  "B.P. Township": [22.4722, 88.3878],
  Dharmatala: [22.5604, 88.3519],
};

/* Community (B3): command turns a proposal into a work order, filed for the proposal's author. */
async function fileFromProposal(proposal, priority, req) {
  const author = await User.findById(proposal.by.id).select("_id name displayName isActive").lean();
  if (!author) throw Object.assign(new Error("The proposal's author no longer has an account."), { status: 409 });
  const category = CATEGORIES.includes(proposal.category) ? proposal.category : "other";
  const level = PRIORITIES.includes(priority) ? priority : "medium";
  const [lat, lng] = WARD_CENTRE[proposal.ward] || WARD_CENTRE.Dharmatala;
  const publicId = await nextIssueId();
  const who = me(req);
  const backers = (proposal.signals || []).filter((x) => x.resident).length;
  const issue = await Issue.create({
    publicId,
    title: String(proposal.title).slice(0, 90),
    description: `${proposal.summary}\n\nFrom community proposal ${proposal.id} (${backers} resident${backers === 1 ? "" : "s"} backed it).`.slice(0, 600),
    category,
    location: { type: "Point", coordinates: [lng, lat] },
    locationText: `${proposal.ward} · community proposal`,
    ward: proposal.ward,
    lat,
    lng,
    danger: false,
    priority: level,
    slaHours: await windowFor(level, category),
    photos: [],
    reportedBy: author._id,
    status: "submitted",
    timeline: [{ status: "submitted", at: new Date(), by: who.name, byId: who.id, role: "admin", note: `From community proposal ${proposal.id}` }],
    fromProposal: proposal.id,
  });
  await audit(req, "filed", `Filed ${publicId} from community proposal ${proposal.id}`, publicId, { type: "filed", reporterId: String(author._id), fromProposal: proposal.id });
  live.joinIssue(String(author._id), publicId);
  live.emit("issue:filed", { id: publicId, title: issue.title, category, ward: proposal.ward, priority: level, danger: false }, ["role:admin", `zone:${proposal.ward}`, "role:citizen", "role:staff"], req);
  return issue;
}

/* Staff Desk removal (B1): a person leaves the field and their open files go back to dispatch. */
async function releaseIssuesOf(staffUser, req) {
  const open = await Issue.find({ assignedTo: staffUser._id, status: { $ne: "resolved" }, removed: null });
  for (const issue of open) {
    const back = issue.status === "in_progress" || issue.status === "pending_review";
    issue.assignedTo = null;
    issue.assignedAt = null;
    issue.returned = 0;
    issue.lastReturn = null;
    if (back) {
      issue.status = "acknowledged";
      issue.timeline.push(step(req, "acknowledged", `Returned to dispatch: ${staffUser.name} left the field`));
    }
    await issue.save();
    await audit(req, "dispatch", `Returned ${issue.publicId} to dispatch (${staffUser.name} left the field)`, issue.publicId, { type: "assign", to: null, from: staffUser.name, fromId: String(staffUser._id), left: true });
    live.leaveIssue(String(staffUser._id), issue.publicId);
    live.emit("issue:assigned", { id: issue.publicId, to: null, from: String(staffUser._id) }, ["role:admin"], req);
    toPublic(req, issue);
  }
  return open.length;
}

module.exports = {
  createIssue,
  getIssues,
  getIssueById,
  updateIssueStatus,
  assignIssue,
  updateIssuePriority,
  addIssueComment,
  supportIssue,
  followIssue,
  withdrawIssue,
  createIssueRequest,
  markIssueRequestSeen,
  decideIssueRequest,
  dismissIssue,
  mergeIssue,
  restoreIssue,
  getPossibleDuplicates,
  releaseIssuesOf,
  fileFromProposal,
  viewOf,
  peopleFor,
};
