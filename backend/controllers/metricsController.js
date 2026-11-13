const CityMetrics = require("../models/CityMetrics");
const zones = require("../services/cityMetricsConfig");

const PROVIDERS = ["aqi", "traffic", "weather"];
const FIELDS = { aqi: ["aqi"], traffic: ["traffic"], weather: ["rain", "heat", "feels"] };

// How old a provider's last good reading may be and still be shown.
// (A source that fails keeps its last value with its time; it's never invented.)
const SHOW_LIMIT = {
  aqi: 3 * 60 * 60 * 1000,
  traffic: 45 * 60 * 1000,
  weather: 90 * 60 * 1000,
};
// Older than this and the reading counts as stale (still shown, flagged).
const FRESH_LIMIT = {
  aqi: 45 * 60 * 1000,
  traffic: 15 * 60 * 1000,
  weather: 30 * 60 * 1000,
};

const HISTORY_LEN = 28;
const DAY = 24 * 60 * 60 * 1000;

const real = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* GET /api/metrics/live (any signed-in role)
   { zones: { <zoneId>: { aqi, traffic, rain, heat, feels, at, history, providers } },
     city: { sensors, uptime, monitoredZones } } */
exports.getLiveMetrics = async (req, res, next) => {
  try {
    const now = Date.now();
    const since24h = new Date(now - DAY);
    const since1h = new Date(now - 60 * 60 * 1000);
    const zoneIds = zones.map((zone) => zone.id);

    const records = await CityMetrics.find({ zoneId: { $in: zoneIds }, provider: { $in: PROVIDERS }, checkedAt: { $gte: since24h } })
      .select("zoneId provider success values checkedAt")
      .sort({ checkedAt: 1 })
      .lean();

    const result = {};
    for (const zone of zones) {
      result[zone.id] = {
        aqi: null,
        traffic: null,
        rain: null,
        heat: null,
        feels: null,
        at: null,
        history: { aqi: [], traffic: [], rain: [], heat: [], feels: [] },
        providers: { aqi: null, traffic: null, weather: null },
        aqiBasis: null, // "official" (CPCB's published sub-indices) | null; "provisional" is kept for compatibility
        aqiHours: null, // unused since CPCB's own index is used directly
      };
    }

    const lastGood = new Map(); // "zone:provider" -> newest good record
    const lastCheck = new Map(); // "zone:provider" -> newest record, good or failed
    const activeFeeds = new Set();
    let checks = 0;
    let good = 0;

    for (const r of records) {
      const target = result[r.zoneId];
      if (!target) continue;
      // AQI saved as "provisional" came from a build that read CPCB's sub-indices as
      // concentrations (values 2-5x too high): never shown, never in the sparkline
      if (r.provider === "aqi" && r.values?.aqiStatus === "provisional") continue;
      checks += 1;
      lastCheck.set(`${r.zoneId}:${r.provider}`, r);
      if (!r.success) continue;
      good += 1;
      lastGood.set(`${r.zoneId}:${r.provider}`, r);
      if (new Date(r.checkedAt) >= since1h) activeFeeds.add(`${r.zoneId}:${r.provider}`);
      for (const field of FIELDS[r.provider]) {
        const v = real(r.values?.[field]);
        if (v !== null) target.history[field].push(v);
      }
    }

    for (const zone of zones) {
      const target = result[zone.id];
      for (const field of Object.keys(target.history)) target.history[field] = target.history[field].slice(-HISTORY_LEN);

      for (const provider of PROVIDERS) {
        const key = `${zone.id}:${provider}`;
        const rec = lastGood.get(key);
        const check = lastCheck.get(key);
        const age = rec ? now - new Date(rec.checkedAt).getTime() : Infinity;

        target.providers[provider] = check
          ? {
              success: check.success === true,
              checkedAt: new Date(check.checkedAt).toISOString(),
              stale: age > FRESH_LIMIT[provider],
            }
          : null;

        if (!rec || age > SHOW_LIMIT[provider]) continue;
        for (const field of FIELDS[provider]) target[field] = real(rec.values?.[field]);
        if (provider === "aqi" && target.aqi !== null) {
          target.aqiBasis = rec.values?.aqiStatus === "provisional" ? "provisional" : "official";
          target.aqiHours = real(rec.values?.aqiHours);
        }
        const at = new Date(rec.checkedAt).toISOString();
        if (!target.at || at > target.at) target.at = at;
      }
    }

    return res.status(200).json({
      zones: result,
      city: {
        sensors: activeFeeds.size, // zone/provider feeds that answered in the past hour
        uptime: checks ? Number(((good / checks) * 100).toFixed(1)) : null, // share of good checks, 24 h
        monitoredZones: zones.length,
        checkedAt: new Date(now).toISOString(),
      },
    });
  } catch (error) {
    return next(error);
  }
};
