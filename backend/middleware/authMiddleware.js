
const mongoose = require("mongoose");
const User = require("../models/User");
const Session = require("../models/Session");
const { verifyToken } = require("../services/jwtService");
const { tokenFrom } = require("../utils/sessionCookie");

const getDefaultIdle = (role) => {
  if (role === "admin") return 30;
  if (role === "staff") return 60;
  return 0;
};

const protect = async (req, res, next) => {
  try {
    // the httpOnly session cookie (browsers) or "Authorization: Bearer" (other clients)
    const from = tokenFrom(req);

    if (!from) {
      return res.status(401).json({
        message: "Not authorized. Token missing."
      });
    }

    // cross-site request forgery guard: a change made with the cookie must carry
    // the app's own header, which another website can't add (CORS blocks it)
    if (from.source === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.headers["x-client-tab"]) {
      return res.status(403).json({
        message: "Request blocked. Reload the page and try again."
      });
    }

    const token = from.token;

    const decoded = verifyToken(token);

    if (
      !decoded.id ||
      !decoded.sid ||
      !mongoose.isValidObjectId(decoded.id) ||
      !mongoose.isValidObjectId(decoded.sid)
    ) {
      return res.status(401).json({
        message: "Invalid authentication token."
      });
    }

    const now = new Date();

    const session = await Session.findOne({
      _id: decoded.sid,
      userId: decoded.id,
      revokedAt: null,
      expiresAt: { $gt: now }
    });

    if (!session) {
      return res.status(401).json({
        message: "Session expired or revoked. Please sign in again."
      });
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "User not found or account disabled."
      });
    }

    if (
      user.role !== decoded.role ||
      session.role !== user.role
    ) {
      session.revokedAt = now;
      await session.save();

      return res.status(401).json({
        message: "Session is no longer valid. Please sign in again."
      });
    }

    const idleMinutes =
      user.prefs?.idleSignOut ?? getDefaultIdle(user.role);

    if (idleMinutes > 0) {
      const lastActive = session.lastActiveAt
        ? new Date(session.lastActiveAt).getTime()
        : new Date(session.createdAt).getTime();

      const inactiveFor = now.getTime() - lastActive;
      const idleLimit = idleMinutes * 60 * 1000;

      if (inactiveFor > idleLimit) {
        session.revokedAt = now;
        await session.save();

        const label =
          idleMinutes >= 60
            ? `${idleMinutes / 60} h`
            : `${idleMinutes} min`;

        return res.status(401).json({
          message: `Signed out after ${label} away, to keep your account safe.`
        });
      }
    }

    // Update lastSeenAt without changing lastActiveAt.
    
const isWriteRequest = ["POST", "PUT", "PATCH", "DELETE"].includes(
  req.method
);

const updateFields = { lastSeenAt: now };

if (isWriteRequest) {
  updateFields.lastActiveAt = now;
}

const updateResult = await Session.updateOne(
  { _id: session._id, revokedAt: null },
  { $set: updateFields }
);

if (updateResult.matchedCount === 0) {
  return res.status(401).json({
    message: "Session expired or revoked. Please sign in again."
  });
}

    req.user = user;
    req.session = session;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired token."
      });
    }

    console.error("[Auth Middleware] Error:", error.message);

    return res.status(500).json({
      message: "Authentication service temporarily unavailable."
    });
  }
};

module.exports = protect;