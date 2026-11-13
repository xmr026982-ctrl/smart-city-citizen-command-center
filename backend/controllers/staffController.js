/* ------------------------------------------------------------------
   Staff Desk roster (contract B1). The roster IS the staff accounts,
   plus people command cleared who haven't set up their account yet
   ("awaiting uplink", id "req-<request id>").
     GET    /staff                    admin
     PATCH  /staff/:id/rank           admin  { rank }
     PATCH  /staff/:id/verify         admin  { verified }
     PATCH  /staff/:id/zone           admin  { zone }
     DELETE /staff/:id                admin  marks inactive, ends sessions, returns open files to dispatch
     PATCH  /staff/me/duty            staff, admin  { dutyStatus }
   Load and closed counts are counted on the client from the issue board.
------------------------------------------------------------------- */
const mongoose = require("mongoose");
const User = require("../models/User");
const StaffRequest = require("../models/StaffRequest");
const { CITIZEN_ZONES } = require("../config/citizenZones");
const { RANKS, EXPERTISE_LABEL } = require("./staffRequestController");
const { releaseIssuesOf } = require("./issueController");
const { endSessions } = require("./accountController");
const { getPublicUser } = require("./authController");
const { writeAudit, actorFrom } = require("../services/audit");
const live = require("../services/live");

const DUTY_LABEL = { on: "on duty", break: "on break", off: "off duty" };
const fail = (res, status, message) => res.status(status).json({ message });

const rosterEntry = (u) => ({
  id: String(u._id),
  name: u.name,
  displayName: u.displayName || "",
  email: u.email,
  rank: u.rank || "Field Operative",
  expertise: u.expertise || "civic",
  experience: u.experience || "",
  verified: Boolean(u.verified),
  zone: u.zone || "",
  duty: u.dutyStatus || "off",
  onDuty: u.dutyStatus === "on",
  closedPrior: u.closedPrior || 0,
  uplink: "live",
  dispatch: "sent",
  requestId: u.requestId ? String(u.requestId) : "",
  requestedAt: u.requestedAt || null,
  acceptedAt: u.acceptedAt || null,
  keySentAt: u.acceptedAt || null,
  uplinkedAt: u.uplinkedAt || null,
});

const awaitingEntry = (r) => ({
  id: `req-${r._id}`,
  requestId: String(r._id),
  name: r.name,
  displayName: "",
  email: r.email,
  rank: r.rank || "Field Operative",
  expertise: r.expertise,
  experience: r.experience,
  note: r.note || "",
  verified: false,
  zone: r.zone,
  duty: "off",
  onDuty: false,
  closedPrior: 0,
  uplink: "awaiting",
  dispatch: r.linkStatus === "failed" ? "failed" : "sent",
  requestedAt: r.createdAt,
  acceptedAt: r.decidedAt,
  keySentAt: r.linkSentAt,
  uplinkedAt: null,
});

const snap = (p, extra = {}) => ({ id: p.id, name: p.name, email: p.email || "", rank: p.rank || "", expertise: p.expertise, zone: p.zone, experience: p.experience || "", ...extra });

const getStaff = async (_req, res) => {
  try {
    const [users, waiting] = await Promise.all([
      User.find({ role: "staff", isActive: true }).sort({ createdAt: -1 }).lean(),
      StaffRequest.find({ status: "approved" }).sort({ decidedAt: -1 }).lean(),
    ]);
    const items = [...waiting.map(awaitingEntry), ...users.map(rosterEntry)];
    return res.json({ items, total: items.length });
  } catch (error) {
    console.error("Roster error:", error);
    return fail(res, 500, "The roster couldn't be loaded.");
  }
};

/* a live staff account, or a cleared request still awaiting uplink */
async function target(req, res) {
  const id = String(req.params.id || "");
  if (id.startsWith("req-")) {
    const rid = id.slice(4);
    const request = mongoose.isValidObjectId(rid) ? await StaffRequest.findOne({ _id: rid, status: "approved" }) : null;
    if (!request) { fail(res, 404, "That person isn't on the roster."); return null; }
    return { request, entry: awaitingEntry(request) };
  }
  const user = mongoose.isValidObjectId(id) ? await User.findOne({ _id: id, role: "staff", isActive: true }) : null;
  if (!user) { fail(res, 404, "That person isn't on the roster."); return null; }
  return { user, entry: rosterEntry(user) };
}

function changed(req, id) {
  live.emit("staff:changed", { id }, ["role:admin", id.startsWith("req-") ? null : `user:${id}`], req);
}

const setRank = async (req, res) => {
  try {
    const t = await target(req, res);
    if (!t) return;
    const rank = req.body?.rank;
    if (!RANKS.includes(rank)) return fail(res, 400, "Pick a rank.");
    const before = t.entry.rank;
    if (before === rank) return res.json({ person: t.entry });
    if (t.user) { t.user.rank = rank; await t.user.save(); } else { t.request.rank = rank; await t.request.save(); }
    const up = RANKS.indexOf(rank) > RANKS.indexOf(before);
    const person = t.user ? rosterEntry(t.user) : awaitingEntry(t.request);
    await writeAudit({ ...actorFrom(req), kind: "desk", verb: "rank", action: `${up ? "Promoted" : "Moved"} ${person.name} ${up ? "to" : "back to"} ${rank}`, subject: snap(person) });
    changed(req, person.id);
    return res.json({ person });
  } catch (error) {
    console.error("Rank error:", error);
    return fail(res, 500, "The rank couldn't be changed. Try again.");
  }
};

