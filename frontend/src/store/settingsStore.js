import { useSyncExternalStore } from "react";
import { getRole, getUser, getAccount, subscribeRole, updateSessionUser } from "./authStore";
import { api } from "../lib/api";
import { SERVER_ON } from "../config/server";
import { registerProfile } from "./profileStore";
import { defaultsFor, zoneIdOf } from "../config/settingsSchema";

/* ------------------------------------------------------------------
   Settings, per person (role + account), kept in this browser.
   Passwords and tokens are NEVER stored here.

   Account fields (display name, home zone, designation, office, photo)
   start from what the server sent at sign-in and are saved back to the
   server by the Settings page; this copy keeps the desk quick.

   Account preferences (ACCOUNT_PREFS: the away limit and the alert
   preferences) follow the person to every device: with a server
   sign-in they come from the account (user.prefs) and every change is
   saved with PATCH /users/me { prefs } (docs/backend/BACKEND-HANDOVER.md · A4).
   Screen preferences (3D, sky, motion, contrast, refresh, AQI scale,
   dashboard zone) stay in this browser on purpose.
------------------------------------------------------------------- */
const ownerOf = (role) => `${role}:${getUser()?.id || "guest"}`;
const keyOf = (role) => `sc-settings:${ownerOf(role)}`;
const LEGACY_NAMES = ["KB Citizen", "KB Staff", "KB Admin"];
/* keys older builds saved that no longer mean anything (fake security, sessions, ...) */
const RETIRED = [
  "twoFactor", "biometric", "loginAlerts", "pinOnLaunch", "sessions", "passwordChangedAt", "emailVerified", "email", "phone",
  "emergencyName", "emergencyPhone", "employeeId", "rank", "assignedZones", "maxTasks", "shiftStart", "shiftEnd", "channels",
  "categories", "nearbyRadius", "aqiAlert", "autoLocate", "attachGps", "defaultCategory", "mediaQuality", "locationShare",
  "publicName", "showHistory", "personalFeed", "shareAvatar", "mapLayers", "dispatchEvents", "dispatchChannels", "slaWarn",
  "alertSound", "alertVibrate", "shareLocation", "locInterval", "batterySaver", "offlineQueue", "quickStatus", "sessionTimeout",
  "auditTrail", "cityName", "thAqi", "thTraffic", "thWater", "thPower", "autoApprove", "requirePhoto", "dupRadius", "profanity",
  "aiCategorize", "slaAck", "staffCanClose", "citizenEdit", "citizenVote", "criticalChannels", "escalateAfter", "dailyDigest",
  "digestTime", "retention", "maskPii",
];
/* saved to the account (user.prefs) when signed in through the server */
export const ACCOUNT_PREFS = ["idleSignOut", "inboxMuted", "popups", "quietHours", "quietFrom", "quietTo"];
const onServer = () => SERVER_ON && getUser()?.source === "server";

const cache = {};
const listeners = new Set();
let savedAt = 0;

const roleNow = () => getRole() || "citizen";

// a different person signed in, or the server sent a newer copy of the account: read again
subscribeRole(() => {
  Object.keys(cache).forEach((k) => delete cache[k]);
  listeners.forEach((l) => l());
});

/* Duty status lives on the field roster (Staff Desk reads it). dutyStore
   connects it here so Settings shows and changes the same value. */
let dutyBridge = null;
export function connectDuty(bridge) {
  dutyBridge = bridge;
}
/** Something outside Settings changed a value it shows (duty on the roster): read again. */
export function refreshSettings() {
  delete cache[ownerOf(roleNow())];
  listeners.forEach((l) => l());
}

