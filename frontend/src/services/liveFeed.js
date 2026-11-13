// ============================================================================
//  LIVE FEED: the single place the dashboard gets its City Health numbers from.
//
//  Every number comes from the server; nothing is simulated or invented.
//    GET /metrics/live   on start, sign-in, reconnect and refresh:
//                        { zones: { <zoneId>: { aqi, traffic, rain, heat, feels, at,
//                                               history?: { aqi: [..], ... } } },
//                          city: { sensors, uptime } }
//    city:metrics        one zone's new values, pushed by the server
//
//  A reading that's missing stays null and shows "No reading".
// ============================================================================
import { ZONES, METRIC_KEYS, num } from "../config/zones.js";
import { api } from "../lib/api";
import { SERVER_ON } from "../config/server";
import { getSessionKey, subscribeRole } from "../store/authStore";
import { onEvent, EVENTS, STREAM_RESUMED } from "./events";

export const HISTORY_LEN = 28;

const emptyHistory = () => Object.fromEntries(METRIC_KEYS.map((key) => [key, []]));

function emptyZone() {
  return { aqi: null, traffic: null, rain: null, heat: null, feels: null, at: null, history: emptyHistory(), aqiBasis: null, aqiHours: null };
}

function initialState() {
  const zones = {};
  ZONES.forEach((zone) => {
    zones[zone.id] = emptyZone();
  });
  return {
    mode: "offline", // "live" once the server has answered, "offline" when it can't be reached
    updatedAt: null, // ms
    zones,
    city: { sensors: null, uptime: null, envIndex: null, envHistory: [] },
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

const append = (list, value) => (value === null ? list || [] : [...(list || []), value].slice(-HISTORY_LEN));

/* the city's average AQI over the zones that have a reading */
function cityAqi(zones) {
  const values = Object.values(zones).map((z) => num(z.aqi)).filter((v) => v !== null);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

function withEnv(zones, city) {
  const envIndex = cityAqi(zones);
  const envHistory = envIndex === null || envIndex === city.envIndex ? city.envHistory : append(city.envHistory, envIndex);
  return { ...city, envIndex, envHistory };
}

function mergeZone(previous, payload, { history } = {}) {
  const next = { ...previous, history: { ...previous.history } };
  for (const key of METRIC_KEYS) {
    if (!(key in payload)) continue;
    const value = num(payload[key]);
    const changed = value !== previous[key] || payload.at !== previous.at;
    next[key] = value;
    if (Array.isArray(history?.[key])) {
      next.history[key] = history[key].map(num).filter((v) => v !== null).slice(-HISTORY_LEN);
    } else if (changed) {
      next.history[key] = append(previous.history[key], value);
    }
  }
  // AQI basis: "official" (CPCB 24 h method) or "provisional" (latest readings while history builds)
  if ("aqi" in payload) {
    const basis = payload.aqiBasis ?? (payload.aqiStatus === "provisional" ? "provisional" : payload.aqiStatus ? "official" : undefined);
    next.aqiBasis = num(payload.aqi) === null ? null : basis ?? previous.aqiBasis ?? "official";
    next.aqiHours = num(payload.aqiHours) ?? previous.aqiHours ?? null;
  }
  next.at = payload.at || previous.at;
  return next;
}

function applyZoneReading(zoneId, payload = {}) {
  if (!zoneId || !state.zones[zoneId]) return;
  const zones = { ...state.zones, [zoneId]: mergeZone(state.zones[zoneId], payload) };
  commit({ zones, city: withEnv(zones, state.city), updatedAt: Date.now(), mode: "live" });
}

function applySnapshot(data = {}) {
  const incoming = data.zones || {};
  const zones = { ...state.zones };
  for (const [zoneId, payload] of Object.entries(incoming)) {
    if (!zones[zoneId] || !payload) continue;
    zones[zoneId] = mergeZone(zones[zoneId], payload, { history: payload.history });
  }
  const city = data.city || {};
  const base = { ...state.city, sensors: num(city.sensors), uptime: num(city.uptime) };
  // the city index history is rebuilt from the zones' AQI histories when the server sends them
  const rebuilt = rebuildEnvHistory(zones);
  commit({
    zones,
    city: rebuilt ? { ...base, envIndex: cityAqi(zones), envHistory: rebuilt } : withEnv(zones, base),
    updatedAt: Date.now(),
    mode: "live",
  });
}

/* average the zones' AQI histories point by point, aligned on the newest reading */
function rebuildEnvHistory(zones) {
  const lists = Object.values(zones).map((z) => z.history.aqi).filter((l) => l && l.length);
  if (!lists.length) return null;
  const len = Math.max(...lists.map((l) => l.length));
  const out = [];
  for (let i = len; i > 0; i -= 1) {
    const values = lists.map((l) => l[l.length - i]).filter((v) => typeof v === "number");
    if (values.length) out.push(Math.round(values.reduce((a, b) => a + b, 0) / values.length));
  }
  return out.slice(-HISTORY_LEN);
}

let requestInProgress = false;

export async function refreshFeed() {
  if (!SERVER_ON || !getSessionKey()) {
    commit({ mode: "offline" });
    return;
  }
  if (requestInProgress) return;
  requestInProgress = true;
  try {
    const { data } = await api.get("/metrics/live");
    applySnapshot(data);
  } catch (error) {
    // keep the last readings on screen; the panels say the feed is offline
    commit({ mode: "offline" });
    if (error?.status !== 401) console.error("[liveFeed] refresh failed:", error?.message || error);
  } finally {
    requestInProgress = false;
  }
}

function start() {
  if (started) return;
  started = true;
  cleanup.push(onEvent(EVENTS.CITY_METRICS, (event) => applyZoneReading(event.zoneId, event)));
  cleanup.push(onEvent(STREAM_RESUMED, () => refreshFeed()));
  cleanup.push(
    subscribeRole(() => {
      if (getSessionKey()) refreshFeed();
      else {
        state = initialState();
        commit({});
      }
    })
  );
  refreshFeed();
}

function stop() {
  cleanup.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch {
      /* already removed */
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
