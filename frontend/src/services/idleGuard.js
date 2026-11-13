import { getUser, logout, setSignOutNote, subscribeRole } from "../store/authStore";
import { getSettings } from "../store/settingsStore";
import { api } from "../lib/api";
import { SERVER_ON } from "../config/server";

/* ------------------------------------------------------------------
   Away sign-out (Settings · Sign-in & Security · "Sign out when I'm away").
   Any click, key, scroll or touch in any tab of this browser counts as
   activity: the last moment is shared through localStorage, so a desk
   left open in a second tab doesn't sign out someone working in the
   first. Command can't switch it off (15 min to 1 h).
   Runs from App once; checks every 20 seconds.

   With the server, the server enforces the same limit (it can't be
   switched off by editing this browser): activity is reported with
   POST /auth/activity at most once a minute, and the chosen limit is
   an account preference (prefs.idleSignOut, settingsStore).
   docs/backend/BACKEND-HANDOVER.md · A2 §5.
------------------------------------------------------------------- */
const KEY = "sk-last-active";
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
const CHECK_MS = 20000;

let last = Date.now();
let lastWrite = 0;
let started = false;
let lastPing = 0;
const onServer = () => SERVER_ON && getUser()?.source === "server";

function ping() {
  if (!onServer() || Date.now() - lastPing < 60000) return;
  lastPing = Date.now();
  api.post("/auth/activity").catch(() => {}); // a 401 here means the server already signed this session out
}

function mark() {
  last = Date.now();
  ping();
  if (last - lastWrite > 5000) {
    lastWrite = last;
    try { localStorage.setItem(KEY, String(last)); } catch { /* ignore */ }
  }
}

function lastActive() {
  let shared = 0;
  try { shared = Number(localStorage.getItem(KEY)) || 0; } catch { shared = 0; }
  return Math.max(last, shared);
}

function minutesAllowed() {
  const me = getUser();
  if (!me) return 0;
  const v = Number(getSettings().idleSignOut);
  if (me.role === "admin") return v > 0 ? Math.min(v, 60) : 30; // command always has a limit
  return v > 0 ? v : 0;
}

function check() {
  const mins = minutesAllowed();
  if (!mins) return;
  if (Date.now() - lastActive() < mins * 60000) return;
  setSignOutNote(`Signed out after ${mins >= 60 ? `${mins / 60} h` : `${mins} min`} away, to keep your account safe.`);
  logout();
}

export function startIdleGuard() {
  if (started || typeof window === "undefined") return;
  started = true;
  EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
  // a fresh sign-in starts a fresh count
  let who = getUser()?.id || "";
  subscribeRole(() => {
    const now = getUser()?.id || "";
    if (now !== who) { who = now; lastWrite = 0; lastPing = 0; mark(); }
  });
  mark();
  setInterval(check, CHECK_MS);
  // coming back to a sleeping laptop: check at once
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
}
