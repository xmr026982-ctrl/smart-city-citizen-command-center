/* ------------------------------------------------------------------
   Community (contract B3): proposals, polls, announcements, work notices,
   "fixed / still happening" signals on resolved issues, crew checks.

   GET /community returns the whole board in the shape the frontend's
   community store uses, masked per role:
   - citizens: no other person's id or name. Backers, concerns, votes and
     photo owners stay as counts; command is "City Command", crews are
     "Field crew"; only announcements meant for citizens; nothing hidden.
   - staff: names of crews and command; citizens stay anonymous;
     announcements meant for crews.
   - admin: everything.
   Every change: the same rules as the frontend store, one trail entry
   (it feeds notifications), one audit row (kind "community", n.ref =
   PRP-/POL-/ANN-/WN- id) and a community:changed event.
------------------------------------------------------------------- */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CommunityRecord = require("../models/CommunityRecord");
const Issue = require("../models/Issue");
const User = require("../models/User");
const { nextCode } = require("../models/Counter");
const { isMash, MASH_MESSAGE } = require("../utils/textGuard");
const { CITIZEN_ZONES } = require("../config/citizenZones");
const { writeAudit, actorFrom } = require("../services/audit");
const live = require("../services/live");
const { fileFromProposal } = require("./issueController");

const H = 36e5;
const D = 24 * H;
const TRAIL_DAYS = 30;
const RESIDENT_TARGET = 50;
const MILESTONES = [10, 25, 50, 100];
const CATEGORIES = ["roads", "lighting", "water", "waste", "electricity", "safety", "other"];
const CONCERNS = ["Safety", "Cost", "Wrong location", "Already exists", "Better alternative"];
const STATUS_LABEL = { review: "Under review", approved: "Approved", planned: "Planned", issue: "Turned into an issue", poll: "Moved to a poll", notnow: "Not now" };
const NOTICE_KINDS = ["Power off", "Road closed", "Water off", "Crew on site", "Noise"];
const MODERATION_REASONS = ["Personal information", "Offensive", "Off-topic", "Not a city matter", "Duplicate"];
const POLL_HOURS = [24, 48, 72, 168];
const ANNOUNCE_HOURS_MAX = 14 * 24;
const PHOTO_MAX_BYTES = 600 * 1024;
const PHOTO_DIR = path.resolve(__dirname, "../uploads/community");

const FIELD_CREW = "Field crew";
const CITY_COMMAND = "City Command";
const RESIDENT = "A resident";

const nowIso = () => new Date().toISOString();
const uid = (p) => `${p}-${crypto.randomBytes(4).toString("hex")}`;
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ");
const fail = (res, status, message) => res.status(status).json({ message });
const nameOf = (u) => String(u.displayName || u.name || "").trim();

/* ============================ store helpers ============================ */

async function all(type) {
  return (await CommunityRecord.find({ type }).sort({ at: -1 }).lean()).map((r) => r.doc);
}
async function getDoc(type, ref) {
  return CommunityRecord.findOne({ type, ref });
}
async function put(type, doc, ward = "") {
  await CommunityRecord.updateOne({ type, ref: doc.id }, { $set: { doc, ward, at: new Date(doc.at || Date.now()) } }, { upsert: true });
}
async function saveDoc(record) {
  record.markModified("doc");
  await record.save();
}

/* one trail entry (notifications read it), one audit row (command's history), one live event */
async function record(req, n, { audit, zone = "all" } = {}) {
  const user = req.user;
  const entry = { id: uid("ct"), at: nowIso(), actor: nameOf(user), actorId: String(user._id), role: user.role, n };
  await CommunityRecord.create({ type: "trail", ref: entry.id, ward: n.ward || "", at: new Date(entry.at), doc: entry });
  if (audit) await writeAudit({ ...actorFrom(req), kind: "community", action: audit, n: { ...n, community: true }, issueId: n.issueId || null });
  live.emit("community:changed", { type: n.type, id: n.ref || n.issueId || "", zone }, ["role:admin", "role:staff", "role:citizen"], req);
}

