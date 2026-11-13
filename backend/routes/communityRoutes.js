const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const c = require("../controllers/communityController");

const router = express.Router();
const citizen = authorizeRoles("citizen");
const admin = authorizeRoles("admin");
const staff = authorizeRoles("staff");
const official = authorizeRoles("admin", "staff");

router.use(protect);

router.get("/", c.getCommunity);

// citizens
router.post("/proposals", citizen, c.propose);
router.post("/proposals/:id/signal", citizen, c.signalProposal);
router.post("/proposals/:id/concern", citizen, c.concernProposal);
router.post("/proposals/:id/photo", citizen, express.json({ limit: "1mb" }), c.photoProposal);
router.post("/polls/:id/vote", citizen, c.votePoll);
router.post("/issues/:id/signal", citizen, c.signalIssue);

// command and field crews
router.post("/proposals/:id/responses", official, c.respondProposal);
router.patch("/proposals/:id/decision", admin, c.decideProposal);
router.post("/polls", admin, c.openPoll);
router.patch("/polls/:id/close", admin, c.closePoll);
router.post("/announcements", admin, c.announce);
router.post("/moderate", admin, c.moderate);
router.post("/notices", staff, c.postNotice);
router.patch("/notices/:id/end", staff, c.endNotice);
router.post("/issues/:id/check", staff, c.answerStill);

module.exports = router;
