import { useSyncExternalStore } from "react";
import { SERVER_ON, API_URL, TOKEN_KEY, USER_KEY, ROLES, DEV_DESK } from "../config/server";
import { setTokenSource, onSignedOut, api } from "../lib/api";
import { onEvent, EVENTS, STREAM_RESUMED } from "../services/events";

/* ------------------------------------------------------------------
   ONE SESSION SOURCE for the whole app.

   Signing in is always real. The sign-in pages send the email and the
   password to the server; the server answers with a token and the
   account. Nothing about any account (email, password, role) is
   written in this code.

   What the app keeps after a sign-in:
     localStorage.token   the server's token (JWT)
     localStorage.user    { id, name, email, role, zone } as the server sent it

   The role is never taken on trust from the browser. On every start the
   app asks the server who this token belongs to (GET /auth/me) and uses
   the server's answer. Until it answers, the desk stays closed. Editing
   localStorage changes nothing: the server decides, and the server
   checks the role again on every request it serves.

   Every screen reads the same object from useAuth() / getUser():
     { id, serverId, name, displayName, email, role, ward, source }

   id is the account's server id (the same id every issue, request and
   follow on the server refers to). On the developer desk it's the
   sample desk's id.
------------------------------------------------------------------- */

const DEV_KEY = "wardline-session"; // developer desk only (config/server.js · DEV_DESK)
const ROLE_ALIAS = { user: "citizen" };


/* Developer desk: one sample person per role, sample data only. Works only
   in "npm run dev" with VITE_DEV_DESK=true; no email, no password, no token. */
export const DEV_DESKS = [
  { id: "citizen-1", name: "Aanya Mehra", role: "citizen", ward: "Ballygunge" },
  { id: "staff-koushik", name: "Koushik Bhowmik", role: "staff", ward: "Shyambazar" },
  { id: "admin-1", name: "Priti Sarkar", role: "admin", ward: "Command" },
];

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

function tokenExpired(token) {
  const p = tokenPayload(token);
  return Boolean(p && typeof p.exp === "number" && p.exp * 1000 <= Date.now());
}

function clearServerKeys() {
  try {
    localStorage.removeItem(TOKEN_KEY);
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
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    if (tokenExpired(token)) {
      clearServerKeys();
      return null;
    }
    const next = shape(JSON.parse(raw));
    if (!next) return null;
    // the token's own role must agree with the saved account; a hand-edited role fails here
    const p = tokenPayload(token);
    const tokenRole = p && (ROLE_ALIAS[p.role] || p.role);
    if (tokenRole && tokenRole !== next.role) {
      clearServerKeys();
      return null;
    }
    return next;
  } catch {
    return null;
  }
}

function readDevSession() {
  if (!DEV_DESK) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(DEV_KEY) || "null");
    const desk = DEV_DESKS.find((d) => d.id === parsed?.id);
    return desk ? { ...desk, serverId: null, displayName: "", email: "", provider: "local", source: "dev" } : null;
  } catch {
    return null;
  }
}

function readSession() {
  return readServerSession() || readDevSession();
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
export function takeSignOutNote() {
  try {
    const t = sessionStorage.getItem(NOTE_KEY) || "";
    sessionStorage.removeItem(NOTE_KEY);
    return t;
  } catch {
    return "";
  }
}

/** When this server session started and when it ends (from the token), in ms. Null on a developer desk. */
export function sessionClock() {
  if (user?.source !== "server") return null;
  try {
    const p = tokenPayload(localStorage.getItem(TOKEN_KEY));
    if (!p) return null;
    return {
      iat: typeof p.iat === "number" ? p.iat * 1000 : null,
      exp: typeof p.exp === "number" ? p.exp * 1000 : null,
    };
  } catch {
    return null;
  }
}

/** The server issued a fresh token for this session (after a password change). */
export function replaceToken(token) {
  if (user?.source !== "server" || !token) return false;
  const p = tokenPayload(token);
  if (p?.role && (ROLE_ALIAS[p.role] || p.role) !== user.role) return false;
  try { localStorage.setItem(TOKEN_KEY, token); } catch { return false; }
  armExpiry();
  emit();
  return true;
}

/** The server sent a newer copy of this account (zone, name or email changed): keep it. */
export function updateSessionUser(serverUser, token) {
  if (user?.source !== "server" || !serverUser) return null;
  const next = shape(serverUser);
  if (!next || next.role !== user.role) return null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
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

/** The current server token, or null */
export function getToken() {
  if (user?.source !== "server") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** After a successful sign-in: keep the server's token and account, open the desk. */
export function setServerSession({ token, user: serverUser } = {}) {
  if (!token || !serverUser) return null;
  const next = shape(serverUser);
  if (!next) return null;
  try {
    localStorage.removeItem(DEV_KEY);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(serverUser));
  } catch {
    return null;
  }
  setUser(next, true); // the server just issued it
  return next;
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
  verifying = api
    .get("/auth/me")
    .then(({ data }) => {
      const account = data?.user || data;
      const next = shape(account);
      if (!next) { logout(); return null; }
      try { localStorage.setItem(USER_KEY, JSON.stringify(account)); } catch { /* ignore */ }
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

/** Developer desk (npm run dev + VITE_DEV_DESK=true only) */
export function openDevDesk(id) {
  if (!DEV_DESK) return null;
  const desk = DEV_DESKS.find((d) => d.id === id);
  if (!desk) return null;
  try { localStorage.setItem(DEV_KEY, JSON.stringify({ id })); } catch { /* ignore */ }
  setUser(readDevSession(), true);
  return user;
}

export function logout() {
  const wasServer = user?.source === "server";
  const token = getToken();
  clearServerKeys();
  try { localStorage.removeItem(DEV_KEY); } catch { /* ignore */ }
  setUser(null, true);
  // tell the server the token is finished (it may keep a revocation list); never blocks sign-out
  if (wasServer && token && SERVER_ON) {
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    }).catch(() => {});
  }
}

// the API client sends this session's token, and a rejected token signs out
setTokenSource(getToken);
onSignedOut(() => {
  if (user?.source === "server") logout();
});

// the account changed on another device (name, photo, zone, preferences), or the live link came back: read it again
onEvent(EVENTS.PROFILE_UPDATED, (e) => { if (user?.source === "server" && e?.id && String(e.id) === user.serverId) verifySession(); });
onEvent(STREAM_RESUMED, () => { if (user?.source === "server") verifySession(); });

// a sign-in or sign-out in another tab is picked up here
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== null && ![TOKEN_KEY, USER_KEY, DEV_KEY].includes(e.key)) return;
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