/* ============================ masking ============================ */

const masked = (role) => (role === "staff" ? FIELD_CREW : role === "admin" ? CITY_COMMAND : RESIDENT);

function maskFor(viewer) {
  const me = String(viewer._id);
  const role = viewer.role;
  const admin = role === "admin";
  const citizen = role === "citizen";
  // a person's name as this viewer may see it
  const who = (name, personRole, id) => {
    if (admin) return name;
    if (id && id === me) return name;
    if (personRole === "citizen") return RESIDENT;
    return citizen ? masked(personRole) : name;
  };
  return { me, role, admin, citizen, who };
}

function viewProposal(p, m) {
  if (m.admin) return p;
  const own = p.by.id === m.me;
  return {
    ...p,
    by: own ? p.by : { id: "", name: RESIDENT },
    signals: p.signals.map((s) => (s.userId === m.me ? s : { userId: "", name: "", kind: s.kind, resident: s.resident, at: s.at })),
    concerns: p.concerns.map((c) => (c.userId === m.me ? c : { userId: "", reason: c.reason, at: c.at })),
    photos: p.photos.filter((ph) => !(m.citizen && ph.hidden)).map((ph) => (ph.userId === m.me ? ph : { ...ph, userId: "", hidden: ph.hidden ? true : false })),
    responses: p.responses.map((r) => ({ ...r, by: m.who(r.by, r.role, r.byId), byId: undefined })),
    decision: p.decision ? { ...p.decision, by: m.who(p.decision.by, "admin", p.decision.byId), byId: undefined } : null,
  };
}

function viewPoll(poll, m) {
  if (m.admin) return poll;
  // other people's votes become the options' base counts; only your own vote stays as a vote
  const options = poll.options.map((o) => ({ ...o, base: (o.base || 0) + Object.entries(poll.votes || {}).filter(([uidv, v]) => v === o.id && uidv !== m.me).length }));
  const mine = poll.votes?.[m.me];
  return {
    ...poll,
    options,
    votes: mine ? { [m.me]: mine } : {},
    by: m.who(poll.by, "admin", poll.byId),
    byId: undefined,
    outcome: poll.outcome ? { ...poll.outcome, by: m.who(poll.outcome.by, "admin", poll.outcome.byId), byId: undefined } : null,
  };
}

function viewTrail(e, m, announcements) {
  if (m.admin) return e;
  const n = { ...e.n };
  if (m.citizen) {
    delete n.owner;
    delete n.ownerId;
  }
  if (n.type === "announced") {
    const a = announcements.get(n.ref);
    if (!a || (m.citizen && !a.audience.citizens) || (m.role === "staff" && !a.audience.staff)) return null;
  }
  if (n.type === "moderated") return null; // moderation stays with command
  return { id: e.id, at: e.at, actor: m.who(e.actor, e.role, e.actorId), role: e.role, n };
}

const getCommunity = async (req, res) => {
  try {
    const m = maskFor(req.user);
    const since = new Date(Date.now() - TRAIL_DAYS * D);
    const [proposals, polls, announcements, notices, issueSignals, checks, trailRows] = await Promise.all([
      all("proposal"), all("poll"), all("announcement"), all("notice"), all("signal"), all("check"),
      CommunityRecord.find({ type: "trail", at: { $gte: since } }).sort({ at: -1 }).limit(400).lean(),
    ]);
    const annMap = new Map(announcements.map((a) => [a.id, a]));
    const audienceOk = (a) => m.admin || (m.citizen ? a.audience.citizens : a.audience.staff);
    return res.json({
      proposals: proposals.map((p) => viewProposal(p, m)),
      polls: polls.map((p) => viewPoll(p, m)),
      announcements: announcements
        .filter((a) => audienceOk(a) && !(m.citizen && a.hidden))
        .map((a) => (m.admin ? a : { ...a, by: m.who(a.by, "admin", a.byId), byId: undefined })),
      notices: notices
        .filter((x) => !(m.citizen && x.hidden))
        .map((x) => (m.admin ? x : { ...x, by: m.who(x.by, "staff", x.byId), byId: x.byId === m.me ? x.byId : undefined })),
      issueSignals: issueSignals.map((s) => (m.admin || s.userId === m.me ? s : { ...s, userId: "" })),
      checks: checks.map((c) => (m.admin ? c : { ...c, by: m.who(c.by, "staff", c.byId), byId: undefined })),
      trail: trailRows.map((r) => viewTrail(r.doc, m, annMap)).filter(Boolean),
    });
  } catch (error) {
    console.error("Community read error:", error);
    return fail(res, 500, "The community board couldn't be loaded.");
  }
};

