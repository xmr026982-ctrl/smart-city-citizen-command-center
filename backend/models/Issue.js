const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  status: String,
  at: { type: Date, default: Date.now },
  by: String,
  role: String,
  note: String,
}, { _id: false });

const commentSchema = new mongoose.Schema({
  body: String,
  author: String,
  role: String,
  internal: { type: Boolean, default: true },
  at: { type: Date, default: Date.now },
}, { _id: false });

const photoSchema = new mongoose.Schema({
  name: String,
  url: String,
}, { _id: false });

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  ward: { type: String, required: true },
  lat: Number,
  lng: Number,
  photos: [photoSchema],
  reportedBy: String,
  reporterId: String,
  status: { type: String, default: "submitted" },
  priority: { type: String, default: "medium" },
  assignedTo: { type: String, default: null },
  assignedAt: { type: Date, default: null },
  comments: [commentSchema],
  timeline: [eventSchema],
  savedBy: [String],
}, { timestamps: true });

module.exports = mongoose.model("Issue", issueSchema);