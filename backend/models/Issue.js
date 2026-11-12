
const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000
    },

    category: {
      type: String,
      enum: [
        "roads",
        "lighting",
        "water",
        "waste",
        "electricity",
        "safety",
        "other"
      ],
      required: true
    },

    // GeoJSON Point: [longitude, latitude]
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: function (coordinates) {
            if (!coordinates) return true;

            return (
              coordinates.length === 2 &&
              Number.isFinite(coordinates[0]) &&
              Number.isFinite(coordinates[1]) &&
              coordinates[0] >= -180 &&
              coordinates[0] <= 180 &&
              coordinates[1] >= -90 &&
              coordinates[1] <= 90
            );
          },
          message: "Invalid location coordinates."
        }
      }
    },

    locationText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },

    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },

    ward: {
      type: String,
      required: true,
      enum: [
        "Shyambazar",
        "B.B.D. Bagh",
        "Ballygunge",
        "College Street",
        "B.P. Township",
        "Dharmatala"
      ]
    },

    danger: {
      type: Boolean,
      default: false
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },

    slaHours: {
      type: Number,
      required: true,
      min: 1,
      max: 720
    },

    photos: {
      type: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        url: { type: String, required: true },
        w: { type: Number, default: null },
        h: { type: Number, default: null },
        kb: { type: Number, default: null }
      }],
      default: []
    },

    publicId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    assignedAt: {
      type: Date,
      default: null
    },

    timeline: {
      type: [{
        status: { type: String, required: true },
        at: { type: Date, required: true },
        by: { type: String, default: "" },
        note: { type: String, default: "" },
        role: { type: String, enum: ["citizen", "staff", "admin"], default: "citizen" }
      }],
      default: []
    },

    comments: {
      type: [{
        id: String,
        author: String,
        role: String,
        body: String,
        createdAt: Date,
        internal: { type: Boolean, default: false }
      }],
      default: []
    },

    savedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },

    supporters: {
      type: [{
        id: mongoose.Schema.Types.ObjectId,
        name: String,
        at: Date
      }],
      default: []
    },

    returned: {
      type: Number,
      default: 0
    },

    lastReturn: {
      reason: String,
      by: String,
      at: Date
    },

    requests: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },

    removed: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    restored: {
      type: mongoose.Schema.Types.Mixed,
      default: null
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
        "pending_review",
        "resolved",
      ],
      default: "submitted",
    },

    votes: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

issueSchema.index({ location: "2dsphere" });
issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ reportedBy: 1, createdAt: -1 });
issueSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model("Issue", issueSchema);