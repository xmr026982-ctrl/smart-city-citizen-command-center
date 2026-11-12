
const mongoose = require("mongoose");

const communityPollSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    question: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 120
    },
    ward: {
      type: String,
      required: true,
      trim: true
    },
    options: [
      {
        id: { type: String, required: true },
        label: {
          type: String,
          required: true,
          trim: true,
          maxlength: 60
        }
      }
    ],
    // Map keys are MongoDB user IDs; values are option IDs.
    votes: {
      type: Map,
      of: String,
      default: {}
    },
    opensAt: { type: Date, default: Date.now },
    closesAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "closing"],
      default: "open"
    },
    from: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    by: { type: String, default: "Admin" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

communityPollSchema.index({ ward: 1, closesAt: 1 });

module.exports = mongoose.model("CommunityPoll", communityPollSchema);