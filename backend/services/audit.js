/* One audit row per change (contract A8). Written after the change succeeds.
   Never logs passwords, tokens, links or request bodies. The actor's display
   name is resolved when the trail is read (GET /audit), so renames carry. */
const crypto = require("crypto");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");

/**
 * @param {object} row { actorId, role, kind, action, issueId?, n?, verb?, subject?, actor? }
 * actor: a name snapshot, kept for people who may later be removed.
 */
async function writeAudit(row) {
  try {
    const actorId = row.actorId && mongoose.isValidObjectId(String(row.actorId)) ? String(row.actorId) : null;
    await AuditLog.create({
      id: crypto.randomUUID(),
      at: new Date(),
      actorId,
      actor: row.actor || (row.role === "system" ? "System" : ""),
      role: row.role || "system",
      kind: row.kind,
      action: String(row.action || "").slice(0, 500),
      issueId: row.issueId || null,
      n: row.n || null,
      verb: row.verb || null,
      subject: row.subject || null,
    });
  } catch (error) {
    // the change already happened; a failed audit write is logged, never shown to the person
    console.error("Audit write failed:", error.message);
  }
}

/** The audit actor fields for the signed-in person making a request. */
const actorFrom = (req) => ({
  actorId: String(req.user._id),
  role: req.user.role,
  actor: String(req.user.displayName || req.user.name || "").trim(),
});

module.exports = { writeAudit, actorFrom };
