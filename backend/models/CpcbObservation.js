
const mongoose = require("mongoose");

const cpcbObservationSchema = new mongoose.Schema(
  {
    stationKey: { type: String, required: true },
    station: { type: String, required: true },
    city: { type: String, default: "Kolkata" },
    state: { type: String, default: "West Bengal" },

    pollutant: { type: String, required: true },
    value: { type: Number, required: true },
    unit: { type: String, default: "" },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },

    sourceAt: { type: Date, required: true },
    collectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One observation per station, pollutant and CPCB source timestamp.
cpcbObservationSchema.index(
  { stationKey: 1, pollutant: 1, sourceAt: 1 },
  { unique: true }
);

// Keep enough history for rolling AQI calculations and troubleshooting.
cpcbObservationSchema.index(
  { sourceAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 45 }
);

cpcbObservationSchema.index({
  stationKey: 1,
  sourceAt: -1,
  pollutant: 1,
});

module.exports = mongoose.model(
  "CpcbObservation",
  cpcbObservationSchema
);