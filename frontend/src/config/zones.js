// Demo seed data. Real values will come from the live feed (see services/liveFeed.js).
// `landmark: true` zones get the white callout label in the 3D city, others get a small beacon.

export const ZONES = [
  { id: "howrah", name: "Howrah Bridge", lat: 22.5851, lng: 88.3468, aqi: 58, traffic: "Slow", water: "Stable", power: "Live", landmark: true },
  { id: "central", name: "Central Kolkata", lat: 22.5705, lng: 88.3585, aqi: 42, traffic: "Slow", water: "Stable", power: "Live", landmark: true },
  { id: "esplanade", name: "Esplanade", lat: 22.5647, lng: 88.3513, aqi: 77, traffic: "Slow", water: "Stable", power: "Live", landmark: true },
  { id: "victoria", name: "Victoria Memorial", lat: 22.5448, lng: 88.3426, aqi: 52, traffic: "Clear", water: "Stable", power: "Live", landmark: true },

  { id: "college", name: "College Street", lat: 22.576, lng: 88.363, aqi: 81, traffic: "Heavy", water: "Watch", power: "Live" },
  { id: "shyambazar", name: "Shyambazar", lat: 22.601, lng: 88.372, aqi: 79, traffic: "Slow", water: "Stable", power: "Live" },
  { id: "belgachia", name: "Belgachia", lat: 22.612, lng: 88.385, aqi: 76, traffic: "Clear", water: "Stable", power: "Live" },
  { id: "salt", name: "Salt Lake", lat: 22.586, lng: 88.417, aqi: 61, traffic: "Clear", water: "Stable", power: "Live" },
  { id: "park", name: "Park Street", lat: 22.553, lng: 88.352, aqi: 74, traffic: "Slow", water: "Stable", power: "Live" },
  { id: "ballygunge", name: "Ballygunge", lat: 22.528, lng: 88.365, aqi: 68, traffic: "Clear", water: "Stable", power: "Live" },
  { id: "alipore", name: "Alipore", lat: 22.525, lng: 88.337, aqi: 71, traffic: "Clear", water: "Stable", power: "Live" },
  { id: "tollygunge", name: "Tollygunge", lat: 22.498, lng: 88.346, aqi: 73, traffic: "Slow", water: "Watch", power: "Live" },
  { id: "behala", name: "Behala", lat: 22.501, lng: 88.31, aqi: 82, traffic: "Slow", water: "Watch", power: "Hold" },
  { id: "bbdbagh", name: "B.B.D. Bagh", lat: 22.5726, lng: 88.3512, aqi: 76, traffic: "Heavy", water: "Watch", power: "Live" },
  { id: "dharmatala", name: "Dharmatala", lat: 22.561, lng: 88.352, aqi: 78, traffic: "Slow", water: "Stable", power: "Live" },
];

export const DEFAULT_ZONE_ID = "central";

// Static facts + starting values for city-wide numbers.
export const CITY = {
  population: "1.2M",
  area: "11.5 km²",
  sensors: 1247,
  uptime: 99.7,
};

export const METRIC_KEYS = ["aqi", "traffic", "water", "power"];

const TRAFFIC = { Clear: 88, Slow: 76, Heavy: 52 };
const WATER = { Stable: 92, Watch: 80 };
const POWER = { Live: 98, Hold: 86 };

// Starting numbers for a zone (the feed random-walks around these until real data arrives).
export function baseMetrics(zone) {
  return {
    aqi: zone.aqi,
    traffic: TRAFFIC[zone.traffic] ?? 75,
    water: WATER[zone.water] ?? 90,
    power: POWER[zone.power] ?? 95,
  };
}

// ---- labels ----
// std "cpcb" = India CPCB bands, "epa" = US EPA bands (Settings -> Display -> Air-quality scale)
export function aqiLabel(v, std = "cpcb") {
  if (std === "epa") {
    return v <= 50 ? "Good" : v <= 100 ? "Moderate" : v <= 150 ? "Unhealthy (sensitive)" : v <= 200 ? "Unhealthy" : v <= 300 ? "Very unhealthy" : "Hazardous";
  }
  return v <= 50 ? "Good" : v <= 100 ? "Satisfactory" : v <= 200 ? "Moderate" : v <= 300 ? "Poor" : v <= 400 ? "Very poor" : "Severe";
}
export const trafficLabel = (v) => (v >= 80 ? "Free flow" : v >= 65 ? "Moderate" : "Heavy");
export const waterLabel = (v) => (v >= 90 ? "Optimal" : v >= 82 ? "Stable" : "Watch");
export const powerLabel = (v) => (v >= 95 ? "Optimal" : v >= 88 ? "Stable" : "On hold");
export const envLabel = (v) => (v >= 80 ? "Excellent" : v >= 60 ? "Good" : v >= 40 ? "Fair" : "Poor");

// Beacon colour in the 3D city.
export function toneFor(m) {
  if (!m) return "ok";
  return m.traffic < 60 || m.water < 85 || m.power < 90 || m.aqi > 100 ? "warn" : "ok";
}

// Alerts are derived from live numbers, so they appear/disappear as the feed changes.
// When the backend starts sending its own alerts, the feed's `alertsOverride` replaces this.
export function deriveAlerts(zones) {
  const out = [];
  ZONES.forEach((z) => {
    const m = zones[z.id];
    if (!m) return;
    if (m.traffic < 60) out.push({ id: `${z.id}-traffic`, title: "Traffic Congestion", place: z.name, note: m.traffic < 50 ? "Heavy Delay" : "Moderate Delay", tone: "warn", sev: 60 - m.traffic });
    if (m.water < 85) out.push({ id: `${z.id}-water`, title: "Water Pressure", place: z.name, note: "Slight Variation", tone: "info", sev: (85 - m.water) * 1.2 });
    if (m.power < 90) out.push({ id: `${z.id}-power`, title: "Power Hold", place: z.name, note: "Load Shedding", tone: "warn", sev: 90 - m.power });
    if (m.aqi > 100) out.push({ id: `${z.id}-aqi`, title: "Air Quality", place: z.name, note: "Above Limit", tone: "warn", sev: (m.aqi - 100) / 2 });
  });
  return out.sort((a, b) => b.sev - a.sev);
}