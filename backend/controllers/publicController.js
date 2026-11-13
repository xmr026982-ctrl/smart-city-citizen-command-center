/* GET /api/public/board (no sign-in): what the public Platform Preview shows.
   Only what an anonymous visitor may see: the latest open reports' kind, zone
   and public status, and two counts. No titles, no landmarks, no names, no
   exact coordinates (a pin sits on its zone's centre). byZone: open reports
   per citizen zone (the Google sign-up zone lock shows them). */
const Issue = require("../models/Issue");
const { CITIZEN_ZONES } = require("../config/citizenZones");

const publicStatus = (s) => (s === "pending_review" ? "in_progress" : s);

let cache = { at: 0, body: null };

const getPublicBoard = async (_req, res) => {
  try {
    if (cache.body && Date.now() - cache.at < 60 * 1000) return res.json(cache.body); // one read a minute at most
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const [latest, open, resolvedWeek, ...zoneCounts] = await Promise.all([
      Issue.find({ removed: null, status: { $ne: "resolved" } }).sort({ createdAt: -1 }).limit(3).select("category ward status createdAt").lean(),
      Issue.countDocuments({ removed: null, status: { $ne: "resolved" } }),
      Issue.countDocuments({ removed: null, status: "resolved", updatedAt: { $gte: weekAgo } }),
      ...CITIZEN_ZONES.map((ward) => Issue.countDocuments({ removed: null, status: { $ne: "resolved" }, ward })),
    ]);
    const body = {
      items: latest.map((i) => ({ category: i.category, ward: i.ward, status: publicStatus(i.status), at: i.createdAt })),
      open,
      resolvedWeek,
      byZone: Object.fromEntries(CITIZEN_ZONES.map((ward, i) => [ward, zoneCounts[i]])),
    };
    cache = { at: Date.now(), body };
    return res.json(body);
  } catch (error) {
    console.error("Public board error:", error);
    return res.status(500).json({ message: "The live board couldn't be loaded." });
  }
};

module.exports = { getPublicBoard };
