/* ------------------------------------------------------------------
   Field clearance requests (contract A3 + B1).
   Public:  POST /staff-requests · GET /staff-requests/setup?token= · POST /staff-requests/set-password
   Admin:   GET /staff-requests?status= · PATCH /:id/approve · PATCH /:id/reject · POST /:id/resend-setup
   The application answers the same whether or not the email already has
   an account or a request, so nobody can test which emails exist.
------------------------------------------------------------------- */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const StaffRequest = require("../models/StaffRequest");
const User = require("../models/User");
const { validatePassword } = require("../utils/passwordValidator");
const { textProblem } = require("../utils/textGuard");
const { CITIZEN_ZONES } = require("../config/citizenZones");
const { sendStaffPasswordSetupEmail, sendStaffRejectionEmail } = require("../services/emailService");
const { writeAudit, actorFrom } = require("../services/audit");
const live = require("../services/live");

const EXPERTISE = ["electrical", "roads", "waste", "water", "civic"];
const EXPERTISE_LABEL = { electrical: "Electrician", roads: "Road Works", waste: "Waste", water: "Water & Drainage", civic: "Civic General" };
const EXPERIENCE = ["Field Active", "2 Years", "5 Years", "10 Years", "Senior Field"];
const RANKS = ["Field Operative", "Specialist", "Senior Specialist", "Zone Lead", "Command Fellow"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK_MS = 24 * 60 * 60 * 1000;
const SAME_ANSWER = "Your request is in. If command clears you, a one-time setup link comes to your email.";

const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const fail = (res, status, message) => res.status(status).json({ message });
const frontend = () => String(process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");

/* the clearance request as the Staff Desk reads it */
const shape = (r) => ({
  id: String(r._id),
  name: r.name,
  email: r.email,
  zone: r.zone,
  expertise: r.expertise,
  experience: r.experience,
  note: r.note || "",
  filedAt: r.createdAt,
  status: r.status,
  rank: r.rank || "",
  linkSentAt: r.linkSentAt || null,
  linkStatus: r.linkStatus || "",
});

const snapshot = (r, extra = {}) => ({ id: `req-${r._id}`, name: r.name, email: r.email, rank: r.rank || "", expertise: r.expertise, zone: r.zone, experience: r.experience, ...extra });

/* a fresh one-time link (any older one stops working) and the email */
async function sendLink(request) {
  const raw = crypto.randomBytes(32).toString("hex");
  request.setupTokenHash = sha(raw);
  request.setupTokenExpiresAt = new Date(Date.now() + LINK_MS);
  let sent = false;
  try {
    await sendStaffPasswordSetupEmail({ name: request.name, email: request.email, rank: request.rank, setupUrl: `${frontend()}/staff-setup?token=${raw}` });
    sent = true;
  } catch (error) {
    console.error("Staff setup email not sent:", error.message);
  }
  request.linkSentAt = sent ? new Date() : request.linkSentAt;
  request.linkStatus = sent ? "sent" : "failed";
  await request.save();
  return sent;
}

/* ============================ public ============================ */

const submitStaffRequest = async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || "").trim().replace(/\s+/g, " ");
    const email = String(b.email || "").trim().toLowerCase();
    const note = String(b.note || "").trim();

    const nameProblem = textProblem(name, { min: 3, what: "your full name", title: true });
    if (nameProblem) return fail(res, 400, nameProblem);
    if (name.length > 60) return fail(res, 400, "Keep the name to 60 characters.");
    if (!EMAIL_RE.test(email) || email.length > 254) return fail(res, 400, "Enter a valid email address.");
    if (!EXPERTISE.includes(b.expertise)) return fail(res, 400, "Pick your expertise.");
    if (!EXPERIENCE.includes(b.experience)) return fail(res, 400, "Pick your field experience.");
    if (!CITIZEN_ZONES.includes(b.zone)) return fail(res, 400, "Pick the zone you'd work in.");
    if (note.length > 280) return fail(res, 400, "Keep the note to 280 characters.");
    if (note && textProblem(note)) return fail(res, 400, textProblem(note));

    // already an account, or a request already open: same answer, nothing changes
    if (await User.exists({ email })) return res.status(201).json({ message: SAME_ANSWER });
    const existing = await StaffRequest.findOne({ email });
    if (existing && existing.status !== "rejected") return res.status(201).json({ message: SAME_ANSWER });

    const fields = { name, email, experience: b.experience, expertise: b.expertise, zone: b.zone, note, status: "pending" };
    // a rejected person may apply again: a new request, filed now (the old decision stays in the audit trail)
    if (existing) await existing.deleteOne();
    const request = await StaffRequest.create(fields);
    live.emit("staff:changed", { id: `req-${request._id}`, actorId: null }, ["role:admin"]);
    return res.status(201).json({ message: SAME_ANSWER });
  } catch (error) {
    if (error.code === 11000) return res.status(201).json({ message: SAME_ANSWER });
    console.error("Staff application error:", error);
    return fail(res, 500, "Your request couldn't be sent. Try again.");
  }
};

