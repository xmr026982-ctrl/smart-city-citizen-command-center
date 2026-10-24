// ============================================================================
//  LIVE FEED: the single place the dashboard gets its numbers from.
//
//  TODAY  : a built-in simulator (mode "simulated") random-walks the values.
//  LATER  : Person 6 (real-time/admin) calls connectSocketFeed(socket) once,
//           or calls the ingest*() functions from any source (REST polling, SSE...).
//           No dashboard component needs to change.
//
//  PAYLOADS the ingest functions accept:
//    ingestZoneMetrics(zoneId, { aqi, traffic, water, power, ts? })   // any subset
//    ingestBatch([{ zoneId, aqi, traffic, water, power, ts? }, ...])
//    ingestCity({ sensors, uptime, envIndex })                         // any subset
//    ingestAlerts([{ id, title, place, note, tone: "warn"|"info"|"ok", sev }])
//
//  SOCKET EVENTS expected by connectSocketFeed:
//    "zone:metrics"  -> one zone payload     "city:stats" -> city payload
//    "alerts:list"   -> alerts array
// ============================================================================
import { ZONES, CITY, METRIC_KEYS, baseMetrics } from "../config/zones.js";

export const HISTORY_LEN = 28;
let tickMs = 2500;

const LIMITS = { aqi: [18, 190], traffic: [35, 98], water: [60, 100], power: [70, 100] };
const STEP = { aqi: 3.2, traffic: 5, water: 2.4, power: 1.6 };

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

