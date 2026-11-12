const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getCommunity,
  createAnnouncement,
  withdrawAnnouncement,
  createPoll,
  votePoll,
  closePoll,
} = require("../controllers/communityController");

router.use(protect);

router.get("/", getCommunity);

router.post(
  "/announcements",
  authorizeRoles("admin"),
  createAnnouncement
);

router.delete(
  "/announcements/:id",
  authorizeRoles("admin"),
  withdrawAnnouncement
);

router.post(
  "/polls",
  authorizeRoles("admin"),
  createPoll
);

router.post(
  "/polls/:id/vote",
  authorizeRoles("citizen"),
  votePoll
);

router.post(
  "/polls/:id/close",
  authorizeRoles("admin"),
  closePoll
);

module.exports = router;