/* ============================ citizens ============================ */

const propose = async (req, res) => {
  try {
    const user = req.user;
    const t = clean(req.body?.title);
    const s = String(req.body?.summary || "").trim();
    const ward = String(req.body?.ward || "");
    const category = CATEGORIES.includes(req.body?.category) ? req.body.category : "other";
    if (t.length < 12) return fail(res, 400, "Give it a title of at least 12 characters.");
    if (s.length < 20) return fail(res, 400, "Describe it in at least 20 characters.");
    if (t.length > 90 || s.length > 280) return fail(res, 400, "Keep the title to 90 and the description to 280 characters.");
    if (isMash(t, { title: true }) || isMash(s) || s.toLowerCase() === t.toLowerCase()) return fail(res, 400, "That doesn't read like a proposal. Please write it in plain words.");
    if (!CITIZEN_ZONES.includes(ward)) return fail(res, 400, "Pick the zone it's for.");
    const recent = await CommunityRecord.findOne({ type: "proposal", "doc.by.id": String(user._id), "doc.status": "review", at: { $gt: new Date(Date.now() - D) } }).lean();
    if (recent) return fail(res, 429, "You can send one proposal a day. Your last one is still under review.");

    const id = await nextCode("PRP", 100);
    const me = String(user._id);
    const p = {
      id, title: t, summary: s, category, ward, at: nowIso(), status: "review", target: RESIDENT_TARGET,
      by: { id: me, name: nameOf(user) },
      signals: [{ userId: me, name: nameOf(user), kind: "affects", resident: user.zone === ward, at: nowIso() }],
      concerns: [], photos: [], responses: [], decision: null, hidden: [],
      answerDue: new Date(Date.now() + 7 * D).toISOString(),
    };
    await put("proposal", p, ward);
    await record(req, { type: "proposed", ref: id, ward }, { audit: `Proposed ${id} · ${ward} · ${t}`, zone: ward });
    return res.status(201).json({ ok: true, id });
  } catch (error) {
    console.error("Propose error:", error);
    return fail(res, 500, "Your proposal couldn't be sent. Try again.");
  }
};

const signalProposal = async (req, res) => {
  try {
    const rec = await getDoc("proposal", req.params.id);
    if (!rec) return fail(res, 404, "That proposal wasn't found.");
    const p = rec.doc;
    const kind = req.body?.kind;
    if (!["affects", "use"].includes(kind)) return fail(res, 400, "Pick 'Affects me' or 'I'd use this'.");
    if (p.status !== "review") return fail(res, 409, "This proposal has been decided.");
    const me = String(req.user._id);
    const had = p.signals.find((s) => s.userId === me);
    const before = p.signals.filter((s) => s.resident).length;
    p.signals = p.signals.filter((s) => s.userId !== me);
    if (!had || had.kind !== kind) p.signals.push({ userId: me, name: nameOf(req.user), kind, resident: req.user.zone === p.ward, at: nowIso() });
    await saveDoc(rec);
    const after = p.signals.filter((s) => s.resident).length;
    const crossed = MILESTONES.find((mm) => before < mm && after >= mm) || (before < p.target && after >= p.target ? p.target : null);
    if (crossed) await record(req, { type: "backed", ref: p.id, ward: p.ward, residents: after, target: p.target, reached: after >= p.target }, { zone: p.ward });
    else live.emit("community:changed", { type: "proposal", id: p.id, zone: p.ward }, ["role:admin", "role:staff", "role:citizen"], req);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Signal error:", error);
    return fail(res, 500, "That couldn't be saved. Try again.");
  }
};