async function findByToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return StaffRequest.findOne({ setupTokenHash: sha(token), setupTokenExpiresAt: { $gt: new Date() }, status: "approved" });
}

const getStaffSetupInfo = async (req, res) => {
  try {
    const request = await findByToken(req.query.token);
    if (!request) return fail(res, 400, "This setup link isn't valid, has expired or was already used. Ask command for a new one.");
    return res.json({ request: { name: request.name, email: request.email, rank: request.rank || "Field Operative", expertise: request.expertise, zone: request.zone, experience: request.experience } });
  } catch (error) {
    console.error("Staff setup info error:", error);
    return fail(res, 500, "The setup link couldn't be checked. Try again.");
  }
};

const setStaffPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    const request = await findByToken(token);
    if (!request) return fail(res, 400, "This setup link isn't valid, has expired or was already used. Ask command for a new one.");
    const problem = validatePassword(password, { role: "staff", name: request.name, email: request.email });
    if (problem) return fail(res, 422, problem);
    if (await User.exists({ email: request.email })) return fail(res, 409, "An account already exists for this email. Sign in on the staff desk.");

    const user = await User.create({
      name: request.name,
      email: request.email,
      password: await bcrypt.hash(password, 12),
      role: "staff",
      provider: "password",
      zone: request.zone,
      expertise: request.expertise,
      rank: RANKS.includes(request.rank) ? request.rank : "Field Operative",
      experience: request.experience,
      verified: false,
      dutyStatus: "off",
      prefs: { idleSignOut: 60 },
      requestId: request._id,
      requestedAt: request.createdAt,
      acceptedAt: request.decidedAt,
      isActive: true,
    });
    request.status = "completed";
    request.setupTokenHash = undefined;
    request.setupTokenExpiresAt = undefined;
    await request.save();
    await writeAudit({ actorId: user._id, role: "staff", actor: user.name, kind: "desk", verb: "key", action: `${user.name} set up their staff account`, subject: snapshot(request, { id: String(user._id) }) });
    live.emit("staff:changed", { id: String(user._id) }, ["role:admin"]);
    return res.status(201).json({ message: "Your password is set. Sign in on the staff desk." });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, "An account already exists for this email. Sign in on the staff desk.");
    console.error("Staff password setup error:", error);
    return fail(res, 500, "Your account couldn't be set up. Try again.");
  }
};

/* ============================ admin ============================ */

const getStaffRequests = async (req, res) => {
  try {
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : "pending";
    const filter = status === "all" ? {} : { status };
    const rows = await StaffRequest.find(filter).sort({ createdAt: -1 }).lean();
    const items = rows.map(shape);
    return res.json({ items, total: items.length });
  } catch (error) {
    console.error("Get staff requests error:", error);
    return fail(res, 500, "Clearance requests couldn't be loaded.");
  }
};

async function loadRequest(req, res) {
  const id = String(req.params.id || "").replace(/^req-/, "");
  if (!mongoose.isValidObjectId(id)) { fail(res, 404, "That request wasn't found."); return null; }
  const request = await StaffRequest.findById(id).select("+setupTokenHash +setupTokenExpiresAt");
  if (!request) { fail(res, 404, "That request wasn't found."); return null; }
  return request;
}

