
const CityMetrics = require("../models/CityMetrics");
const CpcbObservation = require("../models/CpcbObservation");
const zones = require("./cityMetricsConfig");
const { getIO } = require("../socket/socket");

const INTERVALS = {
  aqi: 15 * 60 * 1000,
  traffic: 5 * 60 * 1000,
  weather: 10 * 60 * 1000,
};

const TIMEOUT_MS = 12000;
const AQI_HISTORY_HOURS = 24;

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

  const io = getIO();

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

// CPCB National AQI concentration breakpoints.
// Concentration units: µg/m³ except CO, which is mg/m³.
const BREAKPOINTS = {
  PM25: [
    [0, 30, 0, 50],
    [31, 60, 51, 100],
    [61, 90, 101, 200],
    [91, 120, 201, 300],
    [121, 250, 301, 400],
    [251, 500, 401, 500],
  ],
  PM10: [
    [0, 50, 0, 50],
    [51, 100, 51, 100],
    [101, 250, 101, 200],
    [251, 350, 201, 300],
    [351, 430, 301, 400],
    [431, 600, 401, 500],
  ],
  NO2: [
    [0, 40, 0, 50],
    [41, 80, 51, 100],
    [81, 180, 101, 200],
    [181, 280, 201, 300],
    [281, 400, 301, 400],
    [401, 600, 401, 500],
  ],
  SO2: [
    [0, 40, 0, 50],
    [41, 80, 51, 100],
    [81, 380, 101, 200],
    [381, 800, 201, 300],
    [801, 1600, 301, 400],
    [1601, 2000, 401, 500],
  ],
  NH3: [
    [0, 200, 0, 50],
    [201, 400, 51, 100],
    [401, 800, 101, 200],
    [801, 1200, 201, 300],
    [1201, 1800, 301, 400],
    [1801, 2400, 401, 500],
  ],
  CO: [
    [0, 1, 0, 50],
    [1.1, 2, 51, 100],
    [2.1, 10, 101, 200],
    [10.1, 17, 201, 300],
    [17.1, 34, 301, 400],
    [34.1, 50, 401, 500],
  ],
  OZONE: [
    [0, 50, 0, 50],
    [51, 100, 51, 100],
    [101, 168, 101, 200],
    [169, 208, 201, 300],
    [209, 748, 301, 400],
    [748.1, 1000, 401, 500],
  ],
};

function toAqiSubIndex(pollutant, concentration) {
  const ranges = BREAKPOINTS[pollutant];

  if (!ranges || !Number.isFinite(concentration) || concentration < 0) {
    return null;
  }

  for (const [cLow, cHigh, iLow, iHigh] of ranges) {
    if (concentration >= cLow && concentration <= cHigh) {
      const result =
        ((iHigh - iLow) / (cHigh - cLow)) *
          (concentration - cLow) +
        iLow;

      return Math.round(result);
    }
  }

  return concentration > ranges[ranges.length - 1][1] ? 500 : null;
}

function pollutantAverage(rows) {
  if (!rows.length) return null;

  return rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
}

