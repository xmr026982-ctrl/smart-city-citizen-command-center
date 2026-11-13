// The 16 places on the 3D city. Positions and names only: every reading comes
// from the server (GET /metrics/live and the city:metrics event, services/liveFeed.js).
// `landmark: true` zones get the white callout label in the 3D city, others get a small beacon.

export const ZONES = [
  { id: "howrah", name: "Howrah Bridge", lat: 22.5851, lng: 88.3468, landmark: true },
  { id: "central", name: "Central Kolkata", lat: 22.5705, lng: 88.3585, landmark: true },
  { id: "esplanade", name: "Esplanade", lat: 22.5647, lng: 88.3513, landmark: true },
  { id: "victoria", name: "Victoria Memorial", lat: 22.5448, lng: 88.3426, landmark: true },

  { id: "college", name: "College Street", lat: 22.576, lng: 88.363 },
  { id: "shyambazar", name: "Shyambazar", lat: 22.601, lng: 88.372 },
  { id: "belgachia", name: "Belgachia", lat: 22.612, lng: 88.385 },
  { id: "salt", name: "Salt Lake", lat: 22.586, lng: 88.417 },
  { id: "park", name: "Park Street", lat: 22.553, lng: 88.352 },
  { id: "ballygunge", name: "Ballygunge", lat: 22.528, lng: 88.365 },
  { id: "alipore", name: "Alipore", lat: 22.525, lng: 88.337 },
  { id: "tollygunge", name: "Tollygunge", lat: 22.498, lng: 88.346 },
  { id: "behala", name: "Behala", lat: 22.501, lng: 88.31 },
  { id: "bbdbagh", name: "B.B.D. Bagh", lat: 22.5726, lng: 88.3512 },
  { id: "dharmatala", name: "Dharmatala", lat: 22.561, lng: 88.352 },
  { id: "bptownship", name: "B.P. Township", lat: 22.4722, lng: 88.3878 },
];

export const DEFAULT_ZONE_ID = "central";

// Fixed facts about the city (Kolkata Municipal Corporation, Census 2011).
export const CITY = {
  population: "4.5M",
  area: "206 km²",
};

// The readings City Health shows. Water and power have no public live source, so they're not shown.
export const METRIC_KEYS = ["aqi", "traffic", "rain", "heat", "feels"];

/** A number, or null when the reading is missing. (Number(null) is 0, so never use it alone.) */
export function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---- labels ----
// std "cpcb" = India CPCB bands, "epa" = US EPA bands (Settings -> Display -> Air-quality scale)
export function aqiLabel(value, std = "cpcb") {
  const v = num(value);
  if (v === null) return "No reading";
  if (String(std).toLowerCase() === "epa") {
    return v <= 50 ? "Good" : v <= 100 ? "Moderate" : v <= 150 ? "Unhealthy (sensitive)" : v <= 200 ? "Unhealthy" : v <= 300 ? "Very unhealthy" : "Hazardous";
  }
  return v <= 50 ? "Good" : v <= 100 ? "Satisfactory" : v <= 200 ? "Moderate" : v <= 300 ? "Poor" : v <= 400 ? "Very poor" : "Severe";
}

/** Traffic is the % of free-flow speed (TomTom). */
export function trafficLabel(value) {
  const v = num(value);
  if (v === null) return "No reading";
  return v >= 80 ? "Free flow" : v >= 60 ? "Moderate" : v >= 40 ? "Slow" : "Heavy congestion";
}

/** Rainfall in mm over the past hour (Open-Meteo). */
export function rainLabel(value) {
  const v = num(value);
  if (v === null) return "No reading";
  return v === 0 ? "Dry" : v < 2.5 ? "Light rain" : v < 7.6 ? "Moderate rain" : v < 50 ? "Heavy rain" : "Very heavy rain";
}

/** The city's average AQI label (the Environmental Index panel). */
export const envLabel = (value, std = "cpcb") => aqiLabel(value, std);

// Warning thresholds. A missing reading never counts as a warning.
const AQI_WARN = 200; // CPCB "Poor" and worse
const TRAFFIC_WARN = 40; // below 40% of free-flow speed
const HEAT_WARN = 40; // °C
const RAIN_WARN = 7.6; // mm/h, heavy rain

// Beacon colour in the 3D city.
export function toneFor(m) {
  if (!m) return "ok";
  const aqi = num(m.aqi);
  const traffic = num(m.traffic);
  const heat = num(m.heat);
  const rain = num(m.rain);
  return (aqi !== null && aqi > AQI_WARN) || (traffic !== null && traffic < TRAFFIC_WARN) || (heat !== null && heat >= HEAT_WARN) || (rain !== null && rain >= RAIN_WARN)
    ? "warn"
    : "ok";
}

// Alerts are derived from the live readings, so they appear and clear as readings change.
// Shape read by the Live Alerts panel: { id, title, place, note, tone, sev }.
export function deriveAlerts(zones = {}) {
  const out = [];
  ZONES.forEach((z) => {
    const m = zones[z.id];
    if (!m) return;
    const aqi = num(m.aqi);
    const traffic = num(m.traffic);
    const heat = num(m.heat);
    const rain = num(m.rain);
    if (aqi !== null && aqi > AQI_WARN) out.push({ id: `${z.id}-aqi`, title: "Air Quality", place: z.name, note: `AQI ${Math.round(aqi)} · ${aqiLabel(aqi)}`, tone: "warn", sev: (aqi - AQI_WARN) / 2 + 20 });
    if (traffic !== null && traffic < TRAFFIC_WARN) out.push({ id: `${z.id}-traffic`, title: "Traffic Congestion", place: z.name, note: `${Math.round(traffic)}% of free flow`, tone: "warn", sev: TRAFFIC_WARN - traffic + 10 });
    if (heat !== null && heat >= HEAT_WARN) out.push({ id: `${z.id}-heat`, title: "Heat", place: z.name, note: `${heat.toFixed(1)} °C`, tone: "warn", sev: (heat - HEAT_WARN) * 4 + 15 });
    if (rain !== null && rain >= RAIN_WARN) out.push({ id: `${z.id}-rain`, title: "Heavy Rain", place: z.name, note: `${rain.toFixed(1)} mm in the past hour`, tone: "info", sev: rain });
  });
  return out.sort((a, b) => b.sev - a.sev);
}
