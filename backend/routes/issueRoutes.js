const express = require("express");

const {
  createIssue,
  getNearbyIssues,
} = require("../controllers/issueController");

const router = express.Router();

// Create issue
router.post("/", createIssue);

// Get nearby issues
router.get("/nearby", getNearbyIssues);

module.exports = router;