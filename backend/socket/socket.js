
const jwt = require("jsonwebtoken");
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
      const token = socket.handshake.auth?.token;

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

      console.log(
        `Socket connected: ${socket.id} | ${role} | ${userId}`
      );

      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    } catch (error) {
      console.error("Socket connection setup error:", error.message);
      socket.disconnect(true);
    }
  });

  return io;
};

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