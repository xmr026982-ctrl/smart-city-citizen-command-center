const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  createIssue,
  getIssues,
  getIssueById,
  updateIssueStatus
} = require("../controllers/issueController");

const router = express.Router();

// Any logged-in user can report an issue.
router.post(
  "/",
  protect,
  authorizeRoles("citizen", "moderator", "admin"),
  createIssue
);

// Admin and moderators can manage issues.
router.get(
  "/",
  protect,
  authorizeRoles("admin", "moderator"),
  getIssues
);

router.get(
  "/:id",
  protect,
  authorizeRoles("admin", "moderator"),
  getIssueById
);

router.patch(
  "/:id/status",
  protect,
  authorizeRoles("admin", "moderator"),
  updateIssueStatus
);

module.exports = router;