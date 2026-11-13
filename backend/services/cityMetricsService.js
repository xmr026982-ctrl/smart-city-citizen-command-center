
const CityMetrics = require("../models/CityMetrics");
const CpcbObservation = require("../models/CpcbObservation");
const zones = require("./cityMetricsConfig");
const { getIO } = require("../socket/socket");

// Budgets: TomTom's free Traffic Flow tier allows 2,500 calls a day.
// 16 zones × 1 call every 15 min = 1,536 a day (the old 3 calls × 6 zones
// every 5 min was 5,184, so traffic stopped halfway through each day).
// Open-Meteo: one call for all 16 zones every 10 min. CPCB: one call every 15 min.
const INTERVALS = {
  aqi: 15 * 60 * 1000,
  traffic: 15 * 60 * 1000,
  weather: 10 * 60 * 1000,
};

const TIMEOUT_MS = 12000;
const AQI_FRESH_MS = 3 * 60 * 60 * 1000; // a station's sub-indices count when reported in the past 3 hours

let timers = [];
let started = false;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseCpcbDate(value) {
  // CPCB format: DD-MM-YYYY HH:mm:ss (Indian Standard Time).
  const match = String(value || "").match(
    /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) return null;

  const [, day, month, year, hour, minute, second] = match;

  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeStation(value) {
  return String(value || "").trim().toLowerCase();
}

async function saveCheck(zone, provider, success, values = {}, error = "") {
  const checkedAt = new Date();

  await CityMetrics.create({
    zoneId: zone.id,
    zoneName: zone.name,
    provider,
    success,
    values: success ? values : {},
    error: success
      ? ""
      : String(error || "Provider unavailable").slice(0, 300),
    checkedAt,
    location: {
      type: "Point",
      coordinates: [zone.lng, zone.lat],
    },
  });

  if (!success) return;

  // polling starts before Socket.io during start-up: the reading is saved either way,
  // and dashboards that connect later read it from GET /metrics/live
  let io = null;
  try {
    io = getIO();
  } catch {
    io = null;
  }

  if (io) {
    io.to("role:citizen")
      .to("role:staff")
      .to("role:admin")
      .emit("city:metrics", {
        zoneId: zone.id,
        zoneName: zone.name,
        ...values,
        at: checkedAt.toISOString(),
      });
  }
}

/* Station AQI from CPCB's feed.
   data.gov.in publishes each pollutant's AQI SUB-INDEX (CPCB has already
   applied its 24-hour / 8-hour averaging and its breakpoints), not a raw
   concentration. Proof in the feed itself: CO arrives as 30-90 (a sub-index;
   as mg/m³ that would be lethal), and PM2.5 can exceed PM10 (impossible for
   concentrations, normal for sub-indices).
   So the station AQI is CPCB's own rule: the highest sub-index among its
   pollutants, from readings of the past 3 hours, with at least three
   pollutants including PM2.5 or PM10. */
async function calculateStationAqi(stationKey) {
  const now = new Date();
  const freshSince = new Date(now.getTime() - AQI_FRESH_MS);

  const rows = await CpcbObservation.find({
    stationKey,
    sourceAt: { $gte: freshSince, $lte: now },
  })
    .sort({ sourceAt: 1 })
    .lean();

  // each pollutant's newest sub-index
  const subIndices = {};
  for (const row of rows) {
    const key = String(row.pollutant || "").toUpperCase().replace(".", "");
    const value = Number(row.value);
    if (!key || !Number.isFinite(value) || value < 0) continue;
    subIndices[key] = Math.min(500, Math.round(value));
  }

  const entries = Object.entries(subIndices);
  const hasParticulateMatter = entries.some(([key]) => ["PM25", "PM10"].includes(key));

  if (entries.length < 3 || !hasParticulateMatter) {
    return { aqi: null, subIndices, status: "insufficient_data", validPollutants: entries.length };
  }

  return {
    aqi: Math.max(...entries.map(([, value]) => value)),
    subIndices,
    status: "valid",
    validPollutants: entries.length,
  };
}

async function updateAqi() {
  const key = process.env.CPCB_API_KEY;
  const resourceId = process.env.CPCB_AQI_RESOURCE_ID;

  if (!key || !resourceId) {
    throw new Error("CPCB API key/resource ID is not configured");
  }

  const url = new URL(
    `https://api.data.gov.in/resource/${resourceId}`
  );

  url.searchParams.set("api-key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("filters[city]", "Kolkata");
  url.searchParams.set("limit", "1000");

  const data = await fetchJson(url.toString());
  const records = Array.isArray(data.records) ? data.records : [];

  const stations = new Map();

  for (const record of records) {
    if (
      String(record.city || "").trim().toLowerCase() !== "kolkata" ||
      String(record.state || "").trim().toLowerCase() !== "west bengal"
    ) {
      continue;
    }

    const station = String(record.station || "").trim();
    const lat = Number(record.latitude);
    const lng = Number(record.longitude);
    const pollutant = String(record.pollutant_id || "").toUpperCase();
    if (record.avg_value == null || record.avg_value === "") {
        continue;
        }

        const value = Number(record.avg_value);
    const sourceAt = parseCpcbDate(record.last_update);

    if (
      !station ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(value) ||
      value < 0 ||
      !sourceAt ||
      !pollutant
    ) {
      continue;
    }

    const stationKey = normalizeStation(station);

    if (!stations.has(stationKey)) {
      stations.set(stationKey, {
        station,
        stationKey,
        lat,
        lng,
        records: [],
      });
    }

    stations.get(stationKey).records.push({
      pollutant,
      value,
      sourceAt,
    });
  }

  if (!stations.size) {
    throw new Error("No valid Kolkata CPCB station records were returned");
  }

  // Store unique hourly records. Repeated polls update the same
  // station/pollutant/source timestamp instead of duplicating it.
  const operations = [];

  for (const station of stations.values()) {
    for (const record of station.records) {
      operations.push({
        updateOne: {
          filter: {
            stationKey: station.stationKey,
            pollutant: record.pollutant,
            sourceAt: record.sourceAt,
          },
          update: {
            $set: {
              station: station.station,
              city: "Kolkata",
              state: "West Bengal",
              value: record.value,
              unit: "sub-index", // CPCB publishes sub-indices, not concentrations
              latitude: station.lat,
              longitude: station.lng,
              collectedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (operations.length) {
    await CpcbObservation.bulkWrite(operations, { ordered: false });
  }

  // Match each dashboard zone to its nearest actual station.
  for (const zone of zones) {
    try {
      const nearest = [...stations.values()]
        .map((station) => ({
          ...station,
          distanceKm: distanceKm(
            zone.lat,
            zone.lng,
            station.lat,
            station.lng
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)[0];

      if (!nearest || !nearest.records.length) {
        throw new Error("No nearby Kolkata CPCB station was available");
      }

      const latestByPollutant = {};

      for (const record of nearest.records) {
        const previous = latestByPollutant[record.pollutant];

        if (!previous || record.sourceAt > previous.sourceAt) {
          latestByPollutant[record.pollutant] = record;
        }
      }

      const pollutants = {};

      for (const [name, record] of Object.entries(latestByPollutant)) {
        pollutants[name] = {
          value: record.value,
          unit: "sub-index",
          sourceAt: record.sourceAt.toISOString(),
        };
      }

      const aqiResult = await calculateStationAqi(nearest.stationKey);

      const stationAt = new Date(
        Math.max(
          ...nearest.records.map((record) => record.sourceAt.getTime())
        )
      );

      const values = {
        aqi: aqiResult.aqi,
        aqiStatus: aqiResult.status,
        validPollutants: aqiResult.validPollutants,
        subIndices: aqiResult.subIndices,
        pollutants,
        station: nearest.station,
        stationDistanceKm: Number(nearest.distanceKm.toFixed(2)),
        stationAt: stationAt.toISOString(),
      };

      await saveCheck(zone, "aqi", true, values);

      console.log(
        `[CityMetrics] AQI ${zone.id}: station=${nearest.station}, ` +
          `distance=${values.stationDistanceKm}km, ` +
          `AQI=${values.aqi ?? "not enough fresh readings"}`
      );
    } catch (error) {
      console.error(`[CityMetrics] AQI ${zone.id}:`, error.message);
      await saveCheck(zone, "aqi", false, {}, error.message);
    }
  }
}

/* Open-Meteo: preceding-hour precipitation in mm; temperature and apparent
   temperature in °C. One request carries every zone (comma-separated points). */
async function updateWeatherAll(list) {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", list.map((z) => z.lat).join(","));
    url.searchParams.set("longitude", list.map((z) => z.lng).join(","));
    url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation");
    url.searchParams.set("timezone", "Asia/Kolkata");
    const data = await fetchJson(url.toString());
    const rows = Array.isArray(data) ? data : [data];
    await Promise.all(list.map(async (zone, k) => {
      const current = rows[k]?.current || {};
      const heat = Number(current.temperature_2m);
      const feels = Number(current.apparent_temperature);
      const rain = Number(current.precipitation);
      if (current.temperature_2m == null || current.apparent_temperature == null || current.precipitation == null || ![heat, feels, rain].every(Number.isFinite)) {
        await saveCheck(zone, "weather", false, {}, "Weather response is missing readings");
        return;
      }
      await saveCheck(zone, "weather", true, { rain, heat, feels });
    }));
  } catch (error) {
    console.error("[CityMetrics] Weather:", error.message);
    await Promise.all(list.map((zone) => saveCheck(zone, "weather", false, {}, error.message)));
  }
}

/* TomTom traffic flow: current speed as a % of free-flow speed on the road
   segment nearest the zone's centre (one call per zone, see the budget above). */
async function updateTraffic(zone) {
  const key = process.env.TOMTOM_API_KEY;

  if (!key) {
    await saveCheck(
      zone,
      "traffic",
      false,
      {},
      "TOMTOM_API_KEY is not configured"
    );
    return;
  }

  // a zone may name its own road points (trafficPoints); they are tried in order and
  // the first valid reading is used, so a fallback costs a request only when needed
  const points = Array.isArray(zone.trafficPoints) && zone.trafficPoints.length ? zone.trafficPoints : [[zone.lat, zone.lng]];

  try {
    let traffic = null;
    let lastError = null;
    for (const [lat, lng] of points) {
      try {
        const url = new URL(
          "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"
        );

        url.searchParams.set("point", `${lat},${lng}`);
        url.searchParams.set("unit", "KMPH");
        url.searchParams.set("key", key);

        const data = await fetchJson(url.toString());
        const flow = data.flowSegmentData || {};

        if (flow.currentSpeed == null || flow.freeFlowSpeed == null) {
          throw new Error("TomTom returned missing speed values");
        }

        const current = Number(flow.currentSpeed);
        const free = Number(flow.freeFlowSpeed);

        if (
          !Number.isFinite(current) ||
          !Number.isFinite(free) ||
          free <= 0
        ) {
          throw new Error("TomTom returned an invalid road-speed sample");
        }

        traffic = Math.max(0, Math.min(100, (current / free) * 100));
        break;
      } catch (err) {
        lastError = err;
        // a refused key or the daily limit won't change at the next point
        if (/HTTP (401|403|429)/.test(err.message)) break;
      }
    }

    if (traffic === null) throw lastError || new Error("TomTom returned no reading");

    await saveCheck(zone, "traffic", true, { traffic });
  } catch (error) {
    console.error(`[CityMetrics] Traffic ${zone.id}:`, error.message);
    await saveCheck(zone, "traffic", false, {}, error.message);
  }
}

async function runProvider(provider) {
  if (provider === "aqi") {
    await updateAqi();
    return;
  }

  if (provider === "weather") {
    await updateWeatherAll(zones);
    return;
  }

  const update = { traffic: updateTraffic }[provider];

  if (!update) return;

  await Promise.all(
    zones.map((zone) =>
      update(zone).catch((error) =>
        console.error(`[CityMetrics] ${provider} ${zone.id}:`, error.message)
      )
    )
  );
}

function startCityMetricsPolling() {
  if (started) return;

  started = true;

  for (const provider of Object.keys(INTERVALS)) {
    runProvider(provider).catch((error) =>
      console.error(`[CityMetrics] ${provider} polling failed:`, error.message)
    );

    timers.push(
      setInterval(() => {
        runProvider(provider).catch((error) =>
          console.error(
            `[CityMetrics] ${provider} polling failed:`,
            error.message
          )
        );
      }, INTERVALS[provider])
    );
  }

  console.log("[CityMetrics] Provider polling started");
}

function stopCityMetricsPolling() {
  timers.forEach(clearInterval);
  timers = [];
  started = false;
}

module.exports = {
  startCityMetricsPolling,
  stopCityMetricsPolling,
};