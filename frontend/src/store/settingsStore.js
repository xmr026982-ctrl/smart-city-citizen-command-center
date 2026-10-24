import { useSyncExternalStore } from "react";
import { getRole } from "./authStore";
import { defaultsFor } from "../config/settingsSchema";
import { setFeedInterval } from "../services/liveFeed";
import { deviceName } from "../services/settingsService";

// Settings are stored per role in localStorage. Passwords are NEVER stored here.
const DAY = 864e5;
const keyOf = (role) => `sc-settings:${role}`;
const logKeyOf = (role) => `sc-log:${role}`;
const cache = {};
const listeners = new Set();
let savedAt = 0;

const roleNow = () => getRole() || "citizen";

function freshDefaults(role) {
  const now = Date.now();
  return {
    ...defaultsFor(role),
    emailVerified: true,
    passwordChangedAt: now - 30 * DAY,
    sessions: [
      { id: "current", device: deviceName(), place: "Kolkata, IN", ts: now, current: true },
      { id: "s2", device: "Android · Chrome", place: "Kolkata, IN", ts: now - 3 * 3600e3 },
      { id: "s3", device: "Windows · Edge", place: "Howrah, IN", ts: now - 2 * DAY },
    ],
  };
}

function load(role) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(keyOf(role)) || "null"); } catch { saved = null; }
  const base = freshDefaults(role);
  const merged = saved ? { ...base, ...saved } : base;
  if (!saved) {
    try { localStorage.setItem(keyOf(role), JSON.stringify(merged)); } catch { /* storage blocked */ }
  }
  return merged;
}

export function getSettings() {
  const role = roleNow();
  if (!cache[role]) cache[role] = load(role);
  return cache[role];
}
export const getSetting = (k) => getSettings()[k];

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
export const useSavedAt = () => useSyncExternalStore(subscribe, () => savedAt);

const short = (key, v) => {
  if (key === "sessions") return `${v.length} sessions`;
  if (key === "avatar") return v ? "photo set" : "photo removed"; // never log the image itself
  if (Array.isArray(v)) return v.join("|");
  return v && typeof v === "object" ? "[object]" : String(v);
};

function logChange(role, key, value) {
  try {
    const k = logKeyOf(role);
    const arr = JSON.parse(localStorage.getItem(k) || "[]");
    arr.push({ ts: Date.now(), key, value: short(key, value) });
    localStorage.setItem(k, JSON.stringify(arr.slice(-200)));
  } catch { /* ignore */ }
}

function persist(role, next) {
  cache[role] = next;
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
  changed.forEach((k) => logChange(role, k, patch[k]));
  persist(role, { ...cur, ...patch });
}
export const setSetting = (key, value) => setMany({ [key]: value });

export function resetKeys(keys) {
  const d = defaultsFor(roleNow());
  const patch = {};
  keys.forEach((k) => { if (k && k in d) patch[k] = d[k]; });
  setMany(patch);
}

export function resetAll() {
  const role = roleNow();
  try { localStorage.removeItem(keyOf(role)); localStorage.removeItem(logKeyOf(role)); } catch { /* ignore */ }
  delete cache[role];
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
  setFeedInterval((Number(s.feedInterval) || 2.5) * 1000);
}

export function exportSettingsJson() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), role: roleNow(), settings: getSettings() }, null, 2);
}

export function auditCsv() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(logKeyOf(roleNow())) || "[]"); } catch { arr = []; }
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return ["time,setting,new_value", ...arr.map((e) => [new Date(e.ts).toISOString(), e.key, esc(e.value)].join(","))].join("\n");
}

// ------------------------------------------------------------- derived helpers
export function securityScore(s) {
  let n = 35;
  if (s.twoFactor) n += 25;
  if (s.emailVerified) n += 10;
  if (s.passwordChangedAt && Date.now() - s.passwordChangedAt < 90 * DAY) n += 15;
  if (s.loginAlerts) n += 5;
  if (s.biometric) n += 5;
  if ((s.sessions || []).length <= 2) n += 5;
  return Math.min(100, n);
}
export const securityLabel = (n) => (n >= 85 ? "Hardened" : n >= 65 ? "Strong" : n >= 45 ? "Fair" : "At risk");

export function securityTips(s) {
  const t = [];
  if (!s.twoFactor) t.push({ text: "Turn on two-step verification", pts: 25, to: "security" });
  if (!s.passwordChangedAt || Date.now() - s.passwordChangedAt >= 90 * DAY) t.push({ text: "Change your password", pts: 15, to: "password" });
  if (!s.biometric) t.push({ text: "Enable passkey sign-in", pts: 5, to: "security" });
  if ((s.sessions || []).length > 2) t.push({ text: "Sign out unused devices", pts: 5, to: "security" });
  return t;
}

export function initialsOf(name = "") {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

export function idCode(code, name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${code}-${String(1000 + (h % 9000))}`;
}