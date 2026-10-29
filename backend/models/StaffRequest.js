
const mongoose = require("mongoose");

const staffRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },

    Experience: {
      type: String,
      required: true,
      trim: true,
    },

    Expertise: {
      type: String,
      required: true,
      trim: true,
    },

    // Staff member's selected working zone
    zone: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional short note from the staff applicant
    note: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },

    setupTokenHash: {
      type: String,
      select: false,
    },

    setupTokenExpiresAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffRequest", staffRequestSchema);