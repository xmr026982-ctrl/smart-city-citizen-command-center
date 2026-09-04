const jwt = require("jsonwebtoken");
const User = require("../models/User");

let io;

const initializeSocket = (server) => {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST", "PATCH", "DELETE"]
    }
  });

  // Authenticate every Socket.io connection.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(
          new Error("Authentication required.")
        );
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.id)
        .select("-password");

      if (!user) {
        return next(
          new Error("User not found.")
        );
      }

      if (!user.isActive) {
        return next(
          new Error("Account is disabled.")
        );
      }

      socket.user = user;

      next();
    } catch (error) {
      next(
        new Error("Invalid or expired token.")
      );
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id} | ${socket.user.role}`
    );

    // Join rooms based on the authenticated user's role.
    if (socket.user.role === "admin") {
      socket.join("admin-room");
    }

    if (socket.user.role === "moderator") {
      socket.join("moderator-room");
    }

    // Admins can also receive moderator events.
    if (socket.user.role === "admin") {
      socket.join("moderator-room");
    }

    socket.on("disconnect", () => {
      console.log(
        `Socket disconnected: ${socket.id}`
      );
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.io has not been initialized."
    );
  }

  return io;
};

module.exports = {
  initializeSocket,
  getIO
};