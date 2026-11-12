
const mongoose = require("mongoose");

const communityHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["announcement", "poll"],
      required: true
    },
    publicId: { type: String, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, default: "" },
    archivedAt: { type: Date, default: Date.now },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

communityHistorySchema.index(
  { type: 1, publicId: 1 },
  { unique: true }
);

module.exports = mongoose.model("CommunityHistory", communityHistorySchema);