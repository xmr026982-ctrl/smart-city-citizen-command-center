
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },

    at: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    actor: {
      type: String,
      default: "System",
      trim: true,
    },

    role: {
      type: String,
      enum: ["citizen", "staff", "admin", "system"],
      required: true,
    },

    kind: {
      type: String,
      enum: [
        "filed",
        "dispatch",
        "status",
        "priority",
        "removal",
        "request",
        "desk",
        "policy",
        "profile",
        "system",
      ],
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    issueId: {
      type: String,
      default: null,
      index: true,
    },

    // Structured notice data used by the frontend.
    n: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Staff Desk events can retain a snapshot of the affected person.
    verb: {
      type: String,
      default: null,
    },

    subject: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

auditLogSchema.index({ at: -1 });
auditLogSchema.index({ kind: 1, at: -1 });
auditLogSchema.index({ role: 1, at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ issueId: 1, at: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);