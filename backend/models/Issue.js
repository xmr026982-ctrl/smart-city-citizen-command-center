const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    status: String,
    at: { type: Date, default: Date.now },
    by: String,
    role: String,
    note: String,
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    body: String,
    author: String,
    role: String,
    internal: { type: Boolean, default: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const photoSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
  },
  { _id: false }
);

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      default: undefined,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: "GeoJSON coordinates must contain [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      required: true,
    },

    // Human-readable location text
    locationText: {
      type: String,
      trim: true,
    },

    ward: {
      type: String,
      required: true,
    },

    // Map coordinates
    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },

    // Issue Management also uses lat/lng
    lat: Number,
    lng: Number,

    // GeoJSON Point
    // Optional until a valid [longitude, latitude] pair is provided.
    // Avoid creating invalid GeoJSON Points for legacy issues without coordinates.
    location: {
      type: pointSchema,
      default: undefined,
    },

    photos: [photoSchema],

    reportedBy: String,

    reporterId: String,

    status: {
      type: String,
      enum: ["submitted", "acknowledged", "in_progress", "pending_review", "resolved"],
      default: "submitted",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    assignedTo: {
      type: String,
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    comments: [commentSchema],

    timeline: [eventSchema],

    savedBy: [String],
  },
  {
    timestamps: true,
  }
);

// Geospatial index for Map nearby-issue queries
issueSchema.index({
  location: "2dsphere",
});

module.exports = mongoose.model("Issue", issueSchema);