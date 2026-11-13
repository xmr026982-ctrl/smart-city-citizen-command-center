/* Community board records (contract B3). One collection, one document per
   item, kept in the exact shape the frontend's community store uses:
     proposal  PRP-0101   poll  POL-0034   announcement  ANN-0015
     notice    WN-0008    signal <issueId>:<userId>   check chk-…   trail ct-…
   `doc` holds the item; the server masks it per role before sending. */
const mongoose = require("mongoose");

const communityRecordSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["proposal", "poll", "announcement", "notice", "signal", "check", "trail"] },
    ref: { type: String, required: true },
    ward: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    doc: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { versionKey: false, minimize: false }
);

communityRecordSchema.index({ type: 1, ref: 1 }, { unique: true });
communityRecordSchema.index({ type: 1, at: -1 });

module.exports = mongoose.model("CommunityRecord", communityRecordSchema);
