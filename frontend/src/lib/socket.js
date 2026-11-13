/* ------------------------------------------------------------------
   The Socket.io client factory: the only file that knows the library.
   services/realtime.js does the rest (token, events, reconnects).
   Needs the package once:  npm install socket.io-client@^4.8.1
------------------------------------------------------------------- */
import { io } from "socket.io-client";

export const createSocket = (url, options) => io(url, options);