const concernProposal = async (req, res) => {
  try {
    const rec = await getDoc("proposal", req.params.id);
    if (!rec) return fail(res, 404, "That proposal wasn't found.");
    const p = rec.doc;
    const reason = req.body?.reason ?? null;
    if (reason !== null && !CONCERNS.includes(reason)) return fail(res, 400, "Pick a concern from the list.");
    if (p.status !== "review") return fail(res, 409, "This proposal has been decided.");
    const me = String(req.user._id);
    p.concerns = p.concerns.filter((c) => c.userId !== me);
    if (reason) p.concerns.push({ userId: me, reason, at: nowIso() });
    await saveDoc(rec);
    live.emit("community:changed", { type: "proposal", id: p.id, zone: p.ward }, ["role:admin", "role:staff", "role:citizen"], req);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Concern error:", error);
    return fail(res, 500, "That couldn't be saved. Try again.");
  }
};

/* one photo per person per proposal; a JPEG made in the browser, checked by its bytes, stored under a random name */
const photoProposal = async (req, res) => {
  try {
    const rec = await getDoc("proposal", req.params.id);
    if (!rec) return fail(res, 404, "That proposal wasn't found.");
    const p = rec.doc;
    const me = String(req.user._id);
    const url = String(req.body?.url || "");
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(url);
    if (!match) return fail(res, 400, "The photo must be a JPEG image.");
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length > PHOTO_MAX_BYTES) return fail(res, 413, "That photo is too large.");
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return fail(res, 400, "The photo must be a JPEG image.");
    const rest = p.photos.filter((ph) => ph.userId !== me);
    if (rest.length >= 12) return fail(res, 409, "This proposal already has the most photos it can hold.");
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    const file = `${crypto.randomBytes(16).toString("hex")}.jpg`;
    fs.writeFileSync(path.join(PHOTO_DIR, file), bytes);
    const base = String(process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");
    p.photos = [...rest, { id: uid("ph"), url: `${base}/uploads/community/${file}`, userId: me, at: nowIso(), hidden: false }];
    await saveDoc(rec);
    live.emit("community:changed", { type: "proposal", id: p.id, zone: p.ward }, ["role:admin", "role:staff", "role:citizen"], req);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Proposal photo error:", error);
    return fail(res, 500, "The photo couldn't be saved. Try again.");
  }
};

const votePoll = async (req, res) => {
  try {
    const rec = await getDoc("poll", req.params.id);
    if (!rec) return fail(res, 404, "That poll wasn't found.");
    const poll = rec.doc;
    if (poll.status !== "open" || new Date(poll.closesAt).getTime() <= Date.now()) return fail(res, 409, "This poll is closed.");
    if (poll.ward !== "all" && req.user.zone !== poll.ward) return fail(res, 403, `This poll is for residents of ${poll.ward}.`);
    const optionId = req.body?.optionId;
    if (!poll.options.some((o) => o.id === optionId)) return fail(res, 400, "Pick one of the options.");
    poll.votes = { ...(poll.votes || {}), [String(req.user._id)]: optionId };
    await saveDoc(rec);
    live.emit("community:changed", { type: "poll", id: poll.id, zone: poll.ward }, ["role:admin", "role:staff", "role:citizen"], req);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Vote error:", error);
    return fail(res, 500, "Your vote couldn't be saved. Try again.");
  }
};

