import { useSyncExternalStore } from "react";
import { api } from "../lib/api";
import { SERVER_ON } from "../config/server";
import { getUser, subscribeRole } from "./authStore";
import { onEvent, EVENTS, STREAM_RESUMED } from "../services/events";

/* ------------------------------------------------------------------
   Service window policy: how long the city gives itself to fix an issue.
   One table, owned by command (admin), read by every desk.

     priority   the window for each priority, in hours
     ceilings   an optional cap per category: dangerous work (open
                manholes, live wires) gets at most this, whatever the
                priority says

   windowFor(priority, category) = min(priority window, category ceiling)

   Rules the board follows (store/issueStore.js):
   • a new report gets its window from this table
   • a priority change recalculates the window, counted from the original
     report time (raising the priority never hands out free hours)
   • changing this table never rewrites windows already running: issues
     keep the window they had, so nobody is marked late by a rule that
     did not exist when they took the work

   With the backend (VITE_API_URL + a server sign-in) the server owns the
   table: GET /policy on sign-in, again on "policy:changed" and after the
   live connection reconnects; command saves with PUT /policy. Without it,
   the table is kept in this browser.
------------------------------------------------------------------- */

const KEY = "sla-policy-v1";

export const DEFAULT_POLICY = {
  priority: { critical: 12, high: 24, medium: 48, low: 120 },
  ceilings: { safety: 12, electricity: 12 },
};

// the hour stops an admin steps through (1 hour to 30 days)
export const HOUR_STEPS = [1, 2, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120, 168, 240, 336, 480, 720];
export const MAX_HOURS = 720;
const ORDER = ["critical", "high", "medium", "low"];

function sane(p) {
  const out = { priority: { ...DEFAULT_POLICY.priority }, ceilings: {} };
  ORDER.forEach((k) => {
    const v = Number(p?.priority?.[k]);
    if (Number.isFinite(v) && v >= 1 && v <= MAX_HOURS) out.priority[k] = Math.round(v);
  });
  Object.entries(p?.ceilings || {}).forEach(([k, v]) => {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1 && n <= MAX_HOURS) out.ceilings[k] = Math.round(n);
  });
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sane(JSON.parse(raw)) : sane(DEFAULT_POLICY);
  } catch {
    return sane(DEFAULT_POLICY);
  }
}

let policy = load();
const listeners = new Set();

export function getPolicy() {
  return policy;
}

export function usePolicy() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    getPolicy,
    getPolicy
  );
}

/** Window in hours for this priority and category under a policy (the live one by default). */
export function windowFor(priority, category, p = policy) {
  const base = p.priority[priority] ?? p.priority.medium;
  const cap = p.ceilings[category];
  return cap ? Math.min(base, cap) : base;
}

/** What's wrong with a draft policy (empty = fine to save). */
export function policyProblems(p) {
  const out = [];
  ORDER.forEach((k) => {
    const v = p.priority[k];
    if (!Number.isFinite(v) || v < 1 || v > MAX_HOURS) out.push(`${k} needs a window between 1 and ${MAX_HOURS} hours`);
  });
  for (let i = 1; i < ORDER.length; i += 1) {
    if (p.priority[ORDER[i]] < p.priority[ORDER[i - 1]]) {
      out.push(`${ORDER[i - 1]} must not get more time than ${ORDER[i]}`);
    }
  }
  Object.entries(p.ceilings).forEach(([k, v]) => {
    if (!Number.isFinite(v) || v < 1 || v > MAX_HOURS) out.push(`the ${k} ceiling needs 1 to ${MAX_HOURS} hours`);
  });
  return out;
}

/** Plain-words list of what changed between two policies. */
export function policyDiff(a, b, labels = {}) {
  const out = [];
  ORDER.forEach((k) => {
    if (a.priority[k] !== b.priority[k]) out.push(`${labels[k] || k} ${a.priority[k]}h → ${b.priority[k]}h`);
  });
  const keys = new Set([...Object.keys(a.ceilings), ...Object.keys(b.ceilings)]);
  keys.forEach((k) => {
    const x = a.ceilings[k];
    const y = b.ceilings[k];
    if (x === y) return;
    const name = labels[k] || k;
    if (!x) out.push(`${name} ceiling set to ${y}h`);
    else if (!y) out.push(`${name} ceiling removed (was ${x}h)`);
    else out.push(`${name} ceiling ${x}h → ${y}h`);
  });
  return out;
}

const onServer = () => SERVER_ON && getUser()?.source === "server";
function setPolicy(next, persist = true) {
  policy = next;
  if (persist) { try { localStorage.setItem(KEY, JSON.stringify(policy)); } catch { /* storage blocked: the change holds for this session */ } }
  listeners.forEach((fn) => fn());
}

/** Read the table from the server (server sign-in only). */
export async function refreshPolicy() {
  if (!onServer()) return policy;
  try {
    const { data } = await api.get("/policy");
    setPolicy(sane(data), false);
  } catch { /* keep what we have; the next event or sign-in reads it again */ }
  return policy;
}

/**
 * Replace the live policy. Returns { ok:false, problems } when refused here.
 * With the server: { ok:true, saving } where saving resolves to { ok, message }
 * (the table changes on screen at once and goes back if the server says no).
 */
export function savePolicy(next) {
  const clean = sane(next);
  const problems = policyProblems(clean);
  if (problems.length) return { ok: false, problems };
  if (!onServer()) {
    setPolicy(clean);
    return { ok: true };
  }
  const before = policy;
  setPolicy(clean, false);
  const saving = api
    .put("/policy", clean)
    .then(({ data }) => { setPolicy(sane(data), false); return { ok: true, version: data?.version }; })
    .catch((err) => { setPolicy(before, false); return { ok: false, message: err?.message || "The server didn't save it." }; });
  return { ok: true, saving };
}

/* follow the server: sign-in, a save by another command desk, a reconnect */
let lastWho = "";
subscribeRole(() => {
  const who = onServer() ? getUser()?.serverId || "" : "";
  if (who && who !== lastWho) refreshPolicy();
  lastWho = who;
});
onEvent(EVENTS.POLICY_CHANGED, () => { refreshPolicy(); });
onEvent(STREAM_RESUMED, () => { refreshPolicy(); });
