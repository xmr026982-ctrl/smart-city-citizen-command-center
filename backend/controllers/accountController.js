/* ------------------------------------------------------------------
   Account and Settings (contract A4).
     GET    /users/me            PATCH /users/me          DELETE /users/me
     GET    /users/names         GET   /users/me/export
     POST   /auth/change-password       POST /auth/change-email
     POST   /auth/confirm-email (public) POST /auth/logout-all
     GET    /auth/sessions              DELETE /auth/sessions/:id
------------------------------------------------------------------- */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("../models/User");
const Session = require("../models/Session");
const Issue = require("../models/Issue");
const PasswordResetToken = require("../models/PasswordResetToken");
const { getPublicUser } = require("./authController");
const { validatePassword } = require("../utils/passwordValidator");
const { textProblem } = require("../utils/textGuard");
const { CITIZEN_ZONES } = require("../config/citizenZones");
const { writeAudit, actorFrom } = require("../services/audit");
const live = require("../services/live");
const email = require("../services/emailService");
const { disconnectSession } = require("../socket/socket");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDLE_CHOICES = { citizen: [0, 60, 240], staff: [30, 60, 240, 0], admin: [15, 30, 60] };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ZONE_GAP_MS = 30 * 24 * 60 * 60 * 1000;
const AVATAR_MAX = 64 * 1024;

const fail = (res, status, message, extra = {}) => res.status(status).json({ message, ...extra });
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
const frontend = () => String(process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");
const istDate = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(d);

/* "Chrome on Windows" from a User-Agent string */
function deviceName(ua = "") {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || "Unknown device";
}

/* end sessions (all, or all but one) and close their live connections */
async function endSessions(userId, { except = null } = {}) {
  const filter = { userId, revokedAt: null, ...(except ? { _id: { $ne: except } } : {}) };
  const sessions = await Session.find(filter).select("_id").lean();
  await Session.updateMany(filter, { $set: { revokedAt: new Date() } });
  sessions.forEach((s) => disconnectSession(String(s._id)));
  return sessions.length;
}

/* ============================ /users/me ============================ */

const getMe = async (req, res) => res.json({ user: getPublicUser(req.user) });

const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const b = req.body || {};
    const role = user.role;
    const changed = [];

    if ("displayName" in b) {
      const v = String(b.displayName ?? "").trim().replace(/\s+/g, " ");
      if (v.length > 40) return fail(res, 400, "Keep the display name to 40 characters.");
      if (v && textProblem(v, { title: true })) return fail(res, 400, textProblem(v, { title: true }));
      if (v !== (user.displayName || "")) { user.displayName = v; changed.push("display name"); }
    }

    if ("zone" in b) {
      const zone = String(b.zone || "").trim();
      if (role === "staff") return fail(res, 403, "Your base zone is set by command on the Staff Desk.");
      if (role === "admin") return fail(res, 403, "Command has no home zone.");
      if (!CITIZEN_ZONES.includes(zone)) return fail(res, 400, "Pick one of the six zones.");
      if (zone !== user.zone) {
        const last = user.zoneChangedAt ? new Date(user.zoneChangedAt).getTime() : 0;
        if (last && Date.now() - last < ZONE_GAP_MS) {
          return fail(res, 409, `You can change your home zone again on ${istDate(new Date(last + ZONE_GAP_MS))}.`);
        }
        live.moveZone(String(user._id), user.zone, zone);
        live.updateSockets(String(user._id), { zone });
        user.zone = zone;
        user.zoneChangedAt = new Date();
        changed.push("home zone");
      }
    }

    for (const key of ["designation", "office"]) {
      if (!(key in b)) continue;
      if (role !== "admin") return fail(res, 403, "Only command has a designation and office.");
      const v = String(b[key] ?? "").trim().replace(/\s+/g, " ");
      if (v.length > 60) return fail(res, 400, `Keep the ${key} to 60 characters.`);
      if (v && textProblem(v)) return fail(res, 400, textProblem(v));
      if (v !== (user[key] || "")) { user[key] = v; changed.push(key); }
    }

    if ("avatar" in b) {
      const v = String(b.avatar ?? "");
      if (v && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v)) return fail(res, 400, "The photo must be a JPEG image.");
      if (v.length > AVATAR_MAX * 1.37) return fail(res, 413, "That photo is too large. Choose a smaller one.");
      if (v !== (user.avatar || "")) { user.avatar = v; changed.push(v ? "photo" : "photo removed"); }
    }

    if (b.prefs !== undefined) {
      const p = b.prefs;
      if (!p || typeof p !== "object" || Array.isArray(p)) return fail(res, 400, "Preferences must be an object.");
      const next = { ...(user.prefs?.toObject ? user.prefs.toObject() : user.prefs || {}) };
      if ("idleSignOut" in p) {
        const v = Number(p.idleSignOut);
        if (!IDLE_CHOICES[role].includes(v)) return fail(res, 400, "That away limit isn't one of the choices.");
        next.idleSignOut = v;
        live.updateSockets(String(user._id), { idleMinutes: v });
      }
      if ("inboxMuted" in p) {
        if (!Array.isArray(p.inboxMuted) || p.inboxMuted.length > 30 || p.inboxMuted.some((x) => typeof x !== "string" || x.length > 40)) return fail(res, 400, "The muted list isn't valid.");
        next.inboxMuted = [...new Set(p.inboxMuted)];
      }
      if ("popups" in p) {
        if (!["all", "urgent", "off"].includes(p.popups)) return fail(res, 400, "Pop-ups must be all, urgent or off.");
        next.popups = p.popups;
      }
      if ("quietHours" in p) {
        if (typeof p.quietHours !== "boolean") return fail(res, 400, "Quiet hours must be on or off.");
        next.quietHours = p.quietHours;
      }
      for (const k of ["quietFrom", "quietTo"]) {
        if (!(k in p)) continue;
        if (!HHMM.test(String(p[k]))) return fail(res, 400, "Use a 24-hour time like 22:00.");
        next[k] = p[k];
      }
      user.prefs = next;
      changed.push("preferences");
    }

    await user.save();

    const id = String(user._id);
    const nameOrPhoto = changed.some((c) => ["display name", "photo", "photo removed"].includes(c));
    live.emit("profile:updated", { id, displayName: user.displayName || "", avatar: Boolean(user.avatar) }, [`user:${id}`, ...(nameOrPhoto ? ["role:admin", "role:staff"] : [])], req);
    const shown = changed.filter((c) => c !== "preferences");
    if (shown.length) await writeAudit({ ...actorFrom(req), kind: "profile", action: `Updated their account · ${shown.join(", ")}` });
    return res.json({ user: getPublicUser(user) });
  } catch (error) {
    console.error("Update account error:", error);
    return fail(res, 500, "Your account couldn't be saved. Try again.");
  }
};

