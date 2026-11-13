import { useSyncExternalStore } from "react";
import { SERVER_ON, API_URL, TOKEN_KEY, USER_KEY, ROLES } from "../config/server";
import { setTokenSource, onSignedOut, api, TAB_ID } from "../lib/api";
import { onEvent, EVENTS, STREAM_RESUMED } from "../services/events";

/* ------------------------------------------------------------------
   ONE SESSION SOURCE for the whole app.

   Signing in is always real. The sign-in pages send the email and the
   password to the server; the server answers with the account and sets
   the session as an httpOnly cookie. Page scripts never see the token,
   so a script injected into a page can't steal it for later use.

   What the app keeps after a sign-in (nothing secret):
     localStorage["sk-session"]  { iat, exp, role }: when the session
                                 started and ends (the countdown, tab sync)
     localStorage.user           { id, name, email, role, zone } as the server sent it

   A token left in localStorage by an older version is handed to the
   server once (POST /auth/session), comes back as the cookie and is
   deleted here, so the upgrade signs nobody out.

   The role is never taken on trust from the browser. On every start the
   app asks the server who this session belongs to (GET /auth/me) and uses
   the server's answer. Until it answers, the desk stays closed. Editing
   localStorage changes nothing: the server decides, and the server
   checks the role again on every request it serves.

   Every screen reads the same object from useAuth() / getUser():
     { id, serverId, name, displayName, email, role, ward, source }

   id is the account's server id (the same id every issue, request and
   follow on the server refers to). Every session is a server sign-in.
------------------------------------------------------------------- */

const ROLE_ALIAS = { user: "citizen" };

// a developer-desk session left by an older build is cleared (sign-in is server-only now)
try { if (typeof localStorage !== "undefined") localStorage.removeItem("wardline-session"); } catch { /* storage blocked */ }

/* JWT payload (unverified: only the server can verify it) */
function tokenPayload(token) {
  try {
    const part = String(token).split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/* the non-secret session marker: { iat, exp, role } in ms */
const SESSION_KEY = "sk-session";
function readMarker() {
  try {
    const m = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return m && typeof m === "object" ? m : null;
  } catch {
    return null;
  }
}
function writeMarker(session, role) {
  if (!session || typeof session !== "object") return;
  const m = { iat: Number(session.iat) || Date.now(), exp: Number(session.exp) || null, role: role || null };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(m)); } catch { /* storage blocked */ }
}
/* a token kept by an older version (handed to the server once, then deleted) */
function legacyToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

function clearServerKeys() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

/* the server's account object → the app's user object */
function shape(u, source = "server") {
  if (!u || typeof u !== "object") return null;
  const role = ROLE_ALIAS[u.role] || u.role;
  if (!ROLES.includes(role)) return null;
  const serverId = String(u.id || u._id || "");
  if (source === "server" && !serverId) return null;
  const name = String(u.name || "").trim() || "Member";
  return {
    id: source === "server" ? serverId : String(u.id || ""),
    serverId,
    name,
    displayName: String(u.displayName || ""),
    email: String(u.email || "").trim().toLowerCase(),
    role,
    ward: role === "admin" ? "Command" : String(u.zone || u.ward || ""),
    provider: u.provider || u.authProvider || (u.googleId ? "google" : "password"),
    source,
  };
}

function readServerSession() {
  if (!SERVER_ON) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    let marker = readMarker();
    const old = legacyToken();
    if (!marker && old) {
      // an older version's token: its times and role become the marker until the server swaps it
      const p = tokenPayload(old);
      if (p) marker = { iat: typeof p.iat === "number" ? p.iat * 1000 : null, exp: typeof p.exp === "number" ? p.exp * 1000 : null, role: p.role || null };
    }
    if (!marker) return null;
    if (typeof marker.exp === "number" && marker.exp <= Date.now()) {
      clearServerKeys();
      return null;
    }
    const next = shape(JSON.parse(raw));
    if (!next) return null;
    // the marker's role must agree with the saved account (the server checks again on every request)
    const markerRole = marker.role && (ROLE_ALIAS[marker.role] || marker.role);
    if (markerRole && markerRole !== next.role) {
      clearServerKeys();
      return null;
    }
    return next;
  } catch {
    return null;
  }
}