const setVerified = async (req, res) => {
  try {
    const t = await target(req, res);
    if (!t) return;
    const on = req.body?.verified;
    if (typeof on !== "boolean") return fail(res, 400, "Say whether they're verified (true or false).");
    if (!t.user) return fail(res, 409, "The Verified badge unlocks after their first sign-in.");
    if (Boolean(t.user.verified) === on) return res.json({ person: t.entry });
    t.user.verified = on;
    await t.user.save();
    const person = rosterEntry(t.user);
    await writeAudit({ ...actorFrom(req), kind: "desk", verb: "verify", action: on ? `Gave ${person.name} the Verified badge` : `Removed the Verified badge from ${person.name}`, subject: snap(person) });
    changed(req, person.id);
    return res.json({ person });
  } catch (error) {
    console.error("Verify error:", error);
    return fail(res, 500, "That couldn't be saved. Try again.");
  }
};

const setZone = async (req, res) => {
  try {
    const t = await target(req, res);
    if (!t) return;
    const zone = req.body?.zone;
    if (!CITIZEN_ZONES.includes(zone)) return fail(res, 400, "Pick one of the six zones.");
    const before = t.entry.zone;
    if (before === zone) return res.json({ person: t.entry });
    if (t.user) {
      t.user.zone = zone;
      await t.user.save();
      live.moveZone(String(t.user._id), before, zone);
      live.updateSockets(String(t.user._id), { zone });
      live.coverageChanged(req);
    } else {
      t.request.zone = zone;
      await t.request.save();
    }
    const person = t.user ? rosterEntry(t.user) : awaitingEntry(t.request);
    await writeAudit({ ...actorFrom(req), kind: "desk", verb: "zone", action: `Moved ${person.name}'s base zone from ${before} to ${zone}`, subject: snap(person) });
    changed(req, person.id);
    if (t.user) live.emit("profile:updated", { id: person.id, displayName: t.user.displayName || "", avatar: Boolean(t.user.avatar) }, [`user:${person.id}`], req);
    return res.json({ person });
  } catch (error) {
    console.error("Zone error:", error);
    return fail(res, 500, "The base zone couldn't be changed. Try again.");
  }
};

/* never deletes: marks inactive, ends sessions, returns open files to dispatch */
const removeStaff = async (req, res) => {
  try {
    const t = await target(req, res);
    if (!t) return;
    if (t.request) {
      // cleared but never set up: the link stops working, the request closes
      t.request.status = "rejected";
      t.request.reason = "Removed before setup";
      t.request.setupTokenHash = undefined;
      t.request.setupTokenExpiresAt = undefined;
      await t.request.save();
      await writeAudit({ ...actorFrom(req), kind: "desk", verb: "removed", action: `Removed ${t.entry.name} from the field`, subject: snap(t.entry, { closed: 0, released: 0, verified: false, acceptedAt: t.entry.acceptedAt, uplinked: false }) });
      changed(req, t.entry.id);
      return res.json({ released: 0 });
    }
    const user = t.user;
    const person = rosterEntry(user);
    const Issue = require("../models/Issue");
    const closed = (user.closedPrior || 0) + (await Issue.countDocuments({ assignedTo: user._id, status: "resolved" }));
    const released = await releaseIssuesOf(user, req);
    user.isActive = false;
    user.dutyStatus = "off";
    user.removedAt = new Date();
    user.removedBy = req.user._id;
    await user.save();
    await endSessions(user._id);
    live.coverageChanged(req);
    await writeAudit({
      ...actorFrom(req), kind: "desk", verb: "removed",
      action: `Removed ${person.name} from the field${released ? ` · ${released} open issue${released === 1 ? "" : "s"} returned to dispatch` : ""}`,
      subject: snap(person, { closed, released, verified: person.verified, acceptedAt: person.acceptedAt, uplinked: true }),
    });
    changed(req, person.id);
    return res.json({ released });
  } catch (error) {
    console.error("Remove staff error:", error);
    return fail(res, 500, "They couldn't be removed. Try again.");
  }
};

const setMyDuty = async (req, res) => {
  try {
    const status = req.body?.dutyStatus;
    if (!DUTY_LABEL[status]) return fail(res, 400, "Duty must be on, break or off.");
    const user = await User.findById(req.user._id);
    if (user.dutyStatus !== status) {
      user.dutyStatus = status;
      await user.save();
      const id = String(user._id);
      if (user.role === "staff") {
        await writeAudit({ ...actorFrom(req), kind: "desk", verb: "duty", action: `${user.name} is ${DUTY_LABEL[status]}`, subject: snap(rosterEntry(user)) });
      }
      live.emit("staff:duty", { id, onDuty: status === "on", duty: status }, ["role:admin", `user:${id}`], req);
      if (user.role === "staff") live.coverageChanged(req);
    }
    return res.json({ user: getPublicUser(user) });
  } catch (error) {
    console.error("Duty error:", error);
    return fail(res, 500, "Your duty status couldn't be saved. Try again.");
  }
};

/* GET /staff/coverage (any signed-in role): how many crews are on duty, by zone and expertise.
   Counts only: no names, no ids. Citizens see it when filing a report. */
const getCoverage = async (_req, res) => {
  try {
    const rows = await User.aggregate([
      { $match: { role: "staff", isActive: true, dutyStatus: "on" } },
      { $group: { _id: { zone: "$zone", expertise: "$expertise" }, onDuty: { $sum: 1 } } },
    ]);
    return res.json({ items: rows.map((r) => ({ zone: r._id.zone || "", expertise: r._id.expertise || "", onDuty: r.onDuty })) });
  } catch (error) {
    console.error("Coverage error:", error);
    return fail(res, 500, "Crew coverage couldn't be loaded.");
  }
};

module.exports = { getCoverage, getStaff, setRank, setVerified, setZone, removeStaff, setMyDuty, EXPERTISE_LABEL };