/* "Fixed now" / "Still happening" on a resolved issue: one per person, the same again takes it back */
const signalIssue = async (req, res) => {
  try {
    const issue = await Issue.findOne({ publicId: req.params.id }).select("publicId status removed ward assignedTo").lean();
    if (!issue || issue.removed) return fail(res, 404, "That issue wasn't found.");
    if (issue.status !== "resolved") return fail(res, 409, "Only a fixed issue can be checked.");
    const kind = req.body?.kind;
    if (!["fixed", "still"].includes(kind)) return fail(res, 400, "Say whether it's fixed or still happening.");
    const me = String(req.user._id);
    const ref = `${issue.publicId}:${me}`;
    const had = await getDoc("signal", ref);
    if (had && had.doc.kind === kind) {
      await had.deleteOne();
    } else {
      await put("signal", { id: ref, issueId: issue.publicId, userId: me, kind, at: nowIso() }, issue.ward);
    }
    if (kind === "still" && had?.doc.kind !== "still") {
      const owner = issue.assignedTo ? await User.findById(issue.assignedTo).select("name").lean() : null;
      await record(req, { type: "still", issueId: issue.publicId, ward: issue.ward, owner: owner?.name || null, ownerId: owner ? String(owner._id) : null }, { audit: `Reported ${issue.publicId} still happening after the fix`, zone: issue.ward });
    } else {
      live.emit("community:changed", { type: "check", id: issue.publicId, zone: issue.ward }, ["role:admin", "role:staff", "role:citizen"], req);
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("Issue signal error:", error);
    return fail(res, 500, "That couldn't be saved. Try again.");
  }
};

/* ============================ official (admin + crews) ============================ */

const respondProposal = async (req, res) => {
  try {
    const rec = await getDoc("proposal", req.params.id);
    if (!rec) return fail(res, 404, "That proposal wasn't found.");
    const p = rec.doc;
    const text = String(req.body?.body || "").trim();
    if (text.length < 6) return fail(res, 400, "Write the response (6 characters or more).");
    if (text.length > 400) return fail(res, 400, "Keep the response to 400 characters.");
    if (isMash(text)) return fail(res, 400, MASH_MESSAGE);
    p.responses.push({ id: uid("rsp"), by: nameOf(req.user), byId: String(req.user._id), role: req.user.role, body: text, at: nowIso() });
    await saveDoc(rec);
    await record(req, { type: "responded", ref: p.id, ward: p.ward }, { audit: `Responded on ${p.id} · ${text.slice(0, 120)}`, zone: p.ward });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Respond error:", error);
    return fail(res, 500, "The response couldn't be saved. Try again.");
  }
};

async function createPoll(req, { question, ward, options, hours = 48, from = null }) {
  const q = clean(question);
  const opts = (Array.isArray(options) ? options : []).map(clean).filter(Boolean);
  if (q.length < 8) return { error: "Write the question (8 characters or more)." };
  if (q.length > 120) return { error: "Keep the question to 120 characters." };
  if (isMash(q, { title: true }) || opts.some((o) => isMash(o, { title: true }))) return { error: MASH_MESSAGE };
  if (opts.length < 2 || opts.length > 4) return { error: "Give 2 to 4 options." };
  if (opts.some((o) => o.length > 60)) return { error: "Keep each option to 60 characters." };
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return { error: "Each option must be different." };
  const zone = ward || "all";
  if (zone !== "all" && !CITIZEN_ZONES.includes(zone)) return { error: "Pick a zone, or every zone." };
  const h = Number(hours);
  if (!POLL_HOURS.includes(h)) return { error: "A poll runs 1, 2, 3 or 7 days." };
  const id = await nextCode("POL", 100);
  const poll = {
    id, question: q, ward: zone, from: from && from.id ? { type: from.type === "issue" ? "issue" : "proposal", id: String(from.id) } : null,
    options: opts.map((label, k) => ({ id: String.fromCharCode(97 + k), label, base: 0 })),
    votes: {}, opensAt: nowIso(), closesAt: new Date(Date.now() + h * H).toISOString(), status: "open", outcome: null,
    by: nameOf(req.user), byId: String(req.user._id), at: nowIso(),
  };
  await put("poll", poll, zone);
  await record(req, { type: "poll-opened", ref: id, ward: zone }, { audit: `Opened poll ${id} · ${zone === "all" ? "every zone" : zone} · ${q}${poll.from ? ` (from ${poll.from.id})` : ""}`, zone });
  return { id };
}

const openPoll = async (req, res) => {
  try {
    const result = await createPoll(req, req.body || {});
    if (result.error) return fail(res, 400, result.error);
    return res.status(201).json({ ok: true, id: result.id });
  } catch (error) {
    console.error("Open poll error:", error);
    return fail(res, 500, "The poll couldn't be opened. Try again.");
  }
};

const closePoll = async (req, res) => {
  try {
    const rec = await getDoc("poll", req.params.id);
    if (!rec) return fail(res, 404, "That poll wasn't found.");
    const poll = rec.doc;
    if (poll.status === "closed") return fail(res, 409, "This poll is already closed.");
    const optionId = req.body?.optionId;
    const why = clean(req.body?.note);
    if (!poll.options.some((o) => o.id === optionId)) return fail(res, 400, "Pick the outcome.");
    if (why.length < 6) return fail(res, 400, "Say what happens next (6 characters or more).");
    if (why.length > 200) return fail(res, 400, "Keep the note to 200 characters.");
    if (isMash(why)) return fail(res, 400, MASH_MESSAGE);
    poll.status = "closed";
    poll.closesAt = new Date(Math.min(Date.now(), new Date(poll.closesAt).getTime())).toISOString();
    poll.outcome = { optionId, note: why, by: nameOf(req.user), byId: String(req.user._id), at: nowIso() };
    await saveDoc(rec);
    const label = poll.options.find((o) => o.id === optionId).label;
    await record(req, { type: "poll-closed", ref: poll.id, ward: poll.ward }, { audit: `Closed poll ${poll.id} · ${label} · ${why}`, zone: poll.ward });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Close poll error:", error);
    return fail(res, 500, "The poll couldn't be closed. Try again.");
  }
};

const decideProposal = async (req, res) => {
  try {
    const rec = await getDoc("proposal", req.params.id);
    if (!rec) return fail(res, 404, "That proposal wasn't found.");
    const p = rec.doc;
    const status = req.body?.status;
    const why = clean(req.body?.reason);
    if (p.status !== "review") return fail(res, 409, "This proposal has already been decided.");
    if (!STATUS_LABEL[status] || status === "review") return fail(res, 400, "Pick a decision.");
    if (why.length < 6) return fail(res, 400, "Give the reason people will read (6 characters or more).");
    if (why.length > 240) return fail(res, 400, "Keep the reason to 240 characters.");
    if (isMash(why)) return fail(res, 400, MASH_MESSAGE);
    const decision = { status, reason: why, by: nameOf(req.user), byId: String(req.user._id), at: nowIso() };
    if (status === "poll") {
      const result = await createPoll(req, { question: req.body?.question || p.title, ward: p.ward, options: req.body?.options, hours: req.body?.hours ?? 48, from: { type: "proposal", id: p.id } });
      if (result.error) return fail(res, 400, result.error);
      decision.pollId = result.id;
    }
    if (status === "issue") {
      const issue = await fileFromProposal(p, req.body?.priority || "medium", req);
      decision.issueId = issue.publicId;
    }
    p.status = status;
    p.decision = decision;
    await saveDoc(rec);
    await record(req, { type: "decided", ref: p.id, status, ward: p.ward }, {
      audit: `Decided ${p.id}: ${STATUS_LABEL[status]}${decision.issueId ? ` → ${decision.issueId}` : ""}${decision.pollId ? ` → ${decision.pollId}` : ""} · ${why}`,
      zone: p.ward,
    });
    return res.json({ ok: true, ...decision });
  } catch (error) {
    if (error.status === 409) return fail(res, 409, error.message);
    console.error("Decide proposal error:", error);
    return fail(res, 500, "The decision couldn't be saved. Try again.");
  }
};

const announce = async (req, res) => {
  try {
    const b = req.body || {};
    const t = clean(b.title);
    const body = String(b.body || "").trim();
    const zones = Array.isArray(b.zones) ? [...new Set(b.zones)] : [];
    const citizens = b.citizens !== false;
    const staff = b.staff !== false;
    const hours = Number(b.hours || 72);
    if (t.length < 8) return fail(res, 400, "Write a title (8 characters or more).");
    if (t.length > 110 || body.length > 300) return fail(res, 400, "Keep the title to 110 and the message to 300 characters.");
    if (isMash(t, { title: true }) || (body && isMash(body))) return fail(res, 400, MASH_MESSAGE);
    if (!zones.length || zones.some((z) => z !== "all" && !CITIZEN_ZONES.includes(z))) return fail(res, 400, "Pick at least one zone.");
    if (!citizens && !staff) return fail(res, 400, "Pick who it reaches.");
    if (!Number.isFinite(hours) || hours < 24 || hours > ANNOUNCE_HOURS_MAX) return fail(res, 400, "An announcement stays up from 1 day to 2 weeks.");
    const id = await nextCode("ANN", 100);
    const a = { id, title: t, body, zones: zones.includes("all") ? ["all"] : zones, audience: { citizens, staff }, by: nameOf(req.user), byId: String(req.user._id), at: nowIso(), until: new Date(Date.now() + hours * H).toISOString(), hidden: false };
    await put("announcement", a, a.zones.join(","));
    await record(req, { type: "announced", ref: id, zones: a.zones, citizens, staff }, { audit: `Published ${id} · ${a.zones.includes("all") ? "every zone" : a.zones.join(", ")} · ${t}` });
    return res.status(201).json({ ok: true, id });
  } catch (error) {
    console.error("Announce error:", error);
    return fail(res, 500, "The announcement couldn't be published. Try again.");
  }
};

/* hide (never delete) with a fixed reason: a photo, an announcement or a work notice */
const moderate = async (req, res) => {
  try {
    const what = req.body?.what || {};
    const reason = req.body?.reason;
    if (!MODERATION_REASONS.includes(reason)) return fail(res, 400, "Pick a reason from the list.");
    const stamp = { by: nameOf(req.user), byId: String(req.user._id), at: nowIso(), reason };
    let label = "";
    let zone = "all";
    if (what.type === "photo") {
      const rec = await getDoc("proposal", String(what.proposalId || ""));
      const ph = rec?.doc.photos.find((x) => x.id === what.photoId);
      if (!ph) return fail(res, 404, "That photo wasn't found.");
      ph.hidden = stamp;
      await saveDoc(rec);
      label = `a photo on ${rec.doc.id}`;
      zone = rec.doc.ward;
    } else if (what.type === "announcement" || what.type === "notice") {
      const rec = await getDoc(what.type, String(what.id || ""));
      if (!rec) return fail(res, 404, "That item wasn't found.");
      rec.doc.hidden = stamp;
      await saveDoc(rec);
      label = rec.doc.id;
    } else return fail(res, 400, "Pick what to hide.");
    await record(req, { type: "moderated", what, reason, label, ref: what.id || what.proposalId }, { audit: `Hid ${label} · ${reason}`, zone });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Moderate error:", error);
    return fail(res, 500, "That couldn't be hidden. Try again.");
  }
};

/* ============================ field crews ============================ */

async function ownOpenFile(req, issueId) {
  const issue = await Issue.findOne({ publicId: String(issueId || "") }).select("publicId ward status removed assignedTo").lean();
  if (!issue || String(issue.assignedTo || "") !== String(req.user._id) || issue.status === "resolved" || issue.removed) return null;
  return issue;
}

const postNotice = async (req, res) => {
  try {
    const b = req.body || {};
    const issue = await ownOpenFile(req, b.issueId);
    if (!issue) return fail(res, 403, "Pick one of your own open files.");
    if (!NOTICE_KINDS.includes(b.kind)) return fail(res, 400, "Pick what's happening.");
    const a = new Date(b.from).getTime();
    const z = new Date(b.to).getTime();
    const text = String(b.note || "").trim();
    if (!Number.isFinite(a) || !Number.isFinite(z) || z <= a) return fail(res, 400, "The window must end after it starts.");
    if (z - a > 3 * D) return fail(res, 400, "Keep a notice to three days or less; post another for longer works.");
    if (z < Date.now()) return fail(res, 400, "That window is already over.");
    if (text.length > 140) return fail(res, 400, "Keep the note to 140 characters.");
    if (text && isMash(text)) return fail(res, 400, MASH_MESSAGE);
    const id = await nextCode("WN", 100);
    const n = { id, issueId: issue.publicId, ward: issue.ward, kind: b.kind, from: new Date(a).toISOString(), to: new Date(z).toISOString(), note: text, by: nameOf(req.user), byId: String(req.user._id), at: nowIso(), hidden: false };
    await put("notice", n, issue.ward);
    await record(req, { type: "notice", ref: id, ward: issue.ward, issueId: issue.publicId }, { audit: `Posted work notice ${id} on ${issue.publicId} · ${b.kind}`, zone: issue.ward });
    return res.status(201).json({ ok: true, id });
  } catch (error) {
    console.error("Notice error:", error);
    return fail(res, 500, "The notice couldn't be posted. Try again.");
  }
};

const endNotice = async (req, res) => {
  try {
    const rec = await getDoc("notice", req.params.id);
    if (!rec) return fail(res, 404, "That notice wasn't found.");
    if (rec.doc.byId !== String(req.user._id)) return fail(res, 403, "Only the crew that posted it can end it.");
    rec.doc.to = nowIso();
    await saveDoc(rec);
    live.emit("community:changed", { type: "notice", id: rec.doc.id, zone: rec.doc.ward }, ["role:admin", "role:staff", "role:citizen"], req);
    return res.json({ ok: true });
  } catch (error) {
    console.error("End notice error:", error);
    return fail(res, 500, "The notice couldn't be ended. Try again.");
  }
};

/* the crew on a closed file answers "still happening": fixed (with a note to the residents) or revisit */
const answerStill = async (req, res) => {
  try {
    const issue = await Issue.findOne({ publicId: req.params.id }).select("publicId ward status assignedTo").lean();
    const verdict = req.body?.verdict;
    const text = String(req.body?.note || "").trim();
    if (!issue || String(issue.assignedTo || "") !== String(req.user._id) || !["fixed", "revisit"].includes(verdict)) return fail(res, 403, "Only the crew on this file can answer.");
    if (text.length < 6) return fail(res, 400, "Say what you found (6 characters or more).");
    if (text.length > 200) return fail(res, 400, "Keep the note to 200 characters.");
    if (isMash(text)) return fail(res, 400, MASH_MESSAGE);
    const check = { id: uid("chk"), issueId: issue.publicId, verdict, note: text, by: nameOf(req.user), byId: String(req.user._id), at: nowIso() };
    await put("check", check, issue.ward);
    await record(req, { type: verdict === "fixed" ? "checked" : "revisit", issueId: issue.publicId, ward: issue.ward, ref: check.id }, {
      audit: verdict === "fixed" ? `Checked ${issue.publicId} after "still happening": fixed · ${text}` : `Asked to revisit ${issue.publicId} · ${text}`,
      zone: issue.ward,
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Still answer error:", error);
    return fail(res, 500, "Your answer couldn't be saved. Try again.");
  }
};

/* old trail entries are dropped after 30 days (the audit trail keeps the record) */
async function pruneTrail() {
  try {
    await CommunityRecord.deleteMany({ type: "trail", at: { $lt: new Date(Date.now() - TRAIL_DAYS * D) } });
  } catch {
    /* next time */
  }
}
setInterval(pruneTrail, 6 * H).unref?.();

module.exports = {
  getCommunity,
  propose,
  signalProposal,
  concernProposal,
  photoProposal,
  votePoll,
  signalIssue,
  respondProposal,
  openPoll,
  closePoll,
  decideProposal,
  announce,
  moderate,
  postNotice,
  endNotice,
  answerStill,
};
