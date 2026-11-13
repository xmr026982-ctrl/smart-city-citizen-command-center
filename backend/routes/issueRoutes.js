
const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const upload = require("../middleware/issueUpload");

const {
  createIssue,
  getIssues,
  getIssueById,
  updateIssueStatus,
  assignIssue,
  updateIssuePriority,
  addIssueComment,
  supportIssue,
  followIssue,
  withdrawIssue,
  createIssueRequest,
  markIssueRequestSeen,
  decideIssueRequest,
  dismissIssue,
  mergeIssue,
  restoreIssue,
  getPossibleDuplicates,
} = require("../controllers/issueController");

const router = express.Router();

const adminOnly = [protect, authorizeRoles("admin")];
const adminOrStaff = [protect, authorizeRoles("admin", "staff")];
const citizenOnly = [protect, authorizeRoles("citizen")];
const citizenOrStaff = [protect, authorizeRoles("citizen", "staff")];

// File a report. Photos are optional; maximum 3.
router.post(
  "/",
  ...citizenOnly,
  upload.array("photos", 3),
  upload.validateIssuePhotos,
  createIssue
);

// Board and individual issue. Controller applies visibility/redaction rules.
router.get("/", protect, authorizeRoles("admin", "staff", "citizen"), getIssues);

// Keep this before "/:id" so "duplicates" is not interpreted as an issue ID.
router.get("/:id/duplicates", ...adminOnly, getPossibleDuplicates);

router.get(
  "/:id",
  protect,
  authorizeRoles("admin", "staff", "citizen"),
  getIssueById
);

// Dispatch and work status.
router.patch("/:id/assign", ...adminOnly, assignIssue);
router.patch("/:id/status", ...adminOrStaff, updateIssueStatus);
router.patch("/:id/priority", ...adminOnly, updateIssuePriority);

// Staff notes.
router.post("/:id/comments", ...adminOrStaff, addIssueComment);

// Citizen participation.
router.post("/:id/support", ...citizenOnly, supportIssue);
router.post("/:id/follow", ...citizenOnly, followIssue);
router.post("/:id/withdraw", ...citizenOnly, withdrawIssue);

// Requests can be raised by citizens or staff.
router.post("/:id/requests", ...citizenOrStaff, createIssueRequest);

// Admin reviews requests.
router.patch(
  "/:id/requests/:reqId/seen",
  ...adminOnly,
  markIssueRequestSeen
);

router.patch(
  "/:id/requests/:reqId",
  ...adminOnly,
  decideIssueRequest
);

// Admin removal, merge, and restoration.
router.post("/:id/dismiss", ...adminOnly, dismissIssue);
router.post("/:id/merge", ...adminOnly, mergeIssue);
router.post("/:id/restore", ...adminOnly, restoreIssue);

module.exports = router;