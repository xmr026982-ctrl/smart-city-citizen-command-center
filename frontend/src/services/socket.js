import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"]
});

export const connectSocket = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    console.error(
      "Cannot connect Socket.io: token missing."
    );

    return;
  }

  socket.auth = {
    token
  };

  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;