/* citizens only: the account is marked removed, never deleted. Their reports stay, without their name. */
const deleteMe = async (req, res) => {
  try {
    if (req.user.role !== "citizen") return fail(res, 403, "Staff and command accounts are closed by command.");
    const user = await User.findById(req.user._id).select("+password");
    if (user.provider !== "google") {
      const pw = req.body?.password;
      if (typeof pw !== "string" || !pw || !(await bcrypt.compare(pw, user.password))) return fail(res, 400, "Your password isn't right.");
    }
    const id = String(user._id);
    user.isActive = false;
    user.name = "Former resident";
    user.displayName = "";
    user.email = `removed-${id}@account.invalid`;
    user.avatar = "";
    user.provider = "password";
    user.password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    user.removedAt = new Date();
    user.removedBy = user._id;
    await user.save();
    await PasswordResetToken.deleteMany({ userId: user._id });
    // their name also leaves the copies kept on reports
    await Issue.updateMany({ "supporters.id": user._id }, { $set: { "supporters.$[s].name": "" } }, { arrayFilters: [{ "s.id": user._id }] }).catch(() => {});
    await writeAudit({ actorId: id, role: "citizen", actor: "Former resident", kind: "auth", action: "A citizen closed their account" });
    await endSessions(user._id);
    return res.json({ message: "Your account is closed. Your reports stay on the board without your name." });
  } catch (error) {
    console.error("Delete account error:", error);
    return fail(res, 500, "Your account couldn't be closed. Try again.");
  }
};

