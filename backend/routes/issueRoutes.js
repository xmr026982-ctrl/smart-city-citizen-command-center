const express = require("express");

const requireUser = require("../middleware/requireUser");
const upload = require("../middleware/upload.middleware");
const validate = require("../middleware/validate.middleware");
const { createIssue } = require("../validators/issue.validator");

const issues = require("../controllers/issueController");

const router = express.Router();

router.use(requireUser);

// ==================== MAP ====================

// Get nearby issues
router.get("/nearby", issues.getNearbyIssues);

// ==================== ISSUE MANAGEMENT ====================

// List issues
router.get("/", issues.list);

// Get single issue
router.get("/:id", issues.getOne);

// Create issue
router.post(
  "/",
  upload.array("photos", 5),
  validate(createIssue),
  issues.create
);

// Update status
router.post("/:id/status", issues.setStatus);

// Assign issue
router.post("/:id/assign", issues.assign);

// Set priority
router.post("/:id/priority", issues.setPriority);

// Add comment
router.post("/:id/comments", issues.comment);

// Save / unsave issue
router.post("/:id/save", issues.toggleSave);

module.exports = router;