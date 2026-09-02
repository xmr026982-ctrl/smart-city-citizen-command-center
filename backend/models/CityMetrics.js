const mongoose = require("mongoose");

const cityMetricsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["aqi", "traffic", "water", "power"],
      required: true
    },

    value: {
      type: Number,
      required: true
    },

    unit: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      default: "normal"
    },

    ward: {
      type: String,
      default: ""
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },

      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    }
  },
  {
    timestamps: true
  }
);

cityMetricsSchema.index({
  location: "2dsphere"
});

module.exports = mongoose.model(
  "CityMetrics",
  cityMetricsSchema
);