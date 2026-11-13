const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User");
const Session = require("../models/Session");
const PasswordResetToken = require("../models/PasswordResetToken");

const { generateToken } = require("../services/jwtService");
const { sendSignedIn, clearSessionCookie, sessionInfo, setSessionCookie } = require("../utils/sessionCookie");
const { validatePassword } = require("../utils/passwordValidator");
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");
const { adminAuth } = require("../config/firebaseAdmin");
const { isValidCitizenZone } = require("../config/citizenZones");
const { writeAudit } = require("../services/audit");
const live = require("../services/live");

// =========================
// HELPERS
// =========================

const getPublicUser = (user) => {
  const base = {
    id: String(user._id),
    name: user.name,
    displayName: user.displayName || "",
    email: user.email,
    role: user.role,
    zone: user.zone || "",
    provider: user.provider || "password",
    avatar: user.avatar || "",
    prefs: {
  idleSignOut:
    user.prefs?.idleSignOut ??
    (user.role === "admin" ? 30 :
      user.role === "staff" ? 60 : 0),

  inboxMuted: user.prefs?.inboxMuted || [],
  popups: user.prefs?.popups || "all",
  quietHours: user.prefs?.quietHours ?? false,
  quietFrom: user.prefs?.quietFrom || "22:00",
  quietTo: user.prefs?.quietTo || "07:00",
},
    zoneChangedAt: user.zoneChangedAt || null,
  };

  if (user.role === "staff" || user.role === "admin") {
    base.dutyStatus = user.dutyStatus || "off";
  }

  if (user.role === "admin") {
    base.designation = user.designation || "";
    base.office = user.office || "";
  }

  if (user.role === "staff") {
    base.expertise = user.expertise || "";
    base.rank = user.rank || "";
    base.experience = user.experience || "";
    base.verified = user.verified === true;
  }

  return base;
};

const normalizeZone = (zone) =>
  typeof zone === "string" ? zone.trim() : "";

const validateCitizenZone = (zone) =>
  typeof zone === "string" && isValidCitizenZone(zone.trim());

const isMissingOrInvalidZone = (zone) => !validateCitizenZone(zone);

const getDevice = (req) => {
  const ua = req.headers["user-agent"] || "Unknown device";
  return ua.substring(0, 180);
};

const ROLE_SESSION_MS = {
  citizen: 30 * 24 * 60 * 60 * 1000, // 30 days
  staff: 24 * 60 * 60 * 1000,        // 24 hours
  admin: 12 * 60 * 60 * 1000,        // 12 hours
};

const createSession = async (user, req) => {
  const expiresAt = new Date(Date.now() + (ROLE_SESSION_MS[user.role] || ROLE_SESSION_MS.citizen));

  const session = await Session.create({
    userId: user._id,
    role: user.role,
    device: getDevice(req),
    lastActiveAt: new Date(),
    lastSeenAt: new Date(),
    expiresAt,
  });

  return session;
};

const safeLoginMessage = "Email or password is incorrect for this desk.";

// =========================
// REGISTER (citizen only)
// POST /api/auth/register
// =========================

