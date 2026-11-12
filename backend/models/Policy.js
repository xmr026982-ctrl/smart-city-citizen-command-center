
const mongoose = require("mongoose");

const policySchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
      unique: true,
      min: 0,
    },

    priority: {
      critical: { type: Number, required: true, min: 1, max: 720 },
      high: { type: Number, required: true, min: 1, max: 720 },
      medium: { type: Number, required: true, min: 1, max: 720 },
      low: { type: Number, required: true, min: 1, max: 720 },
    },

    // Category-specific maximum service windows.
    ceilings: {
      type: Map,
      of: Number,
      default: () => ({
        safety: 12,
        electricity: 12,
      }),
    },

    savedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

policySchema.index({ version: -1 });

module.exports = mongoose.model("Policy", policySchema);