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
  { id: "bptownship", name: "B.P. Township", lat: 22.4722, lng: 88.3878, aqi: 72, traffic: "Clear", water: "Watch", power: "Live" },
];

export const DEFAULT_ZONE_ID = "central";

// Static facts + starting values for city-wide numbers.
export const CITY = {
  population: "1.2M",
  area: "11.5 km²",
  sensors: 1247,
  uptime: 99.7,
};

export const METRIC_KEYS = ["aqi", "traffic", "rain", "heat", "feels"];

// City Health values come from the backend only.
// Retain this helper for compatibility with any existing imports.
export function baseMetrics() {
  return {
    aqi: null,
    traffic: null,
    rain: null,
    heat: null,
    feels: null,
  };
}

export function aqiLabel(value, standard = "CPCB") {
  if (!Number.isFinite(Number(value))) return "Unavailable";

  const aqi = Number(value);
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

export function trafficLabel(value) {
  if (!Number.isFinite(Number(value))) return "Unavailable";
  const v = Number(value);

  if (v >= 80) return "Free flowing";
  if (v >= 60) return "Moderate";
  if (v >= 40) return "Slow";
  return "Heavy congestion";
}

// Retained so unrelated existing imports do not break.
export function waterLabel(value) {
  if (!Number.isFinite(Number(value))) return "Unavailable";
  return Number(value) >= 85 ? "Stable" : "Watch";
}

export function powerLabel(value) {
  if (!Number.isFinite(Number(value))) return "Unavailable";
  return Number(value) >= 90 ? "Live" : "Hold";
}

export function toneFor(metrics) {
  if (!metrics) return "ok";

  const aqiWarning = Number.isFinite(Number(metrics.aqi)) && Number(metrics.aqi) > 100;
  const trafficWarning =
    Number.isFinite(Number(metrics.traffic)) && Number(metrics.traffic) < 40;
  const heatWarning =
    Number.isFinite(Number(metrics.heat)) && Number(metrics.heat) >= 40;

  return aqiWarning || trafficWarning || heatWarning ? "warn" : "ok";
}

export function deriveAlerts(zoneMetrics = {}) {
  const alerts = [];

  ZONES.forEach((zone) => {
    const metrics = zoneMetrics[zone.id];
    if (!metrics) return;

    if (Number.isFinite(Number(metrics.aqi)) && Number(metrics.aqi) > 200) {
      alerts.push({
        id: `aqi-${zone.id}`,
        zone: zone.name,
        type: "Air quality",
        severity: "high",
        message: `AQI is ${Math.round(Number(metrics.aqi))}`,
      });
    }

    if (
      Number.isFinite(Number(metrics.traffic)) &&
      Number(metrics.traffic) < 40
    ) {
      alerts.push({
        id: `traffic-${zone.id}`,
        zone: zone.name,
        type: "Traffic",
        severity: "medium",
        message: "Traffic flow is heavily reduced",
      });
    }

    if (Number.isFinite(Number(metrics.heat)) && Number(metrics.heat) >= 40) {
      alerts.push({
        id: `heat-${zone.id}`,
        zone: zone.name,
        type: "Heat",
        severity: "high",
        message: `Temperature is ${Number(metrics.heat).toFixed(1)} °C`,
      });
    }
  });

  return alerts;
}