async function calculateStationAqi(stationKey) {
  const now = new Date();
  const historyStart = new Date(
    now.getTime() - AQI_HISTORY_HOURS * 60 * 60 * 1000
  );

  const history = await CpcbObservation.find({
    stationKey,
    sourceAt: { $gte: historyStart, $lte: now },
  })
    .sort({ sourceAt: 1 })
    .lean();

  const grouped = {};

  for (const row of history) {
    const pollutant = String(row.pollutant || "").toUpperCase();

    if (!grouped[pollutant]) grouped[pollutant] = [];

    grouped[pollutant].push(row);
  }

  const subIndices = {};
  const averages = {};

  // PM2.5, PM10, NO2, SO2 and NH3 use 24-hour averages.
  // At least 16 distinct hourly readings are required.
  const dailyPollutants = ["PM2.5", "PM10", "NO2", "SO2", "NH3"];

  for (const pollutant of dailyPollutants) {
    const rows = grouped[pollutant] || [];

    const uniqueHours = new Set(
      rows.map((row) => row.sourceAt.toISOString())
    );

    if (uniqueHours.size < 16) continue;

    const average = pollutantAverage(rows);

    if (average === null) continue;

    const key = pollutant.replace(".", "");
    averages[key] = average;

    const subIndex = toAqiSubIndex(key, average);

    if (subIndex !== null) {
      subIndices[key] = subIndex;
    }
  }

  // CO and ozone require 8-hour averages.
  // Require at least 16 distinct hourly records in the 24-hour
  // history and at least 6 readings in the most recent 8 hours.
  for (const pollutant of ["CO", "OZONE"]) {
    const rows = grouped[pollutant] || [];

    const unique24h = new Set(
      rows.map((row) => row.sourceAt.toISOString())
    );

    if (unique24h.size < 16) continue;

    const lastEightHours = rows.filter(
      (row) =>
        now.getTime() - row.sourceAt.getTime() <= 8 * 60 * 60 * 1000
    );

    if (lastEightHours.length < 8) continue;

    const average = pollutantAverage(lastEightHours);
    if (average === null) continue;

    averages[pollutant] = average;

    const subIndex = toAqiSubIndex(pollutant, average);

    if (subIndex !== null) {
      subIndices[pollutant] = subIndex;
    }
  }

  const validEntries = Object.entries(subIndices);

  const hasParticulateMatter = validEntries.some(([key]) =>
    ["PM25", "PM10"].includes(key)
  );

  if (validEntries.length < 3 || !hasParticulateMatter) {
    return {
      aqi: null,
      subIndices,
      averages,
      status: "insufficient_data",
      validPollutants: validEntries.length,
    };
  }

  return {
    aqi: Math.max(...validEntries.map(([, value]) => value)),
    subIndices,
    averages,
    status: "valid",
    validPollutants: validEntries.length,
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
              unit: record.pollutant === "CO" ? "mg/m³" : "µg/m³",
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
          unit: name === "CO" ? "mg/m³" : "µg/m³",
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
        averages: aqiResult.averages,
        pollutants,
        station: nearest.station,
        stationDistanceKm: Number(nearest.distanceKm.toFixed(2)),
        stationAt: stationAt.toISOString(),
      };

      await saveCheck(zone, "aqi", true, values);

      console.log(
        `[CityMetrics] AQI ${zone.id}: station=${nearest.station}, ` +
          `distance=${values.stationDistanceKm}km, ` +
          `AQI=${values.aqi ?? "collecting history"}`
      );
    } catch (error) {
      console.error(`[CityMetrics] AQI ${zone.id}:`, error.message);
      await saveCheck(zone, "aqi", false, {}, error.message);
    }
  }
}

/* Open-Meteo: preceding-hour precipitation in mm.
   Temperature and apparent temperature are instantaneous °C values. */
async function updateWeather(zone) {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.searchParams.set("latitude", zone.lat);
    url.searchParams.set("longitude", zone.lng);
    url.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,precipitation"
    );
    url.searchParams.set("timezone", "Asia/Kolkata");

    const data = await fetchJson(url.toString());
    const current = data.current || {};

    if (
      current.temperature_2m == null ||
      current.apparent_temperature == null ||
      current.precipitation == null
    ) {
      throw new Error("Weather response contains missing readings");
    }

    const heat = Number(current.temperature_2m);
    const feels = Number(current.apparent_temperature);
    const rain = Number(current.precipitation);

    if (![heat, feels, rain].every(Number.isFinite)) {
      throw new Error("Weather response contains invalid readings");
    }

    await saveCheck(zone, "weather", true, { rain, heat, feels });
  } catch (error) {
    console.error(`[CityMetrics] Weather ${zone.id}:`, error.message);
    await saveCheck(zone, "weather", false, {}, error.message);
  }
}

/* TomTom traffic flow: average current/free-flow speed percentage
   across three nearby geographic samples. */
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

  const samples = [
    [zone.lat, zone.lng],
    [zone.lat + 0.002, zone.lng + 0.002],
    [zone.lat - 0.002, zone.lng - 0.002],
  ];

  try {
    const readings = await Promise.all(
      samples.map(async ([lat, lng]) => {
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

        return Math.max(0, Math.min(100, (current / free) * 100));
      })
    );

    const traffic =
      readings.reduce((sum, value) => sum + value, 0) / readings.length;

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

  const update = {
    traffic: updateTraffic,
    weather: updateWeather,
  }[provider];

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