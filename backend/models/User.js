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
    closedPrior: { type: Number, default: 0, min: 0 }, // closed before this system
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "StaffRequest", default: null },
    requestedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    uplinkedAt: { type: Date, default: null }, // first sign-in after setup

    // notification read state, synced across devices: everything before c (ms) is read,
    // plus items marked read (r) or unread (u) one by one
    inboxRead: {
      type: { c: Number, r: [String], u: [String] },
      default: null,
      select: false,
    },

    // never deleted: an account that leaves is marked inactive (who, when)
    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

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