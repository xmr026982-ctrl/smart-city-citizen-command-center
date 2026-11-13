/* Socket.io helpers for controllers (contract A5).
   Every event carries { at, actorId, actorTab } plus its own fields.
   actorTab (the X-Client-Tab header) lets the tab that acted skip its echo. */
const { getIO } = require("../socket/socket");

function io() {
  try {
    return getIO();
  } catch {
    return null; // tests or a server started without Socket.io
  }
}

/** Who caused an event, from the request. */
const origin = (req) => ({
  actorId: req?.user?._id ? String(req.user._id) : null,
  actorTab: req?.headers?.["x-client-tab"] ? String(req.headers["x-client-tab"]).slice(0, 80) : null,
});

/** Send one event to a list of rooms (each socket gets it once). */
function emit(event, payload, rooms, req) {
  const server = io();
  const list = [...new Set((rooms || []).filter(Boolean))];
  if (!server || !list.length) return;
  const body = { at: new Date().toISOString(), ...(req ? origin(req) : {}), ...payload };
  server.to(list).emit(event, body);
}

/** Put every open socket of a person in (or out of) an issue room. */
function joinIssue(userId, publicId) {
  const server = io();
  if (server && userId && publicId) server.in(`user:${userId}`).socketsJoin(`issue:${publicId}`);
}
function leaveIssue(userId, publicId) {
  const server = io();
  if (server && userId && publicId) server.in(`user:${userId}`).socketsLeave(`issue:${publicId}`);
}

/** Move a person's sockets to a new zone room. */
function moveZone(userId, from, to) {
  const server = io();
  if (!server || !userId) return;
  if (from) server.in(`user:${userId}`).socketsLeave(`zone:${from}`);
  if (to) server.in(`user:${userId}`).socketsJoin(`zone:${to}`);
}

/** Update what the open sockets of a person know about them (away limit, zone). */
async function updateSockets(userId, patch) {
  const server = io();
  if (!server || !userId) return;
  try {
    const sockets = await server.in(`user:${userId}`).fetchSockets();
    sockets.forEach((sock) => Object.assign(sock.data, patch));
  } catch {
    /* best effort */
  }
}

/** Crew coverage changed (duty, roster, zone): citizens and crews re-read the counts. No ids, no names. */
function coverageChanged(req) {
  emit("staff:changed", { id: "", coverage: true }, ["role:citizen", "role:staff"], req);
}

module.exports = { emit, origin, joinIssue, leaveIssue, moveZone, updateSockets, coverageChanged };
