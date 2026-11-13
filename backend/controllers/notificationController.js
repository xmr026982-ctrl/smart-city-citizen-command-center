/* Notifications (contract B2).
   The inbox is built on the person's device from the trails they may see
   (GET /audit for command, GET /audit/mine for crews and citizens, and
   GET /community), through one set of recipient rules, so an item always
   reads the live issue. What the server keeps per person is the read state,
   so it's the same on every device:
     GET /notifications/read-state  → { c, r, u }
     PUT /notifications/read-state  { c, r, u } → { c, r, u }
   A change is pushed to the person's other devices (notification:new, type "read"). */
const User = require("../models/User");
const live = require("../services/live");

const KEY = /^[\w:.-]{1,120}$/;

const getReadState = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+inboxRead").lean();
    return res.json(user?.inboxRead || { c: null, r: [], u: [] });
  } catch (error) {
    console.error("Read state error:", error);
    return res.status(500).json({ message: "Read state couldn't be loaded." });
  }
};

const putReadState = async (req, res) => {
  try {
    const { c, r, u } = req.body || {};
    const cursor = Number(c);
    if (!Number.isFinite(cursor) || cursor < 0 || cursor > Date.now() + 60000) return res.status(400).json({ message: "The read cursor isn't valid." });
    const list = (x, max) => (Array.isArray(x) ? x.filter((k) => typeof k === "string" && KEY.test(k)).slice(-max) : []);
    const state = { c: cursor, r: list(r, 400), u: list(u, 200) };
    await User.updateOne({ _id: req.user._id }, { $set: { inboxRead: state } });
    live.emit("notification:new", { id: "", type: "read" }, [`user:${req.user._id}`], req);
    return res.json(state);
  } catch (error) {
    console.error("Read state save error:", error);
    return res.status(500).json({ message: "Read state couldn't be saved." });
  }
};

module.exports = { getReadState, putReadState };