function readSession() {
  return readServerSession();
}

let user = readSession();
let expiryTimer = null;
// a server session opens only once the server has confirmed it (verifySession)
let verified = !user || user.source !== "server";
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function setUser(next, isVerified = true) {
  user = next;
  verified = isVerified;
  armExpiry();
  emit();
}

/* A server token carries its own end time (exp). When it passes, the desk
   closes on its own, even if the page stays open and nothing is clicked. */
function armExpiry() {
  clearTimeout(expiryTimer);
  expiryTimer = null;
  if (typeof window === "undefined" || user?.source !== "server") return;
  const exp = sessionClock()?.exp;
  if (!exp) return;
  const left = exp - Date.now();
  if (left <= 0) { setSignOutNote("Your session ended. Sign in again to continue."); logout(); return; }
  // timers longer than ~24 days overflow; check again later instead
  expiryTimer = setTimeout(armExpiry, Math.min(left, 2 ** 31 - 1) + 500);
}

/* ------------------------------------------------------------------
   Why the last sign-out happened (session ended, inactivity, password
   changed elsewhere). The sign-in page shows it once.
------------------------------------------------------------------- */
const NOTE_KEY = "sk-signout-note";
export function setSignOutNote(text) {
  try { sessionStorage.setItem(NOTE_KEY, String(text || "")); } catch { /* ignore */ }
}
// React's StrictMode (development) runs a page's first render twice: the note taken
// by the first run is handed to the second instead of disappearing.
let lastNote = { text: "", at: 0 };
export function takeSignOutNote() {
  try {
    const t = sessionStorage.getItem(NOTE_KEY) || "";
    sessionStorage.removeItem(NOTE_KEY);
    if (t) {
      lastNote = { text: t, at: Date.now() };
      return t;
    }
    return Date.now() - lastNote.at < 1500 ? lastNote.text : "";
  } catch {
    return "";
  }
}

/** When this server session started and when it ends, in ms. Null before the server confirms it. */
export function sessionClock() {
  if (user?.source !== "server") return null;
  const m = readMarker();
  if (!m) return null;
  return { iat: typeof m.iat === "number" ? m.iat : null, exp: typeof m.exp === "number" ? m.exp : null };
}

/** Kept for older callers: the session lives in the cookie, so there is no token to replace. */
export function replaceToken() {
  return false;
}

/** The server sent a newer copy of this account (zone, name or email changed): keep it. */
export function updateSessionUser(serverUser) {
  if (user?.source !== "server" || !serverUser) return null;
  const next = shape(serverUser);
  if (!next || next.role !== user.role) return null;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(serverUser));
  } catch {
    return null;
  }
  setUser(next, true);
  return next;
}

/** The account object as the server last sent it (prefs and all), or null. */
export function getAccount() {
  if (user?.source !== "server") return null;
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}

/** Which session is open ("<account>:<start>"), or null. Changes when the person or the session changes. */
export function getSessionKey() {
  if (user?.source !== "server") return null;
  const m = readMarker();
  return `${user.serverId}:${m?.iat || "legacy"}`;
}

/** After a successful sign-in: the server set the cookie; keep the account and the session marker, open the desk. */
export function setServerSession({ user: serverUser, session } = {}) {
  if (!serverUser) return null;
  const next = shape(serverUser);
  if (!next) return null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(USER_KEY, JSON.stringify(serverUser));
  } catch {
    return null;
  }
  writeMarker(session || { iat: Date.now() }, next.role);
  setUser(next, true); // the server just issued it
  return next;
}

