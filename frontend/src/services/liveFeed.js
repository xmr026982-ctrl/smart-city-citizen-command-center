import { ZONES, CITY, METRIC_KEYS } from "../config/zones.js";
import { api } from "../lib/api";
import { SERVER_ON } from "../config/server";
import { getToken, subscribeRole } from "../store/authStore";
import { onEvent, EVENTS, STREAM_RESUMED } from "./events";

export const HISTORY_LEN = 28;

function emptyHistory() {
  return Object.fromEntries(METRIC_KEYS.map((key) => [key, []]));
}

function emptyZone() {
  return {
    aqi: null,
    traffic: null,
    rain: null,
    heat: null,
    feels: null,
    at: null,
    history: emptyHistory(),
  };
}

function initialState() {
  const zones = {};
  ZONES.forEach((zone) => {
    zones[zone.id] = emptyZone();
  });

  return {
    mode: "offline",
    updatedAt: null,
    zones,
    city: {
      sensors: 0,
      uptime: null,
      envIndex: null,
      envHistory: [],
    },
    alertsOverride: null,
  };
}

let state = initialState();
const listeners = new Set();
let started = false;
let cleanup = [];

function commit(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("[liveFeed] subscriber failed:", error);
    }
  });
}

export const getFeed = () => state;

function appendHistory(history, key, value) {
  if (!Number.isFinite(Number(value))) return history;
  return [...(history || []), Number(value)].slice(-HISTORY_LEN);
}

function applyZoneReading(zoneId, payload = {}) {
  if (!zoneId || !state.zones[zoneId]) return;

  const previous = state.zones[zoneId];
  const next = { ...previous, history: { ...previous.history } };

  for (const key of METRIC_KEYS) {
    if (payload[key] === null || payload[key] === undefined) continue;

    const value = Number(payload[key]);
    if (!Number.isFinite(value)) continue;

    next[key] = value;
    next.history[key] = appendHistory(previous.history[key], key, value);
  }

  next.at = payload.at || new Date().toISOString();

  commit({
    zones: { ...state.zones, [zoneId]: next },
    updatedAt: next.at,
    mode: "live",
  });
}

function applySnapshot(data = {}) {
  const incoming = data.zones || {};
  const zones = { ...state.zones };

  for (const [zoneId, payload] of Object.entries(incoming)) {
    if (!zones[zoneId] || !payload) continue;

    const previous = zones[zoneId];
    const next = { ...previous, history: { ...previous.history } };

    for (const key of METRIC_KEYS) {
      const raw = payload[key];
      if (raw === null || raw === undefined) continue;

      const value = Number(raw);
      if (!Number.isFinite(value)) continue;

      next[key] = value;
      next.history[key] = appendHistory(previous.history[key], key, value);
    }

    next.at = payload.at || previous.at;
    zones[zoneId] = next;
  }

  const city = data.city || {};

  commit({
    zones,
    city: {
      ...state.city,
      sensors: Number.isFinite(Number(city.sensors))
        ? Number(city.sensors)
        : state.city.sensors,
      uptime: city.uptime === null || city.uptime === undefined
        ? state.city.uptime
        : Number(city.uptime),
    },
    updatedAt: new Date().toISOString(),
    mode: "live",
  });
}

let requestInProgress = false;

export async function refreshFeed() {
  if (!SERVER_ON || !getToken()) {
    commit({ mode: "offline" });
    return;
  }

  if (requestInProgress) return;
  requestInProgress = true;

  try {
    const { data } = await api.get("/metrics/live");
    applySnapshot(data);
  } catch (error) {
    // Preserve the last successful readings when the API is temporarily down.
    commit({ mode: "offline" });
    console.error("[liveFeed] refresh failed:", error.message);
  } finally {
    requestInProgress = false;
  }
}

function start() {
  if (started) return;
  started = true;

  cleanup.push(
    onEvent(EVENTS.CITY_METRICS, (event) => {
      applyZoneReading(event.zoneId, event);
    })
  );

  cleanup.push(
    onEvent(STREAM_RESUMED, () => {
      refreshFeed();
    })
  );

  cleanup.push(
    subscribeRole(() => {
      if (getToken()) refreshFeed();
      else commit({ mode: "offline" });
    })
  );

  refreshFeed();
}

function stop() {
  cleanup.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch {
      // Ignore an already-removed listener.
    }
  });

  cleanup = [];
  started = false;
}

export function subscribeFeed(callback) {
  listeners.add(callback);
  start();

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) stop();
  };
}

export function ingestZoneMetrics(zoneId, payload) {
  applyZoneReading(zoneId, payload);
}

export function ingestBatch(batch = []) {
  batch.forEach((item) => {
    applyZoneReading(item.zoneId, item);
  });
}

export function ingestCity(payload = {}) {
  commit({
    city: { ...state.city, ...payload },
    updatedAt: new Date().toISOString(),
  });
}

export function ingestAlerts(list) {
  commit({ alertsOverride: Array.isArray(list) ? list : [] });
}

export function connectSocketFeed() {
  // The shared realtime service owns the socket.
  // This function remains as a compatibility no-op for older callers.
  refreshFeed();
  return () => {};
}

export function setFeedInterval() {
  // Live readings are pushed by the backend; no client-side simulator.
}

export function tick() {
  // Intentionally disabled: City Health must never generate fake readings.
}