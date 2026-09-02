const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    category: {
      type: String,
      enum: [
        "road_damage",
        "garbage",
        "water_leakage",
        "street_light",
        "encroachment",
        "drainage",
        "other"
      ],
      default: "other"
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
    },

    photos: {
      type: [String],
      default: []
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    status: {
      type: String,
      enum: [
        "submitted",
        "acknowledged",
        "in_progress",
        "resolved",
        "rejected"
      ],
      default: "submitted"
    },

    votes: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

issueSchema.index({
  location: "2dsphere"
});

module.exports = mongoose.model("Issue", issueSchema);