const approveStaffRequest = async (req, res) => {
  try {
    const request = await loadRequest(req, res);
    if (!request) return;
    if (request.status !== "pending") return fail(res, 409, "This request was already decided.");
    const b = req.body || {};
    const rank = b.rank === undefined ? "Field Operative" : b.rank;
    if (!RANKS.includes(rank)) return fail(res, 400, "Pick a rank.");
    if (b.expertise !== undefined && !EXPERTISE.includes(b.expertise)) return fail(res, 400, "Pick an expertise.");
    if (b.zone !== undefined && !CITIZEN_ZONES.includes(b.zone)) return fail(res, 400, "Pick one of the six zones.");
    if (await User.exists({ email: request.email })) return fail(res, 409, "This email already has an account. Reject the request instead.");

    request.status = "approved";
    request.rank = rank;
    if (b.expertise) request.expertise = b.expertise;
    if (b.zone) request.zone = b.zone;
    request.decidedAt = new Date();
    request.decidedBy = req.user._id;
    const sent = await sendLink(request);

    await writeAudit({ ...actorFrom(req), kind: "desk", verb: "cleared", action: `Cleared ${request.name} as ${rank} · ${EXPERTISE_LABEL[request.expertise]} · ${request.zone}`, subject: snapshot(request, { acceptedAt: request.decidedAt }) });
    if (!sent) await writeAudit({ role: "system", actor: "System", kind: "desk", verb: "key", action: `Activation key for ${request.name} was not sent`, subject: snapshot(request) });
    live.emit("staff:changed", { id: `req-${request._id}` }, ["role:admin"], req);
    return res.json({ request: shape(request), sent });
  } catch (error) {
    console.error("Approve staff request error:", error);
    return fail(res, 500, "The request couldn't be approved. Try again.");
  }
};

const rejectStaffRequest = async (req, res) => {
  try {
    const request = await loadRequest(req, res);
    if (!request) return;
    if (request.status !== "pending") return fail(res, 409, "This request was already decided.");
    const reason = String(req.body?.reason || "").trim();
    if (reason && textProblem(reason)) return fail(res, 400, textProblem(reason));
    request.status = "rejected";
    request.reason = reason.slice(0, 280);
    request.decidedAt = new Date();
    request.decidedBy = req.user._id;
    request.setupTokenHash = undefined;
    request.setupTokenExpiresAt = undefined;
    await request.save();
    await writeAudit({ ...actorFrom(req), kind: "desk", verb: "rejected", action: `Rejected clearance for ${request.name} · ${EXPERTISE_LABEL[request.expertise]} · ${request.zone}`, subject: snapshot(request, { filedAt: request.createdAt, note: request.note || "" }) });
    sendStaffRejectionEmail({ name: request.name, email: request.email }).catch((e) => console.error("Rejection email not sent:", e.message));
    live.emit("staff:changed", { id: `req-${request._id}` }, ["role:admin"], req);
    return res.json({ request: shape(request) });
  } catch (error) {
    console.error("Reject staff request error:", error);
    return fail(res, 500, "The request couldn't be rejected. Try again.");
  }
};

const resendSetupLink = async (req, res) => {
  try {
    const request = await loadRequest(req, res);
    if (!request) return;
    if (request.status !== "approved") return fail(res, 409, request.status === "completed" ? "They already set up their account." : "Only an approved request has a setup link.");
    const sent = await sendLink(request);
    await writeAudit({ ...actorFrom(req), kind: "desk", verb: "key", action: sent ? `Sent ${request.name} a new activation key` : `Activation key for ${request.name} was not sent`, subject: snapshot(request) });
    live.emit("staff:changed", { id: `req-${request._id}` }, ["role:admin"], req);
    if (!sent) return fail(res, 503, "The email couldn't be sent. Check the server's email settings and try again.");
    return res.json({ request: shape(request), sent });
  } catch (error) {
    console.error("Resend setup error:", error);
    return fail(res, 500, "A new link couldn't be sent. Try again.");
  }
};

module.exports = {
  submitStaffRequest,
  getStaffRequests,
  approveStaffRequest,
  rejectStaffRequest,
  resendSetupLink,
  getStaffSetupInfo,
  setStaffPassword,
  RANKS,
  EXPERTISE,
  EXPERTISE_LABEL,
};