/* fill what the account decides: name, zone, roster duty */
function own(role, s) {
  const me = getUser();
  if (!me) return s;
  const out = { ...s };
  if (!out.displayName || LEGACY_NAMES.includes(out.displayName)) out.displayName = me.displayName || me.name;
  if (role === "citizen") {
    // the account's zone is the truth; a value picked here wins only until the server answers
    const fromAccount = zoneIdOf(me.ward);
    if (!out.homeWard || (fromAccount && out.homeWardFrom !== "local")) out.homeWard = fromAccount || out.homeWard;
  }
  // an email change is done once the account carries the new address (or after a day)
  if (out.pendingEmail && (me.email === out.pendingEmail || Date.now() - (out.pendingEmailAt || 0) > 864e5)) {
    out.pendingEmail = "";
    out.pendingEmailAt = 0;
  }
  if (role === "staff" && !out.defaultZone) out.defaultZone = zoneIdOf(me.ward) || "central";
  // the account's fields and preferences win over whatever this browser kept
  const account = me.source === "server" ? getAccount() : null;
  if (account) {
    out.displayName = account.displayName || account.name || out.displayName;
    if ("avatar" in account) out.avatar = account.avatar || "";
    if (role === "admin") {
      out.designation = account.designation || "";
      out.office = account.office || "";
    }
  }
  const prefs = account?.prefs || null;
  if (prefs && typeof prefs === "object") ACCOUNT_PREFS.forEach((k) => { if (prefs[k] !== undefined && prefs[k] !== null) out[k] = prefs[k]; });
  registerProfile(me.id, { name: me.name, displayName: out.displayName, role });
  const duty = dutyBridge?.read(me);
  if (duty) out.dutyStatus = duty;
  return out;
}

function load(role) {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(keyOf(role)) || "null");
  } catch { saved = null; }
  const base = defaultsFor(role);
  const merged = { ...base, ...(saved || {}) };
  RETIRED.forEach((k) => delete merged[k]);
  const out = own(role, merged);
  // nobody signed in (the moment between sign-out and the next desk): nothing to save
  if (getUser()) {
    try { localStorage.setItem(keyOf(role), JSON.stringify(out)); } catch { /* storage blocked */ }
  }
  return out;
}

export function getSettings() {
  const role = roleNow();
  const k = ownerOf(role);
  if (!cache[k]) cache[k] = load(role);
  return cache[k];
}

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
export const useSavedAt = () => useSyncExternalStore(subscribe, () => savedAt);

function persist(role, next) {
  next = own(role, next);
  cache[ownerOf(role)] = next;
  try { localStorage.setItem(keyOf(role), JSON.stringify(next)); } catch { /* ignore */ }
  savedAt = Date.now();
  listeners.forEach((l) => l());
  applySettingsEffects();
}

export function setMany(patch) {
  const role = roleNow();
  const cur = getSettings();
  const changed = Object.keys(patch).filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(patch[k]));
  if (!changed.length) return;
  if (changed.includes("dutyStatus") && dutyBridge) dutyBridge.write(getUser(), patch.dutyStatus);
  persist(role, { ...cur, ...patch });
  const prefs = changed.filter((k) => ACCOUNT_PREFS.includes(k));
  if (prefs.length && onServer()) saveAccountPrefs(Object.fromEntries(prefs.map((k) => [k, patch[k]])));
}

/* the account keeps them; on refusal the account's values come back */
function saveAccountPrefs(prefs) {
  api
    .patch("/users/me", { prefs })
    .then(({ data }) => { if (data?.user) updateSessionUser(data.user); })
    .catch(() => refreshSettings());
}
export const setSetting = (key, value) => setMany({ [key]: value });

export function resetKeys(keys) {
  const d = defaultsFor(roleNow());
  const patch = {};
  keys.forEach((k) => { if (k && k in d) patch[k] = d[k]; });
  setMany(patch);
}

/** Back to the defaults on this device. Account fields come back from the account. */
export function resetAll() {
  const role = roleNow();
  try { localStorage.removeItem(keyOf(role)); } catch { /* ignore */ }
  delete cache[ownerOf(role)];
  savedAt = Date.now();
  listeners.forEach((l) => l());
  applySettingsEffects();
}

// Applies the settings that work app-wide right now.
export function applySettingsEffects() {
  if (typeof document === "undefined") return;
  const s = getSettings();
  const root = document.documentElement;
  root.dataset.motion = s.reduceMotion ? "reduced" : "full";
  root.dataset.contrast = s.highContrast ? "high" : "normal";
}

/** This person's settings as a file (no passwords, no tokens, no photo data). */
export function exportSettingsJson() {
  const { avatar, homeWardFrom, ...rest } = getSettings();
  void homeWardFrom;
  return JSON.stringify({ product: "Smart Kolkata", exportedAt: new Date().toISOString(), role: roleNow(), photo: avatar ? "set" : "none", settings: rest }, null, 2);
}

/* ------------------------------------------------------------- helpers */
export function initialsOf(name = "") {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

export function idCode(code, name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${code}-${String(1000 + (h % 9000))}`;
}
