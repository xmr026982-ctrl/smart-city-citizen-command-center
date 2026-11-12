
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

module.exports = {
  Counter,
  nextIssueId,
};