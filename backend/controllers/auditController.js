/* GET /audit (admin, contract A8): { items, total, page }, newest first.
   Query: kind, role, actorId, issueId, from, to, q, page (100 a page).
   With no query, the latest 600 rows. The actor's name is read now,
   from actorId, so a renamed person is renamed in the whole history. */
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAudit = async (req, res) => {
  try {
    const q = req.query || {};
    const filter = {};
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    if (str(q.kind)) filter.kind = str(q.kind);
    if (str(q.role)) filter.role = str(q.role);
    if (str(q.issueId)) filter.issueId = str(q.issueId);
    if (str(q.actorId) && mongoose.isValidObjectId(str(q.actorId))) filter.actorId = str(q.actorId);
    const from = Date.parse(str(q.from));
    const to = Date.parse(str(q.to));
    if (Number.isFinite(from) || Number.isFinite(to)) {
      filter.at = {};
      if (Number.isFinite(from)) filter.at.$gte = new Date(from);
      if (Number.isFinite(to)) filter.at.$lte = new Date(to);
    }
    if (str(q.q)) filter.action = { $regex: escapeRe(str(q.q).slice(0, 80)), $options: "i" };

    const queried = Object.keys(filter).length > 0 || q.page !== undefined;
    const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
    const size = queried ? 100 : 600;
    const [rows, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * size).limit(size).lean(),
      AuditLog.countDocuments(filter),
    ]);

    const ids = [...new Set(rows.map((r) => String(r.actorId || "")).filter(Boolean))];
    const people = new Map((await User.find({ _id: { $in: ids } }).select("name displayName").lean()).map((u) => [String(u._id), u.displayName || u.name]));
    const items = rows.map((r) => ({
      id: r.id,
      at: r.at,
      actorId: r.actorId ? String(r.actorId) : null,
      actor: (r.actorId && people.get(String(r.actorId))) || r.actor || (r.role === "system" ? "System" : ""),
      role: r.role,
      kind: r.kind,
      action: r.action,
      issueId: r.issueId || null,
      ...(r.n ? { n: r.n } : {}),
      ...(r.verb ? { verb: r.verb } : {}),
      ...(r.subject ? { subject: r.subject } : {}),
      ...(r.n?.to && r.kind === "dispatch" ? { to: r.n.to } : {}),
    }));
    return res.json({ items, total, page });
  } catch (error) {
    console.error("Audit read error:", error);
    return res.status(500).json({ message: "The audit trail couldn't be loaded." });
  }
};

/* GET /audit/mine (staff, citizens): the rows that concern this person, for their
   notifications and field log. Newest first, the past 14 days.
   - staff: changes on files that are (or were) theirs, and Staff Desk rows about them.
     Citizens stay "A resident".
   - citizens: changes on reports they filed, follow or back, in public words only:
     no crew or command names, no reasons from inside the city, no pending
     confirmation, and only their own requests. */
const Issue = require("../models/Issue");
const ISSUE_KINDS = ["filed", "dispatch", "status", "priority", "removal", "request"];
const publicStatus = (st) => (st === "pending_review" ? "in_progress" : st);

function citizenRow(r, me, people) {
  const n = r.n || {};
  const own = String(r.actorId || "") === me;
  const actor = own ? people.get(me) || r.actor : r.role === "staff" ? "Field crew" : r.role === "admin" ? "City Command" : "A resident";
  let out = null;
  switch (n.type) {
    case "filed": out = { type: "filed", reporterId: n.reporterId === me ? me : null }; break;
    case "assign": out = { type: "assign", to: n.to ? "Field crew" : null, from: n.from ? "Field crew" : null }; break;
    case "status":
      if (n.to === "pending_review" || n.from === "pending_review") return null; // the close gate stays inside the city
      out = { type: "status", from: publicStatus(n.from), to: publicStatus(n.to) };
      break;
    case "supported": out = { type: "supported", userId: n.userId === me ? me : "", count: n.count }; break;
    case "withdrawn": if (!own) return null; out = { type: "withdrawn", reason: n.reason }; break;
    case "request": if (!own) return null; out = { type: "request", req: n.req, reason: n.reason }; break;
    case "dismissed": out = { type: "dismissed", reason: n.reason }; break;
    case "merged": out = { type: "merged", into: n.into }; break;
    case "restored": out = { type: "restored" }; break;
    case "decided":
      if (n.byId !== me) return null;
      out = { type: "decided", req: n.req, verdict: n.verdict, by: people.get(me) || "", byId: me, ...(n.reason ? { reason: n.reason } : {}), ...(n.into ? { into: n.into } : {}) };
      break;
    default: return null;
  }
  return { id: r.id, at: r.at, actorId: own ? me : null, actor, role: r.role, kind: r.kind, action: "", issueId: r.issueId, n: out };
}

const getMyAudit = async (req, res) => {
  try {
    const me = String(req.user._id);
    const since = new Date(Date.now() - 14 * 864e5);
    let rows;
    if (req.user.role === "staff") {
      const mine = await Issue.find({ assignedTo: req.user._id }).select("publicId").lean();
      rows = await AuditLog.find({
        at: { $gte: since },
        $or: [
          { kind: { $in: ISSUE_KINDS }, issueId: { $in: mine.map((i) => i.publicId) } },
          { "n.toId": me },
          { "n.fromId": me },
          { "n.ownerId": me },
          { "n.byId": me },
          { kind: "desk", "subject.id": me },
          { actorId: me },
        ],
      }).sort({ at: -1 }).limit(400).lean();
    } else {
      const mine = await Issue.find({ $or: [{ reportedBy: req.user._id }, { savedBy: req.user._id }, { "supporters.id": req.user._id }] }).select("publicId").lean();
      rows = await AuditLog.find({ at: { $gte: since }, kind: { $in: ISSUE_KINDS }, issueId: { $in: mine.map((i) => i.publicId) } }).sort({ at: -1 }).limit(400).lean();
    }
    const ids = [...new Set(rows.map((r) => String(r.actorId || "")).filter(Boolean))];
    const users = await User.find({ _id: { $in: ids } }).select("name displayName role").lean();
    const people = new Map(users.map((u) => [String(u._id), u.displayName || u.name]));
    const roleOf = new Map(users.map((u) => [String(u._id), u.role]));
    let items;
    if (req.user.role === "staff") {
      items = rows.map((r) => {
        const citizenActor = r.role === "citizen" || roleOf.get(String(r.actorId || "")) === "citizen";
        return {
          id: r.id, at: r.at, actorId: citizenActor ? null : r.actorId ? String(r.actorId) : null,
          actor: citizenActor ? "A resident" : (r.actorId && people.get(String(r.actorId))) || r.actor || "",
          role: r.role, kind: r.kind, action: r.action, issueId: r.issueId || null,
          ...(r.n ? { n: r.n } : {}), ...(r.verb ? { verb: r.verb } : {}), ...(r.subject ? { subject: r.subject } : {}),
          ...(r.n?.to && r.kind === "dispatch" ? { to: r.n.to } : {}),
        };
      });
    } else {
      items = rows.map((r) => citizenRow(r, me, people)).filter(Boolean);
    }
    return res.json({ items, total: items.length, page: 1 });
  } catch (error) {
    console.error("My audit error:", error);
    return res.status(500).json({ message: "Your updates couldn't be loaded." });
  }
};

module.exports = { getAudit, getMyAudit };
