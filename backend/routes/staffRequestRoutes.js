const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  submitStaffRequest, getStaffRequests, approveStaffRequest, rejectStaffRequest, resendSetupLink, getStaffSetupInfo, setStaffPassword,
} = require("../controllers/staffRequestController");

const router = express.Router();
const admin = [protect, authorizeRoles("admin")];

// public
router.post("/", submitStaffRequest);
router.get("/setup", getStaffSetupInfo);
router.post("/set-password", setStaffPassword);

// command
router.get("/", ...admin, getStaffRequests);
router.patch("/:id/approve", ...admin, approveStaffRequest);
router.patch("/:id/reject", ...admin, rejectStaffRequest);
router.post("/:id/resend-setup", ...admin, resendSetupLink);

module.exports = router;
