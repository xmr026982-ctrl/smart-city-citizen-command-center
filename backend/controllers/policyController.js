/* Service windows (contract A6). One versioned table owned by command.
   GET /policy (any signed-in role) · PUT /policy (admin) · GET /policy/history (admin) */
const Policy = require("../models/Policy");
const User = require("../models/User");
const { writeAudit, actorFrom } = require("../services/audit");
const live = require("../services/live");

const PRIORITIES = ["critical", "high", "medium", "low"];
const LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const CATEGORIES = ["roads", "lighting", "water", "waste", "electricity", "safety", "other"];
const CAT_LABEL = { roads: "Roads", lighting: "Lighting", water: "Water", waste: "Waste", electricity: "Electricity", safety: "Safety", other: "Other" };
const DEFAULT = { version: 0, priority: { critical: 12, high: 24, medium: 48, low: 120 }, ceilings: { safety: 12, electricity: 12 }, savedAt: null };

const plain = (p) => ({
  version: p.version,
  priority: { critical: p.priority.critical, high: p.priority.high, medium: p.priority.medium, low: p.priority.low },
  ceilings: p.ceilings instanceof Map ? Object.fromEntries(p.ceilings) : { ...(p.ceilings || {}) },
  savedAt: p.savedAt ? new Date(p.savedAt).toISOString() : null,
});

async function current() {
  const p = await Policy.findOne().sort({ version: -1 }).lean();
  return p ? plain(p) : { ...DEFAULT, priority: { ...DEFAULT.priority }, ceilings: { ...DEFAULT.ceilings } };
}

function check(body) {
  const problems = [];
  const hours = (v) => Number.isInteger(v) && v >= 1 && v <= 720;
  const priority = {};
  const raw = body?.priority || {};
  PRIORITIES.forEach((k) => {
    const v = Number(raw[k]);
    if (!hours(v)) problems.push(`${LABEL[k]} must be a whole number of hours from 1 to 720.`);
    priority[k] = v;
  });
  if (!problems.length) {
    if (!(priority.critical <= priority.high && priority.high <= priority.medium && priority.medium <= priority.low)) {
      problems.push("A higher priority can't get more time than a lower one (Critical ≤ High ≤ Medium ≤ Low).");
    }
  }
  const ceilings = {};
  const rawC = body?.ceilings || {};
  if (typeof rawC !== "object" || Array.isArray(rawC)) problems.push("Ceilings must be a table of categories.");
  else {
    Object.entries(rawC).forEach(([k, v]) => {
      if (!CATEGORIES.includes(k)) return problems.push(`"${k}" isn't a category.`);
      if (v === null || v === undefined || v === "") return; // no ceiling
      const n = Number(v);
      if (!hours(n)) return problems.push(`The ${CAT_LABEL[k]} ceiling must be a whole number of hours from 1 to 720.`);
      ceilings[k] = n;
    });
  }
  return { problems, priority, ceilings };
}

function describe(before, after) {
  const parts = [];
  PRIORITIES.forEach((k) => { if (before.priority[k] !== after.priority[k]) parts.push(`${LABEL[k]} ${before.priority[k]}h → ${after.priority[k]}h`); });
  CATEGORIES.forEach((k) => {
    const a = before.ceilings[k];
    const b = after.ceilings[k];
    if (a === b) return;
    // the Audit Log's change file reads these exact words (PolicyEventDrawer)
    if (!a) parts.push(`${CAT_LABEL[k]} ceiling set to ${b}h`);
    else if (!b) parts.push(`${CAT_LABEL[k]} ceiling removed (was ${a}h)`);
    else parts.push(`${CAT_LABEL[k]} ceiling ${a}h → ${b}h`);
  });
  return parts;
}

const getPolicy = async (_req, res) => {
  try {
    return res.json(await current());
  } catch (error) {
    console.error("Policy read error:", error);
    return res.status(500).json({ message: "Service windows couldn't be loaded." });
  }
};

const putPolicy = async (req, res) => {
  try {
    const { problems, priority, ceilings } = check(req.body);
    if (problems.length) return res.status(422).json({ message: problems[0], problems });
    const before = await current();
    const changes = describe(before, { priority, ceilings });
    if (!changes.length) return res.json(before);
    let saved = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      const latest = await Policy.findOne().sort({ version: -1 }).select("version").lean();
      try {
        saved = await Policy.create({ version: (latest?.version || 0) + 1, priority, ceilings, savedAt: new Date(), savedBy: req.user._id });
      } catch (e) {
        if (e.code !== 11000) throw e; // another save took this version number: try the next one
      }
    }
    if (!saved) return res.status(409).json({ message: "Someone else saved at the same moment. Try again." });
    const out = plain(saved.toObject());
    await writeAudit({ ...actorFrom(req), kind: "policy", action: `Service windows changed: ${changes.join(" · ")}`, n: { type: "policy", version: out.version } });
    live.emit("policy:changed", { version: out.version }, ["role:admin", "role:staff", "role:citizen"], req);
    return res.json(out);
  } catch (error) {
    console.error("Policy save error:", error);
    return res.status(500).json({ message: "Service windows couldn't be saved. Try again." });
  }
};

const getHistory = async (_req, res) => {
  try {
    const rows = await Policy.find().sort({ version: -1 }).limit(200).lean();
    const ids = [...new Set(rows.map((r) => String(r.savedBy || "")).filter(Boolean))];
    const people = new Map((await User.find({ _id: { $in: ids } }).select("name displayName").lean()).map((u) => [String(u._id), u.displayName || u.name]));
    const items = rows.map((r) => ({ ...plain(r), savedBy: people.get(String(r.savedBy || "")) || "" }));
    return res.json({ items, total: items.length });
  } catch (error) {
    console.error("Policy history error:", error);
    return res.status(500).json({ message: "The history couldn't be loaded." });
  }
};

module.exports = { getPolicy, putPolicy, getHistory, currentPolicy: current };