function rng(seedStr) {
  let s = 0;
  for (const ch of seedStr) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A believable history that ends exactly on the current value.
function seedHistory(base, key, id) {
  const r = rng(`${id}:${key}`);
  const raw = [];
  let v = base;
  for (let i = 0; i < HISTORY_LEN; i++) {
    v = clamp(v + (r() - 0.5) * STEP[key] * 1.6, LIMITS[key]);
    raw.push(v);
  }
  const shift = base - raw[raw.length - 1];
  return raw.map((x) => round1(clamp(x + shift, LIMITS[key])));
}

const BASE = {};
function buildInitial() {
  const zones = {};
  ZONES.forEach((z) => {
    const b = baseMetrics(z);
    BASE[z.id] = b;
    zones[z.id] = { ...b, history: {} };
    METRIC_KEYS.forEach((k) => { zones[z.id].history[k] = seedHistory(b[k], k, z.id); });
  });
  const env = envFrom(zones);
  return {
    mode: "simulated", // "simulated" | "live" | "offline"
    updatedAt: Date.now(),
    zones,
    city: {
      sensors: CITY.sensors,
      uptime: CITY.uptime,
      envIndex: env,
      envHistory: seedHistory(env, "power", "env"),
    },
    alertsOverride: null,
  };
}

// City environmental index: higher is better, falls as average AQI rises.
function envFrom(zones) {
  const ids = Object.keys(zones);
  const avg = ids.reduce((s, id) => s + zones[id].aqi, 0) / ids.length;
  return Math.round(clamp(100 - avg * 0.45, [0, 100]));
}

let state = buildInitial();
const listeners = new Set();
let timer = null;

function commit(patch) {
  state = { ...state, ...patch }; // new reference every time, required by useSyncExternalStore
  listeners.forEach((l) => l());
}

export const getFeed = () => state;

function mergeBatch(zones, batch) {
  const next = { ...zones };
  batch.forEach((p) => {
    const cur = next[p.zoneId];
    if (!cur) return;
    const upd = { ...cur, history: { ...cur.history } };
    METRIC_KEYS.forEach((k) => {
      if (typeof p[k] === "number" && Number.isFinite(p[k])) {
        const v = round1(p[k]);
        upd[k] = v;
        upd.history[k] = [...cur.history[k], v].slice(-HISTORY_LEN);
      }
    });
    next[p.zoneId] = upd;
  });
  return next;
}

function mergeCity(city, c) {
  const next = { ...city };
  if (typeof c.sensors === "number") next.sensors = Math.round(c.sensors);
  if (typeof c.uptime === "number") next.uptime = Math.round(c.uptime * 100) / 100;
  if (typeof c.envIndex === "number") {
    next.envIndex = Math.round(c.envIndex);
    next.envHistory = [...city.envHistory, next.envIndex].slice(-HISTORY_LEN);
  }
  return next;
}

// ------------------------- public ingest API (Person 6) -------------------------
export function ingestBatch(batch) {
  const ts = batch.find((b) => b.ts)?.ts || Date.now();
  commit({ zones: mergeBatch(state.zones, batch), updatedAt: ts });
}
export function ingestZoneMetrics(zoneId, payload) {
  ingestBatch([{ ...payload, zoneId }]);
}
export function ingestCity(payload) {
  commit({ city: mergeCity(state.city, payload), updatedAt: Date.now() });
}
export function ingestAlerts(list) {
  commit({ alertsOverride: Array.isArray(list) ? list : null, updatedAt: Date.now() });
}

export function connectSocketFeed(socket) {
  stopSimulator();
  commit({ mode: "live", alertsOverride: null });
  const onZone = (p) => p && p.zoneId && ingestZoneMetrics(p.zoneId, p);
  const onCity = (p) => p && ingestCity(p);
  const onAlerts = (p) => ingestAlerts(p);
  const onDown = () => commit({ mode: "offline" });
  const onUp = () => commit({ mode: "live" });
  socket.on("zone:metrics", onZone);
  socket.on("city:stats", onCity);
  socket.on("alerts:list", onAlerts);
  socket.on("disconnect", onDown);
  socket.on("connect", onUp);
  return () => {
    socket.off("zone:metrics", onZone);
    socket.off("city:stats", onCity);
    socket.off("alerts:list", onAlerts);
    socket.off("disconnect", onDown);
    socket.off("connect", onUp);
    commit({ mode: "simulated", alertsOverride: null });
    if (listeners.size) startSimulator();
  };
}

// ------------------------- simulator (placeholder data) -------------------------
export function tick() {
  const batch = ZONES.map((z) => {
    const cur = state.zones[z.id];
    const base = BASE[z.id];
    const out = { zoneId: z.id };
    METRIC_KEYS.forEach((k) => {
      const pull = (base[k] - cur[k]) * 0.1; // drift back toward the zone's normal level
      const noise = (Math.random() - 0.5) * STEP[k];
      out[k] = clamp(cur[k] + pull + noise, LIMITS[k]);
    });
    return out;
  });
  const zones = mergeBatch(state.zones, batch);
  const city = mergeCity(state.city, {
    sensors: clamp(state.city.sensors + Math.round((Math.random() - 0.5) * 6) + Math.sign(1247 - state.city.sensors), [1230, 1262]),
    uptime: clamp(state.city.uptime + (Math.random() - 0.5) * 0.06, [99.5, 99.95]),
    envIndex: envFrom(zones),
  });
  commit({ zones, city, updatedAt: Date.now() });
}

function startSimulator() {
  if (timer || state.mode !== "simulated") return;
  timer = setInterval(tick, tickMs);
}
function stopSimulator() {
  if (timer) clearInterval(timer);
  timer = null;
}

// Starts the simulator when the first component subscribes, stops with the last one.
export function subscribeFeed(cb) {
  listeners.add(cb);
  if (listeners.size === 1) startSimulator();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stopSimulator();
  };
}

// Settings -> "Live data refresh" calls this. Takes milliseconds.
export function setFeedInterval(ms) {
  const next = Math.max(1000, Number(ms) || 2500);
  if (next === tickMs) return;
  tickMs = next;
  if (timer) { stopSimulator(); startSimulator(); }
}

// The refresh button on System Uptime calls this.
export function refreshFeed() {
  if (state.mode === "simulated") tick();
}