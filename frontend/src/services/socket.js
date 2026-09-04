import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"]
});

export const connectAdminSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }

  socket.emit("join-admin");
};

export const connectModeratorSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }

  socket.emit("join-moderators");
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;