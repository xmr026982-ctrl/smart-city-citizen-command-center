import { useSyncExternalStore } from "react";
import { SERVER_ON, SOCKET_URL } from "../config/server";
import { TAB_ID } from "../lib/api";
import { createSocket } from "../lib/socket";
import { REMOTE_EVENTS, STREAM_RESUMED, emitEvent } from "./events";
import { getToken, subscribeRole } from "../store/authStore";

/* ------------------------------------------------------------------
   The live connection to the backend (Socket.io).

   Opens by itself when VITE_API_URL is set and the person signed in
   through the server. The token goes in the handshake
   (auth: { token, tab }), never in a URL. The server's side is in
   docs/backend/BACKEND-HANDOVER.md · A5.

   Every server event in REMOTE_EVENTS (services/events.js) goes to the
   app's event channel with { remote: true }. Stores listen there and
   never touch the socket. An event this very tab caused
   (payload.actorTab === TAB_ID, lib/api.js) is skipped: it already
   shows the change. The person's other tabs and devices still get it.

   After a drop, the reconnect is announced (STREAM_RESUMED) so stores
   read their data again: events sent while offline are lost by design.
   A refused connection signs nothing out by itself; the next API
   call's 401 does that (lib/api.js).

   Status for the top bar:  local | connecting | live | offline
------------------------------------------------------------------- */

let socket = null;
let status = "local";
let boundTo = null; // the token the socket was opened with
let wasLive = false;
const listeners = new Set();

function setStatus(next) {
  if (next === status) return;
  status = next;
  listeners.forEach((fn) => fn());
}

function close() {
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* already gone */
    }
  }
  socket = null;
  boundTo = null;
  wasLive = false;
}

function open(token) {
  close();
  boundTo = token;
  setStatus("connecting");
  try {
    socket = createSocket(SOCKET_URL, {
      auth: { token, tab: TAB_ID },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
    });
  } catch (err) {
    console.error("[realtime] could not open the live connection", err);
    socket = null;
    setStatus("offline");
    return;
  }

  socket.on("connect", () => {
    setStatus("live");
    if (wasLive) emitEvent(STREAM_RESUMED, {}, { remote: true });
    wasLive = true;
  });
  socket.on("disconnect", () => setStatus("offline"));
  socket.on("connect_error", (error) => {
    console.error("[realtime] connection failed:", error.message);
    setStatus("offline");
  });

  REMOTE_EVENTS.forEach((name) => {
    socket.on(name, (payload = {}) => {
      if (payload && payload.actorTab && payload.actorTab === TAB_ID) return;
      emitEvent(name, payload || {}, { remote: true });
    });
  });
}

/** Open, re-open or close the connection to match the current sign-in. */
export function syncRealtime() {
  const token = getToken();
  if (!SERVER_ON || typeof createSocket !== "function" || !token) {
    close();
    setStatus("local");
    return;
  }
  if (socket && boundTo === token) return;
  open(token);
}

let started = false;
/** Called once by App: follows sign-in and sign-out from then on. */
export function startRealtime() {
  if (started) return;
  started = true;
  syncRealtime();
  subscribeRole(syncRealtime);
}

export const getRealtimeStatus = () => status;

export function useRealtimeStatus() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getRealtimeStatus,
    getRealtimeStatus
  );
}