const register = async (req, res) => {
  try {
    const { name, email, password, zone } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string"
    ) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    const passwordError = validatePassword(password, {
      role: "citizen",
      name,
      email,
    });
    if (passwordError) {
      return res.status(422).json({ message: passwordError });
    }

    const selectedZone = normalizeZone(zone);
    if (!validateCitizenZone(selectedZone)) {
      return res.status(400).json({ message: "Please select a valid citizen zone." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: "citizen",
      zone: selectedZone,
      provider: "password",
      isActive: true,
      prefs: { idleSignOut: 0 },
    });

    // Welcome email never blocks or slows the sign-up
    sendWelcomeEmail(user).catch((err) => console.error("[Register] Welcome email not sent:", err.message));

    const session = await createSession(user, req);
    const token = generateToken(
      user,
      session._id,
      session.expiresAt
    );

    return sendSignedIn(req, res, 201, { token, session, user: getPublicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.error("[Register] Error:", error.message);
    return res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// =========================
// LOGIN
// POST /api/auth/login
// =========================

const login = async (req, res) => {
  try {
    const { email, password, role, zone } = req.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password ||
      typeof role !== "string" ||
      !role.trim()
    ) {
      return res.status(400).json({ message: "Email, password and role are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase() === "user" ? "citizen" : role.trim().toLowerCase();

    if (!["citizen", "staff", "admin"].includes(normalizedRole)) {
      return res.status(401).json({ message: safeLoginMessage });
    }

    const user = await User.findOne({
      email: normalizedEmail,
      role: normalizedRole,
    }).select("+password +failedLoginAttempts +lockUntil");

    // Uniform failure response
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: safeLoginMessage });
    }

    // Lockout check
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({
        message: "Too many wrong tries. Try again after 15 minutes.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

  if (user.failedLoginAttempts >= 5) {
    user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    user.failedLoginAttempts = 0;

    await user.save();

    return res.status(429).json({
      message: "Too many wrong tries. Try again after 15 minutes.",
    });
  }

  await user.save();

  return res.status(401).json({
    message: safeLoginMessage,
  });
}

    // Successful login → clear lockout counters
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Citizen zone handling (only fill missing zone)
    if (user.role === "citizen") {
      const selectedZone = normalizeZone(zone);

      if (selectedZone) {
        if (!validateCitizenZone(selectedZone)) {
          return res.status(400).json({ message: "Please select a valid citizen zone." });
        }
        // Only set zone if it is currently missing
        if (isMissingOrInvalidZone(user.zone)) {
          user.zone = selectedZone;
          user.zoneChangedAt = new Date();
          await user.save();
        }
      } else if (isMissingOrInvalidZone(user.zone)) {
        return res.status(200).json({
          requiresZone: true,
          email: user.email,
        });
      }
    }

    // a cleared staff member's first sign-in: the Staff Desk shows them as uplinked
    if (user.role === "staff" && !user.uplinkedAt) {
      user.uplinkedAt = new Date();
      user.dutyStatus = "on";
      await user.save();
      await writeAudit({ actorId: user._id, role: "staff", actor: user.name, kind: "desk", verb: "uplink", action: `${user.name} uplinked (first sign-in)`, subject: { id: String(user._id), name: user.name, email: user.email, rank: user.rank, expertise: user.expertise, zone: user.zone, experience: user.experience } });
      live.emit("staff:changed", { id: String(user._id), actorId: String(user._id) }, ["role:admin"]);
      live.coverageChanged();
    }

    const session = await createSession(user, req);
    const token = generateToken(user, session._id, session.expiresAt);

    return sendSignedIn(req, res, 200, { token, session, user: getPublicUser(user) });
  } catch (error) {
    console.error("[Login] Error:", error.message);
    return res.status(500).json({ message: "Login failed. Please try again." });
  }
};

// =========================
// GOOGLE LOGIN / SIGNUP (citizens only)
// POST /api/auth/google
// =========================

const googleLogin = async (req, res) => {
  try {
    const { idToken, zone } = req.body || {};

    if (typeof idToken !== "string" || !idToken.trim()) {
      return res.status(400).json({ message: "Google ID token is required." });
    }

    if (!adminAuth) {
      return res.status(503).json({ message: "Google sign-in isn't available right now. Use your email and password." });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    if (!decoded.email || decoded.email_verified !== true) {
      return res.status(401).json({ message: "Please use a verified Google email address." });
    }

    const email = decoded.email.trim().toLowerCase();
    const name = decoded.name || email.split("@")[0];
    const selectedZone = normalizeZone(zone);

    let user = await User.findOne({ email });

    // Staff / admin emails cannot use Google login
    if (user && user.role !== "citizen") {
      return res.status(401).json({ message: safeLoginMessage });
    }

    if (user && user.isActive === false) {
      return res.status(401).json({ message: safeLoginMessage });
    }

    if (selectedZone && !validateCitizenZone(selectedZone)) {
      return res.status(400).json({ message: "Please select a valid citizen zone." });
    }

    // New user or existing user with missing zone → require zone
    if ((!user || isMissingOrInvalidZone(user.zone)) && !validateCitizenZone(selectedZone)) {
      return res.status(200).json({
        requiresZone: true,
        email,
      });
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(48).toString("hex");
      user = await User.create({
        name,
        email,
        password: await bcrypt.hash(randomPassword, 12),
        role: "citizen",
        zone: selectedZone,
        provider: "google",
        isActive: true,
        prefs: { idleSignOut: 0 },
      });
    } else if (selectedZone && isMissingOrInvalidZone(user.zone)) {
      user.zone = selectedZone;
      user.zoneChangedAt = new Date();
      await user.save();
    }

    const session = await createSession(user, req);
    const token = generateToken(user, session._id, session.expiresAt);

    return sendSignedIn(req, res, 200, { token, session, user: getPublicUser(user) });
  } catch (error) {
    console.error("[Google] Error:", error.message);
    return res.status(401).json({ message: "Google sign-in failed. Please try again." });
  }
};

// =========================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// =========================

const forgotPassword = async (req, res) => {
  const safeMessage =
    "If an account exists for that email, a password reset link will be sent.";

  try {
    const { email } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(200).json({ message: safeMessage });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      isActive: { $ne: false },
    });

    if (!user) {
      return res.status(200).json({ message: safeMessage });
    }

    // command: at most 3 reset links an hour
    if (user.role === "admin") {
      const recent = await PasswordResetToken.countDocuments({ userId: user._id, kind: "reset", createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) } });
      if (recent >= 3) return res.status(200).json({ message: safeMessage });
    }

    // every older unused reset link of this account stops working (kept until it expires, so the hourly count holds)
    await PasswordResetToken.updateMany({ userId: user._id, kind: "reset", revoked: { $ne: true } }, { $set: { revoked: true } });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Admin links expire faster
    const lifeMs = user.role === "admin" ? 15 * 60 * 1000 : 60 * 60 * 1000;

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      kind: "reset",
      expiresAt: new Date(Date.now() + lifeMs),
    });

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&desk=${user.role}`;

    try {
      await sendPasswordResetEmail(user, resetUrl, Math.round(lifeMs / 60000));
    } catch (emailError) {
      // the answer stays the same, so nobody learns whether the email exists
      await PasswordResetToken.deleteOne({ tokenHash });
      console.error("[Forgot Password] Email not sent:", emailError.message);
    }

    return res.status(200).json({ message: safeMessage });
  } catch (error) {
    console.error("[Forgot Password] Error:", error.message);
    return res.status(500).json({
      message: "Unable to process your request right now. Please try again.",
    });
  }
};

// =========================
// RESET PASSWORD
// POST /api/auth/reset-password/:token
// =========================

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body || {};

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        message: "This reset link is invalid or expired. Request a new one.",
      });
    }

    if (typeof password !== "string" || typeof confirmPassword !== "string") {
      return res.status(400).json({ message: "Password and confirmation are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      kind: "reset",
      revoked: { $ne: true },
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        message: "This reset link is invalid or expired. Request a new one.",
      });
    }

    const user = await User.findById(resetRecord.userId).select("+password");

    if (!user || user.isActive === false) {
      await PasswordResetToken.deleteOne({ _id: resetRecord._id });
      return res.status(400).json({ message: "This account cannot reset its password." });
    }

    const passwordError = validatePassword(password, {
      role: user.role,
      name: user.name,
      email: user.email,
    });
    if (passwordError) {
      return res.status(422).json({ message: passwordError });
    }

    user.password = await bcrypt.hash(password, 12);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // End every session of this account
    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    // Disconnect all sockets for this user after password reset.
    try {
      const { getIO } = require("../socket/socket");

      getIO()
        .in(`user:${user._id}`)
        .disconnectSockets(true);
    } catch (socketError) {
      console.error(
        "[Reset Password] Socket disconnect error:",
        socketError.message
      );
    }

    await PasswordResetToken.deleteMany({ userId: user._id, kind: "reset" });
    await writeAudit({ actorId: user._id, role: user.role, actor: user.name, kind: "auth", action: `${user.name} reset their password · every device signed out` });
    if (user.role === "admin") {
      require("../services/emailService").sendAdminPasswordChangedNotice().catch((e) => console.error("[Reset Password] Command notice not sent:", e.message));
    }

    return res.status(200).json({
      message: "Password changed successfully. Please sign in with your new password.",
      desk: user.role,
    });
  } catch (error) {
    console.error("[Reset Password] Error:", error.message);
    return res.status(500).json({
      message: "Unable to reset your password right now. Please try again.",
    });
  }
};

// =========================
// GET CURRENT USER
// GET /api/auth/me
// =========================

const getMe = async (req, res) => {
  try {
    // req.user is already loaded and validated by protect middleware
    return res.status(200).json({
      user: getPublicUser(req.user),
      session: sessionInfo(req.session),
    });
  } catch (error) {
    console.error("[Get Me] Error:", error.message);
    return res.status(500).json({ message: "Failed to fetch current user." });
  }
};

// =========================
// ADOPT SESSION (one-time upgrade)
// POST /api/auth/session
// A browser that still holds a token from before the cookie upgrade sends it
// once as a Bearer header; it gets the same session back as the httpOnly
// cookie, then deletes its copy. Nobody is signed out by the upgrade.
// =========================

const adoptSession = async (req, res) => {
  try {
    const raw = String(req.headers.authorization || "").slice(7).trim();
    if (!raw || !req.session) return res.status(400).json({ message: "No session to keep." });
    setSessionCookie(res, raw, req.session.expiresAt);
    return res.status(200).json({ user: getPublicUser(req.user), session: sessionInfo(req.session) });
  } catch (error) {
    console.error("[Adopt Session] Error:", error.message);
    return res.status(500).json({ message: "Your session couldn't be kept. Sign in again." });
  }
};

// =========================
// LOGOUT
// POST /api/auth/logout
// =========================

const logout = async (req, res) => {
  try {
    if (req.session) {
      const sessionId = req.session._id.toString();

      await Session.updateOne(
        {
          _id: req.session._id,
          userId: req.user._id,
          revokedAt: null
        },
        {
          $set: { revokedAt: new Date() }
        }
      );

      // Disconnect sockets belonging to this session.
      try {
        const { getIO } = require("../socket/socket");

        getIO()
          .in(`sid:${sessionId}`)
          .disconnectSockets(true);
      } catch (socketError) {
        console.error(
          "[Logout] Socket disconnect error:",
          socketError.message
        );
      }
    }

    return res.status(200).json({
      message: "Signed out."
    });
  } catch (error) {
    console.error("[Logout] Error:", error.message);

    return res.status(500).json({
      message: "Unable to complete logout. Please try again."
    });
  }
};

// =========================
// ACTIVITY (keeps session alive)
// POST /api/auth/activity
// =========================

const activity = async (req, res) => {
  try {
    if (req.session) {
      req.session.lastActiveAt = new Date();
      req.session.lastSeenAt = new Date();
      await req.session.save();
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(204).send();
  }
};

module.exports = {
  getPublicUser,
  createSession,
  register,
  login,
  googleLogin,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
  adoptSession,
  activity,
};