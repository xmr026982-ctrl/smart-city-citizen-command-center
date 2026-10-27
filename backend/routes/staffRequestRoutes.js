
const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  submitStaffRequest,
  getStaffRequests,
  approveStaffRequest,
  rejectStaffRequest,
  setStaffPassword,
} = require("../controllers/staffRequestController");

const router = express.Router();

// Public endpoints
router.post("/", submitStaffRequest);
router.post("/set-password", setStaffPassword);

// Admin-only endpoints
router.get("/", protect, authorizeRoles("admin"), getStaffRequests);
router.patch("/:id/approve", protect, authorizeRoles("admin"), approveStaffRequest);
router.patch("/:id/reject", protect, authorizeRoles("admin"), rejectStaffRequest);

module.exports = router;