/* GET /users/names?ids=a,b,c → { id: current display name }. Citizens see staff as Field crew, command as City Command. */
const getNames = async (req, res) => {
  try {
    const ids = String(req.query.ids || "").split(",").map((s) => s.trim()).filter((s) => mongoose.isValidObjectId(s)).slice(0, 100);
    if (!ids.length) return res.json({});
    const users = await User.find({ _id: { $in: ids } }).select("name displayName role").lean();
    const citizen = req.user.role === "citizen";
    const out = {};
    users.forEach((u) => {
      const id = String(u._id);
      if (citizen && u.role === "staff") out[id] = "Field crew";
      else if (citizen && u.role === "admin") out[id] = "City Command";
      else if (citizen && id !== String(req.user._id)) out[id] = "Citizen";
      else out[id] = u.displayName || u.name;
    });
    return res.json(out);
  } catch (error) {
    console.error("Names error:", error);
    return fail(res, 500, "Names couldn't be loaded.");
  }
};

/* GET /users/me/export: the person's own data as a JSON file */
const exportMe = async (req, res) => {
  try {
    const me = req.user;
    const filed = me.role === "citizen" ? await Issue.find({ reportedBy: me._id }).select("publicId title category ward status createdAt").lean() : [];
    const sessions = await Session.find({ userId: me._id, revokedAt: null, expiresAt: { $gt: new Date() } }).select("device createdAt lastSeenAt").lean();
    res.setHeader("Content-Disposition", 'attachment; filename="smart-kolkata-my-data.json"');
    return res.json({
      product: "Smart Kolkata",
      exportedAt: new Date().toISOString(),
      account: getPublicUser(me),
      createdAt: me.createdAt,
      reports: filed.map((i) => ({ id: i.publicId, title: i.title, category: i.category, zone: i.ward, status: i.status === "pending_review" ? "in_progress" : i.status, filedAt: i.createdAt })),
      devices: sessions.map((s) => ({ device: deviceName(s.device), signedInAt: s.createdAt, lastSeen: s.lastSeenAt })),
    });
  } catch (error) {
    console.error("Export error:", error);
    return fail(res, 500, "Your data couldn't be exported.");
  }
};

/* ============================ /auth (account security) ============================ */

const changePassword = async (req, res) => {
  try {
    if (req.user.role !== "citizen") return fail(res, 403, "Staff and command change passwords with a reset link.");
    const user = await User.findById(req.user._id).select("+password");
    if (user.provider !== "password") return fail(res, 403, "This account signs in with Google. Its password is managed by Google.");
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.password))) return fail(res, 400, "Your current password isn't right.");
    if (typeof newPassword !== "string" || newPassword === currentPassword) return fail(res, 400, "Your new password must be different from the current one.");
    const problem = validatePassword(newPassword, { role: user.role, name: user.name, email: user.email });
    if (problem) return fail(res, 422, problem);
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    const ended = await endSessions(user._id, { except: req.session._id });
    await writeAudit({ ...actorFrom(req), kind: "auth", action: "Changed their password" });
    return res.json({ message: ended ? `Password changed. ${ended} other device${ended === 1 ? " was" : "s were"} signed out.` : "Password changed." });
  } catch (error) {
    console.error("Change password error:", error);
    return fail(res, 500, "Your password couldn't be changed. Try again.");
  }
};

