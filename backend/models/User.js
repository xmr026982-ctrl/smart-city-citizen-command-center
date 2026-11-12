const mongoose = require("mongoose");

const prefsSchema = new mongoose.Schema(
  {
    idleSignOut: { type: Number, default: 0 }, // minutes; 0 = never
    inboxMuted: { type: [String], default: [] },
    popups: { type: String, default: "all" },
    quietHours: { type: Boolean, default: false },
    quietFrom: { type: String, default: "22:00" },
    quietTo: { type: String, default: "07:00" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    displayName: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false, // never returned by default
    },

    role: {
      type: String,
      enum: ["citizen", "staff", "admin"],
      default: "citizen",
    },

    zone: {
      type: String,
      trim: true,
      default: "",
    },

    provider: {
      type: String,
      enum: ["password", "google"],
      default: "password",
    },

    avatar: {
      type: String,
      default: "",
    },

    // staff + admin
    dutyStatus: {
      type: String,
      enum: ["on", "break", "off"],
      default: "off",
    },

    // admin only
    designation: { type: String, default: "" },
    office: { type: String, default: "" },

    // staff only
    expertise: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    rank: { type: String, default: "" },
    experience: { type: String, default: "" },
    verified: { type: Boolean, default: false },

    prefs: {
      type: prefsSchema,
      default: () => ({}),
    },

    zoneChangedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // lockout
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },

    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);