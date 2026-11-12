
const CityMetrics = require("../models/CityMetrics");
const zones = require("../services/cityMetricsConfig");

const PROVIDERS = ["aqi", "traffic", "weather"];

const FRESHNESS_LIMITS = {
  aqi: 45 * 60 * 1000,
  traffic: 15 * 60 * 1000,
  weather: 30 * 60 * 1000,
};

exports.getLiveMetrics = async (req, res, next) => {
  try {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since1h = new Date(now - 60 * 60 * 1000);

    const zoneIds = zones.map((zone) => zone.id);

    const [latestChecks, checks24h, checks1h] =
      await Promise.all([
        CityMetrics.find({
          zoneId: { $in: zoneIds },
          provider: { $in: PROVIDERS },
        })
          .sort({ checkedAt: -1 })
          .lean(),

        CityMetrics.find({
          zoneId: { $in: zoneIds },
          provider: { $in: PROVIDERS },
          checkedAt: { $gte: since24h },
        })
          .select("success")
          .lean(),

        CityMetrics.find({
          zoneId: { $in: zoneIds },
          provider: { $in: PROVIDERS },
          success: true,
          checkedAt: { $gte: since1h },
        })
          .select("zoneId provider")
          .lean(),
      ]);

    const result = {};

    for (const zone of zones) {
      result[zone.id] = {
        aqi: null,
        traffic: null,
        rain: null,
        heat: null,
        feels: null,
        at: null,
        providers: {
          aqi: null,
          traffic: null,
          weather: null,
        },
      };
    }

    // Keep only the newest check for each zone/provider.
    // Importantly, this includes failed checks.
    const latestByProvider = new Map();

    for (const record of latestChecks) {
      const key = `${record.zoneId}:${record.provider}`;

      if (!latestByProvider.has(key)) {
        latestByProvider.set(key, record);
      }
    }

    for (const zone of zones) {
      const target = result[zone.id];

      for (const provider of PROVIDERS) {
        const record = latestByProvider.get(
          `${zone.id}:${provider}`
        );

        if (!record) continue;

        const checkedAt = record.checkedAt
          ? new Date(record.checkedAt)
          : null;

        const age = checkedAt
          ? Math.max(0, now - checkedAt.getTime())
          : Infinity;

        const stale = age > FRESHNESS_LIMITS[provider];

        target.providers[provider] = {
          success: record.success === true,
          stale,
          checkedAt:
            checkedAt && !Number.isNaN(checkedAt.getTime())
              ? checkedAt.toISOString()
              : null,
          error: record.success
            ? null
            : record.error || "Provider unavailable",
        };

        // Never present an older successful value as current
        // when the latest provider check has failed.
        if (!record.success) continue;

        const values = record.values || {};

        if (provider === "aqi") {
          target.aqi = values.aqi ?? null;
        }

        if (provider === "traffic") {
          target.traffic = values.traffic ?? null;
        }

        if (provider === "weather") {
          target.rain = values.rain ?? null;
          target.heat = values.heat ?? null;
          target.feels = values.feels ?? null;
        }

        if (
          checkedAt &&
          !Number.isNaN(checkedAt.getTime()) &&
          (!target.at || checkedAt > new Date(target.at))
        ) {
          target.at = checkedAt.toISOString();
        }
      }
    }

    const activeFeeds = new Set(
      checks1h.map(
        (record) => `${record.zoneId}:${record.provider}`
      )
    );

    const successfulChecks = checks24h.filter(
      (record) => record.success === true
    ).length;

    const uptime =
      checks24h.length > 0
        ? Number(
            (
              (successfulChecks / checks24h.length) *
              100
            ).toFixed(2)
          )
        : null;

    return res.status(200).json({
      success: true,
      zones: result,
      city: {
        // Number of distinct zone/provider feeds reporting
        // successfully within the previous hour.
        sensors: activeFeeds.size,
        activeFeeds: activeFeeds.size,
        uptime,
        monitoredZones: zones.length,
        totalZones: 16,
        checkedAt: new Date(now).toISOString(),
      },
    });
  } catch (error) {
    return next(error);
  }
};