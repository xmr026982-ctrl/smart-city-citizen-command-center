
const mongoose = require("mongoose");

const cityMetricsSchema = new mongoose.Schema(
  {
    zoneId: { type: String, required: true, index: true },
    zoneName: { type: String, default: "" },
    provider: {
      type: String,
      enum: ["aqi", "traffic", "weather"],
      required: true,
      index: true,
    },
    success: { type: Boolean, default: false, index: true },
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: "" },

    // The TTL index below is the only checkedAt index.
    checkedAt: { type: Date, default: Date.now },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  { timestamps: true }
);

cityMetricsSchema.index({ zoneId: 1, provider: 1, checkedAt: -1 });

cityMetricsSchema.index(
  { checkedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 }
);

module.exports = mongoose.model("CityMetrics", cityMetricsSchema);