/* one-time: an older version's token becomes the httpOnly cookie, then is deleted */
let adopting = null;
function adoptLegacy() {
  const old = legacyToken();
  if (!old) return Promise.resolve();
  if (adopting) return adopting;
  adopting = api
    .post("/auth/session", undefined, { bearer: old })
    .then(({ data }) => {
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
      if (data?.session) writeMarker(data.session, user?.role);
    })
    .catch((err) => {
      if (err?.status === 401 || err?.status === 403 || err?.status === 400) {
        try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
      }
    })
    .finally(() => { adopting = null; });
  return adopting;
}

/* ------------------------------------------------------------------
   Ask the server who this token belongs to. Runs once on start (App).
   • the server answers: its account replaces whatever the browser held
   • 401 / 403: signed out (api.js reports 401 through onSignedOut)
   • the server can't be reached: the desk stays closed with a retry
   • the server has no /auth/me yet (404): the token's own role must
     match the saved account (checked in readServerSession). The full
     check arrives with /auth/me (docs/backend/BACKEND-HANDOVER.md · A2).
------------------------------------------------------------------- */
let verifying = null;
let verifyError = "";
export function verifySession() {
  if (!user || user.source !== "server") { verified = true; emit(); return Promise.resolve(user); }
  if (verifying) return verifying;
  verifying = adoptLegacy()
    .then(() => api.get("/auth/me"))
    .then(({ data }) => {
      const account = data?.user || data;
      const next = shape(account);
      if (!next) { logout(); return null; }
      try { localStorage.setItem(USER_KEY, JSON.stringify(account)); } catch { /* ignore */ }
      if (data?.session) writeMarker(data.session, next.role);
      setUser(next, true);
      return next;
    })
    .catch((err) => {
      if (err?.status === 404) { setUser(user, true); return user; }
      if (err?.status === 401 || err?.status === 403) { logout(); return null; }
      verifyError = err?.message || "Can't reach the server.";
      emit();
      return null;
    })
    .finally(() => { verifying = null; });
  return verifying;
}
export function retryVerify() {
  verifyError = "";
  emit();
  return verifySession();
}

export function logout() {
  const wasServer = user?.source === "server";
  const old = legacyToken();
  clearServerKeys();
  setUser(null, true);
  // the server ends the session and drops the cookie; never blocks sign-out
  if (wasServer && SERVER_ON) {
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Client-Tab": TAB_ID, ...(old ? { Authorization: `Bearer ${old}` } : {}) },
      keepalive: true,
    }).catch(() => {});
  }
}

// the session travels as the cookie; no token is handed to the API client any more
setTokenSource(() => null);
onSignedOut((message) => {
  if (user?.source !== "server") return;
  if (message) setSignOutNote(message);
  logout();
});

// the account changed on another device (name, photo, zone, preferences), or the live link came back: read it again
onEvent(EVENTS.PROFILE_UPDATED, (e) => { if (user?.source === "server" && e?.id && String(e.id) === user.serverId) verifySession(); });
onEvent(STREAM_RESUMED, () => { if (user?.source === "server") verifySession(); });

// a sign-in or sign-out in another tab is picked up here
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== null && ![SESSION_KEY, USER_KEY, TOKEN_KEY].includes(e.key)) return;
    const next = readSession();
    if (JSON.stringify(next) !== JSON.stringify(user)) setUser(next, true);
  });
}

export function getUser() {
  return verified ? user : null;
}

/** The signed-in person, or null (also null while the server is confirming a session) */
export function useAuth() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getUser,
    getUser
  );
}

/** True while a saved session waits for the server's answer */
export function usePendingSession() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => (user && !verified ? (verifyError ? "error" : "checking") : ""),
    () => ""
  );
}

/* ------------------------------------------------------------------
   Role API used by the desk pages (Sidebar, TopBar, Settings, Help,
   Unauthorized, settingsStore, zoneStore). Same session underneath.
------------------------------------------------------------------- */
export function getRole() {
  return getUser()?.role || null;
}

export function clearRole() {
  logout();
}

export function subscribeRole(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
