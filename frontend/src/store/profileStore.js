import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------
   Who people are called, everywhere.

   Records (issues, the command trail, Community) store the account
   name a person had when they acted. What the screen shows is that
   person's CURRENT display name, looked up here. Rename yourself in
   Settings and every page follows, past records included.

   Each signed-in person's Settings writes their entry:
     profiles-v1 = { [accountId]: { name, displayName, role } }

   Citizens never see the names of city staff:
     admin -> "City Command", staff -> "Field crew".

   With the backend this registry comes from GET /users/names
   (docs/backend/BACKEND-HANDOVER.md · A4) and profile:updated.
------------------------------------------------------------------- */

const KEY = "profiles-v1";
const listeners = new Set();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

let registry = read();
let byName = index(registry);

function index(reg) {
  const m = new Map();
  Object.values(reg).forEach((p) => {
    if (p?.name && p.displayName && p.displayName !== p.name) m.set(p.name, p.displayName);
  });
  return m;
}

function emit() {
  byName = index(registry);
  listeners.forEach((fn) => fn());
}

/** Settings calls this for the signed-in person whenever their profile is read or saved. */
export function registerProfile(id, { name, displayName, role }) {
  if (!id || !name) return;
  const cur = registry[id];
  const next = { name, displayName: (displayName || "").trim() || name, role };
  if (cur && cur.name === next.name && cur.displayName === next.displayName && cur.role === next.role) return;
  registry = { ...registry, [id]: next };
  try {
    localStorage.setItem(KEY, JSON.stringify(registry));
  } catch {
    /* storage full: the name still shows for this session */
  }
  byName = index(registry);
  // may be called while a page renders (Settings is read during render): tell listeners after it
  queueMicrotask(() => listeners.forEach((fn) => fn()));
}

/** The current display name for an account name ("Priti Sarkar" -> "Ayanokoji"). */
export function nameFor(name) {
  if (!name) return name;
  return byName.get(name) || name;
}

/** Same, inside a sentence ("Assigned ISS-2436 to Arnab Saha"). */
export function namesIn(text) {
  if (!text || !byName.size) return text;
  let out = String(text);
  byName.forEach((shown, real) => {
    if (out.includes(real)) out = out.split(real).join(shown);
  });
  return out;
}

/* city staff, as a citizen sees them */
export const CITY_COMMAND = "City Command";
export const FIELD_CREW = "Field crew";

/** What a citizen sees for a person: their own name, or the role for city staff. */
export function publicName(name, role) {
  if (role === "admin") return CITY_COMMAND;
  if (role === "staff") return FIELD_CREW;
  return nameFor(name);
}

// another tab renamed someone: follow it
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    registry = read();
    emit();
  });
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Re-renders when anyone's display name changes. Returns { who, text, v } (v changes with every rename). */
export function useNames() {
  const v = useSyncExternalStore(subscribe, () => byName, () => byName);
  return { who: nameFor, text: namesIn, v };
}
