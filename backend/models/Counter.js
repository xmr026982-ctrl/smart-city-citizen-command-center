
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 2400,
    },
  },
  {
    versionKey: false,
  }
);

const Counter = mongoose.model("Counter", counterSchema);

async function nextIssueId() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "issue" },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: false,
    }
  );

  return `ISS-${2400 + counter.seq}`;
}

/* the next number in a named sequence: PRP-0101, POL-0034, ANN-0015, WN-0008 */
async function nextCode(prefix, base = 100) {
  const counter = await Counter.findOneAndUpdate({ _id: `code:${prefix}` }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: false });
  return `${prefix}-${String(base + counter.seq).padStart(4, "0")}`;
}

module.exports = {
  Counter,
  nextIssueId,
  nextCode,
};