const changeEmail = async (req, res) => {
  try {
    if (req.user.role !== "citizen") return fail(res, 403, "Staff and command emails are changed by command.");
    const user = await User.findById(req.user._id).select("+password");
    if (user.provider !== "password") return fail(res, 403, "This account signs in with Google, so its email comes from Google.");
    const newEmail = String(req.body?.newEmail || "").trim().toLowerCase();
    if (!EMAIL_RE.test(newEmail) || newEmail.length > 254) return fail(res, 400, "Enter a valid email address.");
    if (newEmail === user.email) return fail(res, 400, "That's already your email address.");
    const pw = req.body?.password;
    if (typeof pw !== "string" || !(await bcrypt.compare(pw, user.password))) return fail(res, 400, "Your password isn't right.");
    if (await User.exists({ email: newEmail })) return fail(res, 409, "That email is already in use.");
    if (!email.emailConfigured()) return fail(res, 503, "Email can't be sent right now, so the address can't be changed. Try again later.");

    await PasswordResetToken.deleteMany({ userId: user._id, kind: "email" });
    const raw = crypto.randomBytes(32).toString("hex");
    await PasswordResetToken.create({ userId: user._id, kind: "email", newEmail, tokenHash: sha(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    try {
      await email.sendEmailChangeLink({ name: user.displayName || user.name, newEmail, url: `${frontend()}/confirm-email?token=${raw}` });
    } catch (err) {
      await PasswordResetToken.deleteOne({ tokenHash: sha(raw) });
      console.error("Email change link not sent:", err.message);
      return fail(res, 503, "The confirmation email couldn't be sent. Try again later.");
    }
    return res.json({ message: `We sent a link to ${newEmail}. Your email changes when you open it (within 24 hours).` });
  } catch (error) {
    console.error("Change email error:", error);
    return fail(res, 500, "The email change couldn't be started. Try again.");
  }
};

const confirmEmail = async (req, res) => {
  try {
    const raw = String(req.body?.token || "");
    if (!/^[a-f0-9]{64}$/i.test(raw)) return fail(res, 400, "This link isn't valid or has expired.");
    const record = await PasswordResetToken.findOne({ tokenHash: sha(raw), kind: "email", expiresAt: { $gt: new Date() } });
    if (!record) return fail(res, 400, "This link isn't valid or has expired.");
    const user = await User.findById(record.userId);
    if (!user || !user.isActive) {
      await record.deleteOne();
      return fail(res, 400, "This link isn't valid or has expired.");
    }
    if (await User.exists({ email: record.newEmail, _id: { $ne: user._id } })) {
      await record.deleteOne();
      return fail(res, 409, "That email is already in use.");
    }
    const oldEmail = user.email;
    user.email = record.newEmail;
    await user.save();
    await PasswordResetToken.deleteMany({ userId: user._id, kind: "email" });
    await writeAudit({ actorId: user._id, role: user.role, actor: user.name, kind: "auth", action: "Changed their email address" });
    email.sendEmailChangedNotice({ name: user.displayName || user.name, oldEmail, newEmail: user.email }).catch((e) => console.error("Email-changed notice not sent:", e.message));
    live.emit("profile:updated", { id: String(user._id), displayName: user.displayName || "", avatar: Boolean(user.avatar) }, [`user:${user._id}`]);
    return res.json({ user: getPublicUser(user), message: "Your email is changed. Use the new address to sign in." });
  } catch (error) {
    console.error("Confirm email error:", error);
    return fail(res, 500, "The email couldn't be changed. Try again.");
  }
};

const logoutAll = async (req, res) => {
  try {
    const n = await endSessions(req.user._id);
    await writeAudit({ ...actorFrom(req), kind: "auth", action: `Signed out everywhere · ${n} device${n === 1 ? "" : "s"}` });
    return res.json({ message: "Signed out on every device." });
  } catch (error) {
    console.error("Logout all error:", error);
    return fail(res, 500, "That didn't work. Try again.");
  }
};

/* live sessions only: not revoked, not expired, not idle past the person's limit */
const listSessions = async (req, res) => {
  try {
    const user = req.user;
    const idle = user.prefs?.idleSignOut ?? (user.role === "admin" ? 30 : user.role === "staff" ? 60 : 0);
    const now = Date.now();
    const rows = await Session.find({ userId: user._id, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).lean();
    const sessions = rows
      .filter((s) => !idle || now - new Date(s.lastActiveAt || s.createdAt).getTime() <= idle * 60000)
      .map((s) => ({
        id: String(s._id),
        device: deviceName(s.device),
        lastSeen: s.lastSeenAt || s.createdAt,
        createdAt: s.createdAt,
        current: String(s._id) === String(req.session._id),
      }));
    return res.json({ sessions });
  } catch (error) {
    console.error("Sessions error:", error);
    return fail(res, 500, "Devices couldn't be listed.");
  }
};

const revokeSession = async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) return fail(res, 404, "That device wasn't found.");
    const result = await Session.updateOne({ _id: id, userId: req.user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    if (!result.matchedCount) return fail(res, 404, "That device wasn't found.");
    disconnectSession(id);
    await writeAudit({ ...actorFrom(req), kind: "auth", action: "Signed out one of their devices" });
    return res.json({ message: "That device is signed out." });
  } catch (error) {
    console.error("Revoke session error:", error);
    return fail(res, 500, "That device couldn't be signed out.");
  }
};

module.exports = {
  getMe,
  updateMe,
  deleteMe,
  getNames,
  exportMe,
  changePassword,
  changeEmail,
  confirmEmail,
  logoutAll,
  listSessions,
  revokeSession,
  endSessions,
  deviceName,
};
