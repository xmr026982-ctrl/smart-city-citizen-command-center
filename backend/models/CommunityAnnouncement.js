
const mongoose = require("mongoose");

const communityAnnouncementSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 110
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    zones: {
      type: [String],
      required: true,
      validate: {
        validator: (zones) => zones.length > 0,
        message: "At least one zone is required."
      }
    },
    audience: {
      citizens: { type: Boolean, default: true },
      staff: { type: Boolean, default: true }
    },
    by: { type: String, default: "Admin" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    at: { type: Date, default: Date.now },
    until: { type: Date, required: true }
  },
  { timestamps: true }
);

communityAnnouncementSchema.index({ zones: 1, until: 1 });

module.exports = mongoose.model(
  "CommunityAnnouncement",
  communityAnnouncementSchema
);