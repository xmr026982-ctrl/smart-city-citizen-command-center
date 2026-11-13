
const jwt = require("jsonwebtoken");
const { readCookie } = require("../utils/sessionCookie");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const User = require("../models/User");
const Session = require("../models/Session");
const Issue = require("../models/Issue");

let io;

const initializeSocket = (server) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  const allowedOrigins = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Authenticate every socket connection.
  io.use(async (socket, next) => {
    try {
      // the httpOnly session cookie (browsers) or auth.token (other clients)
      const token = socket.handshake.auth?.token || readCookie(socket.handshake.headers?.cookie);

      if (!token) {
        return next(new Error("unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (
        !decoded.id ||
        !decoded.sid ||
        !mongoose.isValidObjectId(decoded.id) ||
        !mongoose.isValidObjectId(decoded.sid)
      ) {
        return next(new Error("unauthorized"));
      }

      const now = new Date();

      // Validate the session.
      const session = await Session.findOne({
        _id: decoded.sid,
        userId: decoded.id,
        revokedAt: null,
        expiresAt: { $gt: now },
      });

      if (!session) {
        return next(new Error("unauthorized"));
      }

      // Validate the current user.
      const user = await User.findById(decoded.id).select("-password");

      if (!user || user.isActive === false) {
        return next(new Error("unauthorized"));
      }

      // The token, session and user must agree on the role.
      if (
        decoded.role !== user.role ||
        session.role !== user.role
      ) {
        return next(new Error("unauthorized"));
      }

      // Match the HTTP middleware's idle timeout rules.
      const idleMinutes =
        user.prefs?.idleSignOut ??
        (user.role === "admin"
          ? 30
          : user.role === "staff"
          ? 60
          : 0);

      if (idleMinutes > 0) {
        const lastActive = session.lastActiveAt
          ? new Date(session.lastActiveAt).getTime()
          : new Date(session.createdAt).getTime();

        const inactiveFor = Date.now() - lastActive;

        if (inactiveFor > idleMinutes * 60 * 1000) {
          session.revokedAt = now;
          await session.save();

          return next(new Error("unauthorized"));
        }
      }

      socket.data = {
        userId: user._id.toString(),
        role: user.role,
        zone: user.zone || null,
        sid: session._id.toString(),
        tab: socket.handshake.auth?.tab || null,
        idleMinutes,
      };

      return next();
    } catch (error) {
      if (
        error.name === "TokenExpiredError" ||
        error.name === "JsonWebTokenError" ||
        error.name === "NotBeforeError"
      ) {
        return next(new Error("unauthorized"));
      }

      console.error("Socket authentication error:", error.message);
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId, role, zone, sid } = socket.data;

    try {
      // Private account room.
      socket.join(`user:${userId}`);

      // Session room: allows all tabs/devices in this session
      // to be disconnected together.
      socket.join(`sid:${sid}`);

      // Role room.
      socket.join(`role:${role}`);

      // Admins must not join a zone room.
      if (role !== "admin" && zone) {
        socket.join(`zone:${zone}`);
      }

      // Join issue rooms for issues related to this user:
      // reported, assigned, followed or supported.
      const issueFilter = {
        $or: [
          { reportedBy: userId },
          { assignedTo: userId },
          { savedBy: userId },
          { "supporters.id": userId },
        ],
      };

      const issueRooms = await Issue.find(issueFilter)
        .select("publicId")
        .lean();

      for (const issue of issueRooms) {
        if (issue.publicId) {
          socket.join(`issue:${issue.publicId}`);
        }
      }


    } catch (error) {
      console.error("Socket connection setup error:", error.message);
      socket.disconnect(true);
    }
  });

  startIdleSweep();
  return io;
};

/* Every minute: a live connection whose session has expired, was revoked,
   or has been idle past the person's away limit is closed, so an
   unattended desk stops receiving events even if it makes no requests. Reads and the socket don't count as activity. */
let sweep = null;
function startIdleSweep() {
  if (sweep) return;
  sweep = setInterval(async () => {
    try {
      if (!io) return;
      const sockets = await io.fetchSockets();
      if (!sockets.length) return;
      const sids = [...new Set(sockets.map((s) => s.data?.sid).filter(Boolean))];
      const sessions = await Session.find({ _id: { $in: sids } }).select("revokedAt expiresAt lastActiveAt createdAt").lean();
      const byId = new Map(sessions.map((s) => [String(s._id), s]));
      const now = Date.now();
      const close = new Set();
      for (const sock of sockets) {
        const sid = sock.data?.sid;
        const session = byId.get(sid);
        if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= now) {
          close.add(sid);
          continue;
        }
        const idle = Number(sock.data?.idleMinutes || 0);
        const last = new Date(session.lastActiveAt || session.createdAt).getTime();
        // idle: only the connection closes here. The tab then asks /auth/me, and the
        // normal check revokes the session with the "Signed out after … away" message.
        if (idle > 0 && now - last > idle * 60000) close.add(sid);
      }
      close.forEach((sid) => io.in(`sid:${sid}`).disconnectSockets(true));
    } catch (error) {
      console.error("Socket sweep error:", error.message);
    }
  }, Number(process.env.SOCKET_SWEEP_MS) || 60 * 1000);
  sweep.unref?.();
}

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized.");
  }

  return io;
};

// Call this after a session is revoked or logged out.
// It disconnects every socket connected to that session.
const disconnectSession = (sessionId) => {
  if (!io || !sessionId) return;

  io.in(`sid:${sessionId}`).disconnectSockets(true);
};

module.exports = {
  initializeSocket,
  getIO,
  disconnectSession,
};